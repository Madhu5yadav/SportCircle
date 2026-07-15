from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date, time, datetime
from typing import List, Optional
from math import radians, cos, sin, asin, sqrt

from app.database.db import get_db
from app.models.models import User, Game, Participant, ChatRoom, Notification, SquadMember, BookingAccessRequest
from app.schemas.schemas import GameCreate, GameResponse, ParticipantResponse, GameUpdate
from app.middleware.auth import get_current_user
from app.services.socket_service import broadcast_game_joined_update
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Games"])

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers between two coordinates."""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 9999.0
    # convert decimal degrees to radians 
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a)) 
    r = 6371.0 # Radius of earth in kilometers
    return c * r

def get_time_slot(game_time: time) -> str:
    """Return time slot bucket based on hour."""
    hour = game_time.hour
    if 5 <= hour < 12:
        return "Morning"
    elif 12 <= hour < 17:
        return "Afternoon"
    elif 17 <= hour < 21:
        return "Evening"
    else:
        return "Night"


@router.post("/host-game", response_model=GameResponse, status_code=status.HTTP_201_CREATED)
def host_game(
    game_in: GameCreate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Create game record
    db_game = Game(
        host_id=current_user.id,
        name=game_in.name,
        sport_type=game_in.sport_type,
        location=game_in.location,
        latitude=game_in.latitude or current_user.latitude,
        longitude=game_in.longitude or current_user.longitude,
        game_date=game_in.game_date,
        start_time=game_in.start_time,
        end_time=game_in.end_time,
        access=game_in.access,
        player_count=game_in.player_count,
        entry_fee=game_in.entry_fee,
        gender=game_in.gender,
        equipment_required=game_in.equipment_required,
        description=game_in.description
    )
    db.add(db_game)
    db.commit()
    db.refresh(db_game)

    # 2. Automatically join the host as the first participant
    db_participant = Participant(game_id=db_game.id, user_id=current_user.id)
    db.add(db_participant)

    # 3. Auto-join accepted squad members if squad_id is provided
    if game_in.squad_id:
        squad_members = db.query(SquadMember).filter(
            SquadMember.squad_id == game_in.squad_id,
            SquadMember.status == "accepted"
        ).all()
        added_count = 1
        for m in squad_members:
            if m.user_id == current_user.id:
                continue
            if added_count >= db_game.player_count:
                break
            db_part = Participant(game_id=db_game.id, user_id=m.user_id)
            db.add(db_part)
            added_count += 1

    # 4. Create a chat room for this game
    db_chat_room = ChatRoom(
        name=f"Game: {db_game.name}",
        type="game",
        game_id=db_game.id
    )
    db.add(db_chat_room)
    db.commit()

    # Create response schema
    return get_game_details(db_game.id, current_user, db)


@router.get("/games", response_model=List[GameResponse])
def list_games(
    sport: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    max_distance_km: Optional[float] = 50.0,
    game_date: Optional[date] = None,
    time_slot: Optional[str] = None, # Morning, Afternoon, Evening, Night
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Game)
    
    # Filter by sport
    if sport:
        query = query.filter(Game.sport_type == sport)
        
    # Filter by date
    if game_date:
        query = query.filter(Game.game_date == game_date)
        
    games = query.all()
    filtered_games = []
    
    # Process distance and time slot filters in code
    for g in games:
        # Distance calculation
        dist = 0.0
        if lat is not None and lng is not None:
            dist = haversine_distance(lat, lng, g.latitude, g.longitude)
            if dist > max_distance_km:
                continue
                
        # Time slot calculation
        if time_slot:
            slot = get_time_slot(g.start_time)
            if slot.lower() != time_slot.lower():
                continue
                
        # Populate dynamic counts and user states
        joined_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "joined").count()
        waiting_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "waiting").count()
        is_joined = db.query(Participant).filter(
            Participant.game_id == g.id, 
            Participant.user_id == current_user.id
        ).first() is not None
        
        # Build participants list
        participants = db.query(Participant).filter(Participant.game_id == g.id).all()
        parts_list = []
        for p in participants:
            parts_list.append(ParticipantResponse(
                user_id=p.user.id,
                username=p.user.username,
                profile_pic=p.user.profile_pic,
                status=p.status,
                joined_at=p.joined_at
            ))
            
        res = GameResponse(
            id=g.id,
            host_id=g.host_id,
            host_username=g.host.username,
            host_profile_pic=g.host.profile_pic,
            name=g.name,
            sport_type=g.sport_type,
            location=g.location,
            latitude=g.latitude,
            longitude=g.longitude,
            game_date=g.game_date,
            start_time=g.start_time,
            end_time=g.end_time,
            access=g.access,
            player_count=g.player_count,
            entry_fee=g.entry_fee,
            gender=g.gender,
            equipment_required=g.equipment_required,
            description=g.description,
            created_at=g.created_at,
            joined_count=joined_count,
            waiting_count=waiting_count,
            is_joined=is_joined,
            participants=parts_list
        )
        filtered_games.append(res)
        
    return filtered_games


@router.get("/game/{id}", response_model=GameResponse)
def get_game(
    id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    res = get_game_details(id, current_user, db)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
    return res


@router.post("/join-game/{id}")
async def join_game(
    id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
        
    # Check if already joined
    existing = db.query(Participant).filter(
        Participant.game_id == id,
        Participant.user_id == current_user.id
    ).first()
    if existing:
        return {"message": "Already joined this game" if existing.status == "joined" else "Already in the waiting list for this game"}
        
    # Check slots available
    joined_count = db.query(Participant).filter(Participant.game_id == id, Participant.status == "joined").count()
    if joined_count >= game.player_count:
        status_val = "waiting"
    else:
        status_val = "joined"
        
    # Join
    p = Participant(game_id=id, user_id=current_user.id, status=status_val)
    db.add(p)
    db.commit()
    
    # Auto-join accepted squad members if this user leads a squad
    from app.models.models import Squad
    squad = db.query(Squad).filter(Squad.created_by == current_user.id).first()
    if squad:
        squad_members = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.status == "accepted",
            SquadMember.user_id != current_user.id
        ).all()
        current_joined = db.query(Participant).filter(
            Participant.game_id == id,
            Participant.status == "joined"
        ).count()
        for m in squad_members:
            # Check if this squad member is already a participant
            exists_m = db.query(Participant).filter(
                Participant.game_id == id,
                Participant.user_id == m.user_id
            ).first()
            if not exists_m:
                m_status = "joined" if current_joined < game.player_count else "waiting"
                if m_status == "joined":
                    current_joined += 1
                db_m_part = Participant(game_id=id, user_id=m.user_id, status=m_status)
                db.add(db_m_part)
        db.commit()
        
    # Broadcast count update via Socket.IO
    new_count = db.query(Participant).filter(Participant.game_id == id, Participant.status == "joined").count()
    await broadcast_game_joined_update(game.id, new_count, game.player_count)
    
    # Notify host
    if game.host_id != current_user.id:
        title_str = "Player Joined!" if status_val == "joined" else "Player added to Waiting List"
        msg_str = f"{current_user.username} joined your game '{game.name}'!" if status_val == "joined" else f"{current_user.username} joined the waiting list for '{game.name}'"
        NotificationService.create_notification(
            user_id=game.host_id,
            title=title_str,
            message=msg_str,
            notif_type="game_accepted",
            db=db
        )
        
    return {
        "message": "Joined game successfully" if status_val == "joined" else "Added to waiting list", 
        "joined_count": new_count
    }


def fill_game_slot_from_waiting_list(game_id: int, db: Session):
    # Count current joined participants
    joined_count = db.query(Participant).filter(
        Participant.game_id == game_id,
        Participant.status == "joined"
    ).count()
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        return
    
    # If we have free slots, pull from waiting list
    while joined_count < game.player_count:
        next_waiting = db.query(Participant).filter(
            Participant.game_id == game_id,
            Participant.status == "waiting"
        ).order_by(Participant.id.asc()).first()
        
        if not next_waiting:
            break
            
        next_waiting.status = "joined"
        db.commit()
        joined_count += 1
        
        # Notify the promoted participant
        NotificationService.create_notification(
            user_id=next_waiting.user_id,
            title="Off the Waiting List!",
            message=f"Good news! You have been moved off the waiting list and are now joined in the game '{game.name}'!",
            notif_type="system",
            db=db
        )


@router.post("/leave-game/{id}")
async def leave_game(
    id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
        
    # Leave
    existing = db.query(Participant).filter(
        Participant.game_id == id,
        Participant.user_id == current_user.id
    ).first()
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not a participant in this game"
        )
        
    leaving_status = existing.status
    
    # If the leaving user is a squad leader, also remove their accepted squad members from this game
    from app.models.models import Squad
    squad = db.query(Squad).filter(Squad.created_by == current_user.id).first()
    if squad:
        squad_members = db.query(SquadMember).filter(
            SquadMember.squad_id == squad.id,
            SquadMember.status == "accepted",
            SquadMember.user_id != current_user.id
        ).all()
        for m in squad_members:
            db.query(Participant).filter(
                Participant.game_id == id,
                Participant.user_id == m.user_id
            ).delete()
        db.commit()
        
    is_host = (game.host_id == current_user.id)
    
    if is_host:
        # Check if there are other participants (prefer joined first)
        other_participant = db.query(Participant).filter(
            Participant.game_id == id,
            Participant.user_id != current_user.id,
            Participant.status == "joined"
        ).order_by(Participant.joined_at.asc(), Participant.id.asc()).first()
        
        if not other_participant:
            other_participant = db.query(Participant).filter(
                Participant.game_id == id,
                Participant.user_id != current_user.id
            ).order_by(Participant.joined_at.asc(), Participant.id.asc()).first()
            
        if other_participant:
            # Promote the next player to Host
            new_host_id = other_participant.user_id
            game.host_id = new_host_id
            other_participant.status = "joined" # Ensure they are joined
            
            # Remove the current host from the participants list
            db.delete(existing)
            db.commit()
            
            # Fill slot from waiting list if needed
            fill_game_slot_from_waiting_list(id, db)
            
            # Notify the new host
            NotificationService.create_notification(
                user_id=new_host_id,
                title="You are now the Host!",
                message=f"You have been made the host of the game '{game.name}' because the previous host left.",
                notif_type="system",
                db=db
            )
            
            # Broadcast the updated player count
            joined_count = db.query(Participant).filter(Participant.game_id == id, Participant.status == "joined").count()
            await broadcast_game_joined_update(game.id, joined_count, game.player_count)
            
            return {
                "message": "Left game successfully. Host role transferred.",
                "joined_count": joined_count,
                "host_transferred": True
            }
        else:
            # No other members, delete the game
            db.delete(game)
            db.commit()
            return {
                "message": "Left game successfully. Game deleted as there were no other participants.",
                "joined_count": 0,
                "game_deleted": True
            }
    else:
        # Non-host participant leaving
        db.delete(existing)
        db.commit()
        
        if leaving_status == "joined":
            # Fill slot from waiting list
            fill_game_slot_from_waiting_list(id, db)
            
        joined_count = db.query(Participant).filter(Participant.game_id == id, Participant.status == "joined").count()
        await broadcast_game_joined_update(game.id, joined_count, game.player_count)
        
        # Notify host
        NotificationService.create_notification(
            user_id=game.host_id,
            title="Player Left",
            message=f"{current_user.username} left your game '{game.name}'",
            notif_type="system",
            db=db
        )
        
        return {"message": "Left game successfully", "joined_count": joined_count}


@router.delete("/game/{id}")
def delete_game(
    id: int, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
        
    if game.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only host can delete this game"
        )
        
    db.delete(game)
    db.commit()
    return {"message": "Game deleted successfully"}


@router.put("/game/{id}", response_model=GameResponse)
def update_game(
    id: int,
    game_in: GameUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == id).first()
    if not game:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Game not found"
        )
        
    if game.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the host can edit game details"
        )
        
    update_data = game_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(game, field, value)
        
    db.commit()
    db.refresh(game)
    return get_game_details(game.id, current_user, db)


# Helper to construct full game details
def get_game_details(game_id: int, user: User, db: Session) -> Optional[GameResponse]:
    g = db.query(Game).filter(Game.id == game_id).first()
    if not g:
        return None
        
    joined_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "joined").count()
    waiting_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "waiting").count()
    is_joined = db.query(Participant).filter(
        Participant.game_id == g.id, 
        Participant.user_id == user.id
    ).first() is not None
    
    # Build participants list
    participants = db.query(Participant).filter(Participant.game_id == g.id).all()
    parts_list = []
    for p in participants:
        parts_list.append(ParticipantResponse(
            user_id=p.user.id,
            username=p.user.username,
            profile_pic=p.user.profile_pic,
            status=p.status,
            joined_at=p.joined_at
        ))
        
    return GameResponse(
        id=g.id,
        host_id=g.host_id,
        host_username=g.host.username,
        host_profile_pic=g.host.profile_pic,
        name=g.name,
        sport_type=g.sport_type,
        location=g.location,
        latitude=g.latitude,
        longitude=g.longitude,
        game_date=g.game_date,
        start_time=g.start_time,
        end_time=g.end_time,
        access=g.access,
        player_count=g.player_count,
        entry_fee=g.entry_fee,
        gender=g.gender,
        equipment_required=g.equipment_required,
        description=g.description,
        created_at=g.created_at,
        joined_count=joined_count,
        waiting_count=waiting_count,
        is_joined=is_joined,
        participants=parts_list
    )


@router.get("/my-joined-games", response_model=List[GameResponse])
def get_my_joined_games(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    joined_game_ids = db.query(Participant.game_id).filter(Participant.user_id == current_user.id).all()
    game_ids = [g[0] for g in joined_game_ids]
    
    games = db.query(Game).filter(Game.id.in_(game_ids)).all()
    
    filtered_games = []
    for g in games:
        joined_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "joined").count()
        waiting_count = db.query(Participant).filter(Participant.game_id == g.id, Participant.status == "waiting").count()
        parts_list = []
        for p in g.participants:
            parts_list.append(ParticipantResponse(
                user_id=p.user.id,
                username=p.user.username,
                profile_pic=p.user.profile_pic,
                status=p.status,
                joined_at=p.joined_at
            ))
            
        res = GameResponse(
            id=g.id,
            host_id=g.host_id,
            host_username=g.host.username,
            host_profile_pic=g.host.profile_pic,
            name=g.name,
            sport_type=g.sport_type,
            location=g.location,
            latitude=g.latitude,
            longitude=g.longitude,
            game_date=g.game_date,
            start_time=g.start_time,
            end_time=g.end_time,
            access=g.access,
            player_count=g.player_count,
            entry_fee=g.entry_fee,
            gender=g.gender,
            equipment_required=g.equipment_required,
            description=g.description,
            created_at=g.created_at,
            joined_count=joined_count,
            waiting_count=waiting_count,
            is_joined=True,
            participants=parts_list
        )
        filtered_games.append(res)
    return filtered_games


@router.get("/game/{game_id}/booking-access")
def get_booking_access(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    if game.host_id == current_user.id:
        return {"has_access": True, "status": "approved"}
        
    req = db.query(BookingAccessRequest).filter(
        BookingAccessRequest.game_id == game_id,
        BookingAccessRequest.user_id == current_user.id
    ).order_by(BookingAccessRequest.id.desc()).first()
    
    if not req:
        return {"has_access": False, "status": "none"}
        
    return {
        "has_access": req.status == "approved",
        "status": req.status
    }


@router.post("/game/{game_id}/request-booking-access")
def request_booking_access(
    game_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    game = db.query(Game).filter(Game.id == game_id).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
        
    part = db.query(Participant).filter(
        Participant.game_id == game_id,
        Participant.user_id == current_user.id
    ).first()
    if not part:
        raise HTTPException(status_code=400, detail="You must be joined in this game to request access to book")
        
    if game.host_id == current_user.id:
        return {"message": "You are the host, you already have booking access."}
        
    existing = db.query(BookingAccessRequest).filter(
        BookingAccessRequest.game_id == game_id,
        BookingAccessRequest.user_id == current_user.id,
        BookingAccessRequest.status == "pending"
    ).first()
    if existing:
        return {"message": "Booking access request already pending"}
        
    req = BookingAccessRequest(
        game_id=game_id,
        user_id=current_user.id,
        status="pending"
    )
    db.add(req)
    
    NotificationService.create_notification(
        user_id=game.host_id,
        title="Booking Access Request",
        message=f"{current_user.username} has requested access to book a venue for your game '{game.name}'.",
        notif_type="game_request",
        db=db
    )
    db.commit()
    return {"message": "Request sent successfully"}


@router.get("/game/booking-access-requests")
def list_booking_access_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    hosted_game_ids = db.query(Game.id).filter(Game.host_id == current_user.id).all()
    game_ids = [g[0] for g in hosted_game_ids]
    
    requests = db.query(BookingAccessRequest).filter(
        BookingAccessRequest.game_id.in_(game_ids),
        BookingAccessRequest.status == "pending"
    ).all()
    
    return [
        {
            "id": r.id,
            "game_id": r.game_id,
            "game_name": r.game.name,
            "user_id": r.user_id,
            "username": r.user.username,
            "profile_pic": r.user.profile_pic,
            "created_at": r.created_at
        }
        for r in requests
    ]


@router.post("/game/booking-access-request/{request_id}/approve")
def approve_booking_access(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(BookingAccessRequest).filter(BookingAccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req.game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the game host can approve booking access requests")
        
    req.status = "approved"
    
    NotificationService.create_notification(
        user_id=req.user_id,
        title="Booking Access Approved",
        message=f"Your request to book a venue for game '{req.game.name}' has been approved by the host.",
        notif_type="game_accepted",
        db=db
    )
    db.commit()
    return {"message": "Request approved successfully"}


@router.post("/game/booking-access-request/{request_id}/reject")
def reject_booking_access(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    req = db.query(BookingAccessRequest).filter(BookingAccessRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req.game.host_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the game host can reject booking access requests")
        
    req.status = "rejected"
    
    NotificationService.create_notification(
        user_id=req.user_id,
        title="Booking Access Rejected",
        message=f"Your request to book a venue for game '{req.game.name}' was rejected by the host.",
        notif_type="system",
        db=db
    )
    db.commit()
    return {"message": "Request rejected successfully"}
