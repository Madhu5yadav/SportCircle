from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, time, datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from math import radians, cos, sin, asin, sqrt

from app.database.db import get_db
from app.models.models import User, Venue, Booking, Wallet, PaymentHistory
from app.schemas.schemas import VenueResponse, VenueCreate, BookingCreate, BookingResponse, WalletResponse, PaymentHistoryResponse, WalletAddFunds
from app.middleware.auth import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Venues & Bookings"])

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two coordinates."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 9999.0
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 6371.0
    return c * r


@router.get("/venues", response_model=List[VenueResponse])
def get_venues(
    sport: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    max_distance_km: Optional[float] = 50.0,
    db: Session = Depends(get_db)
):
    query = db.query(Venue)
    if sport:
        # Match sport name case-insensitive
        query = query.filter(Venue.sport.like(f"%{sport}%"))
        
    venues = query.all()
    filtered_venues = []
    
    for v in venues:
        if lat is not None and lng is not None:
            dist = haversine_distance(lat, lng, v.latitude, v.longitude)
            if dist > max_distance_km:
                continue
        filtered_venues.append(v)
        
    return filtered_venues


@router.get("/venue/{id}", response_model=VenueResponse)
def get_venue(id: int, db: Session = Depends(get_db)):
    venue = db.query(Venue).filter(Venue.id == id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
    return venue


@router.get("/venue/{id}/slots")
def get_available_slots(id: int, booking_date: date, db: Session = Depends(get_db)):
    """Check booked slots for a specific venue and date, returning available slots."""
    venue = db.query(Venue).filter(Venue.id == id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
        
    # Get active bookings for this date
    bookings = db.query(Booking).filter(
        Booking.venue_id == id,
        Booking.booking_date == booking_date,
        Booking.status == "confirmed"
    ).all()
    
    # Simple list of all hourly slots (6:00 to 22:00)
    all_slots = []
    start_hour = 6
    end_hour = 22
    
    for hr in range(start_hour, end_hour):
        slot_start = time(hr, 0)
        slot_end = time(hr + 1, 0)
        
        # Check if slot is booked
        is_booked = False
        for b in bookings:
            # Overlapping logic
            if not (slot_end <= b.start_time or slot_start >= b.end_time):
                is_booked = True
                break
                
        all_slots.append({
            "start_time": slot_start.strftime("%H:%M"),
            "end_time": slot_end.strftime("%H:%M"),
            "available": not is_booked
        })
        
    return all_slots


@router.post("/book-venue", response_model=BookingResponse)
def book_venue(
    booking_in: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    venue = db.query(Venue).filter(Venue.id == booking_in.venue_id).first()
    if not venue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Venue not found"
        )
        
    # 1. Check double booking
    overlap = db.query(Booking).filter(
        Booking.venue_id == booking_in.venue_id,
        Booking.booking_date == booking_in.booking_date,
        Booking.status == "confirmed",
        Booking.start_time < booking_in.end_time,
        Booking.end_time > booking_in.start_time
    ).first()
    
    if overlap:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This slot is already booked for this venue"
        )
        
    # 2. Check wallet balance
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet or wallet.balance < booking_in.amount_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance. Please add funds."
        )
        
    # 3. Deduct balance
    wallet.balance -= booking_in.amount_paid
    
    # 4. Save Payment History
    history = PaymentHistory(
        user_id=current_user.id,
        amount=booking_in.amount_paid,
        type="debit",
        description=f"Booking for {venue.name} on {booking_in.booking_date}"
    )
    db.add(history)
    
    # 5. Create Booking
    db_booking = Booking(
        venue_id=booking_in.venue_id,
        user_id=current_user.id,
        booking_date=booking_in.booking_date,
        start_time=booking_in.start_time,
        end_time=booking_in.end_time,
        amount_paid=booking_in.amount_paid,
        status="confirmed"
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    
    # 6. Send notification
    NotificationService.create_notification(
        user_id=current_user.id,
        title="Booking Confirmed!",
        message=f"Your slot at {venue.name} has been booked for {booking_in.booking_date} from {booking_in.start_time} to {booking_in.end_time}!",
        notif_type="booking_confirm",
        db=db
    )
    
    return db_booking


@router.get("/booking-history", response_model=List[BookingResponse])
def get_booking_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return (
        db.query(Booking)
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.id.desc())
        .all()
    )


# --- Wallet APIs ---

@router.get("/profile/wallet", response_model=WalletResponse)
def get_wallet(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        # Auto-create if somehow missing
        wallet = Wallet(user_id=current_user.id, balance=1000.00)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


@router.post("/profile/wallet/deposit", response_model=WalletResponse)
def add_funds(
    funds: WalletAddFunds,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        wallet = Wallet(user_id=current_user.id, balance=Decimal(0.00))
        db.add(wallet)
        
    wallet.balance += funds.amount
    
    # Log payment history
    history = PaymentHistory(
        user_id=current_user.id,
        amount=funds.amount,
        type="credit",
        description="Deposited money into wallet"
    )
    db.add(history)
    db.commit()
    db.refresh(wallet)
    
    # Notify user
    NotificationService.create_notification(
        user_id=current_user.id,
        title="Wallet Credited",
        message=f"Added Rs.{funds.amount} to your SportCircle wallet!",
        notif_type="system",
        db=db
    )
    
    return wallet


@router.get("/profile/payments", response_model=List[PaymentHistoryResponse])
def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return (
        db.query(PaymentHistory)
        .filter(PaymentHistory.user_id == current_user.id)
        .order_by(PaymentHistory.id.desc())
        .all()
    )


# --- Owner Venues Management ---

@router.get("/venues/owner", response_model=List[VenueResponse])
def get_owner_venues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Venue).filter(Venue.owner_id == current_user.id).all()


@router.post("/venues", response_model=VenueResponse, status_code=201)
def create_venue(
    venue_in: VenueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Promote user to owner on venue creation
    if current_user.role != "owner":
        current_user.role = "owner"
        db.add(current_user)
        db.commit()

    db_venue = Venue(
        name=venue_in.name,
        location=venue_in.location,
        latitude=venue_in.latitude,
        longitude=venue_in.longitude,
        sport=venue_in.sport,
        facilities=venue_in.facilities,
        price_per_hour=venue_in.price_per_hour,
        image_url=venue_in.image_url,
        offer_details=venue_in.offer_details,
        owner_id=current_user.id
    )
    db.add(db_venue)
    db.commit()
    db.refresh(db_venue)
    return db_venue


@router.put("/venue/{id}", response_model=VenueResponse)
def update_venue(
    id: int,
    venue_in: VenueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_venue = db.query(Venue).filter(Venue.id == id, Venue.owner_id == current_user.id).first()
    if not db_venue:
        raise HTTPException(status_code=404, detail="Venue not found or unauthorized access.")
    
    db_venue.name = venue_in.name
    db_venue.location = venue_in.location
    db_venue.latitude = venue_in.latitude
    db_venue.longitude = venue_in.longitude
    db_venue.sport = venue_in.sport
    db_venue.facilities = venue_in.facilities
    db_venue.price_per_hour = venue_in.price_per_hour
    db_venue.image_url = venue_in.image_url
    db_venue.offer_details = venue_in.offer_details
    
    db.commit()
    db.refresh(db_venue)
    return db_venue


@router.delete("/venue/{id}")
def delete_venue(
    id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_venue = db.query(Venue).filter(Venue.id == id, Venue.owner_id == current_user.id).first()
    if not db_venue:
        raise HTTPException(status_code=404, detail="Venue not found or unauthorized access.")
    
    db.delete(db_venue)
    db.commit()
    return {"message": "Venue deleted successfully"}
