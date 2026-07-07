from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
import uuid

from app.database.db import get_db
from app.models.models import User, PreferredSport, Wallet, Settings
from app.schemas.schemas import ProfileResponse, ProfileUpdate, SettingsResponse, UserResponse, WalletResponse
from app.middleware.auth import get_current_user

router = APIRouter(tags=["User Profile"])

@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch Preferred Sports
    pref_sports = db.query(PreferredSport).filter(PreferredSport.user_id == current_user.id).all()
    sports_list = [s.sport_name for s in pref_sports]
    
    # Fetch Wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        wallet = Wallet(user_id=current_user.id, balance=1000.00)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
        
    # Fetch Settings
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Extract playing times from user about column if formatted as: "Playing: Morning,Evening"
    playing_time_list = []
    if current_user.about and current_user.about.startswith("Playing:"):
        times_str = current_user.about.split("Playing:")[1]
        playing_time_list = [t.strip() for t in times_str.split(",") if t.strip()]

    user_res = UserResponse(
        id=current_user.id,
        username=current_user.username,
        mobile=current_user.mobile,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        dob=current_user.dob,
        gender=current_user.gender,
        latitude=current_user.latitude,
        longitude=current_user.longitude,
        about=current_user.about,
        profile_pic=current_user.profile_pic,
        created_at=current_user.created_at
    )

    return ProfileResponse(
        user=user_res,
        preferred_sports=sports_list,
        playing_time=playing_time_list,
        wallet=WalletResponse(balance=wallet.balance),
        settings=SettingsResponse(
            push_enabled=settings.push_enabled,
            email_enabled=settings.email_enabled,
            dark_mode=settings.dark_mode
        )
    )


@router.put("/profile")
def update_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if profile_in.first_name is not None:
        current_user.first_name = profile_in.first_name
    if profile_in.last_name is not None:
        current_user.last_name = profile_in.last_name
    if profile_in.dob is not None:
        current_user.dob = profile_in.dob
    if profile_in.gender is not None:
        current_user.gender = profile_in.gender
    if profile_in.about is not None:
        current_user.about = profile_in.about
    if profile_in.profile_pic is not None:
        current_user.profile_pic = profile_in.profile_pic
        
    # Update preferred sports if provided
    if profile_in.sports is not None:
        db.query(PreferredSport).filter(PreferredSport.user_id == current_user.id).delete()
        for sport in profile_in.sports:
            pref_sport = PreferredSport(user_id=current_user.id, sport_name=sport)
            db.add(pref_sport)

    # Update preferred playing time in about description if provided
    if profile_in.playing_time is not None:
        playing_str = ",".join(profile_in.playing_time)
        current_user.about = f"Playing: {playing_str}"

    db.commit()
    return {"message": "Profile updated successfully"}


@router.put("/profile/settings")
def update_settings(
    settings_in: SettingsResponse,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings:
        settings = Settings(user_id=current_user.id)
        db.add(settings)
        
    settings.push_enabled = settings_in.push_enabled
    settings.email_enabled = settings_in.email_enabled
    settings.dark_mode = settings_in.dark_mode
    
    db.commit()
    return {"message": "Notification preferences updated successfully"}


@router.post("/profile/upload-photo")
def upload_profile_photo(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    uploads_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"user_{current_user.id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    host = request.headers.get("host", "localhost:8000")
    scheme = request.url.scheme
    base_url = f"{scheme}://{host}"
    url = f"{base_url}/uploads/{filename}"
    
    current_user.profile_pic = url
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile photo uploaded successfully.", "url": url}
