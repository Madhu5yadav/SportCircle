from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
import os
import shutil
import uuid

from app.database.db import get_db
from app.models.models import User, PreferredSport, Wallet, Settings, Friend
from app.schemas.schemas import (
    ProfileResponse, ProfileUpdate, SettingsResponse, UserResponse, WalletResponse,
    PublicProfileResponse, PublicProfileUserResponse, RateUserRequest
)
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
    sports_details_list = [{"name": s.sport_name, "level": s.level or "Beginner"} for s in pref_sports]
    
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
    bio_text = current_user.about
    if current_user.about and current_user.about.startswith("Playing:"):
        parts = current_user.about.split("\n\n", 1)
        times_str = parts[0].split("Playing:")[1]
        playing_time_list = [t.strip() for t in times_str.split(",") if t.strip()]
        bio_text = parts[1] if len(parts) > 1 else ""

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
        about=bio_text,
        profile_pic=current_user.profile_pic,
        trust_score=current_user.trust_score or 0.0,
        ratings_count=current_user.ratings_count or 0,
        created_at=current_user.created_at
    )

    return ProfileResponse(
        user=user_res,
        preferred_sports=sports_list,
        preferred_sports_details=sports_details_list,
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
    # Extract existing bio and playing times to update them separately
    current_bio = ""
    current_playing = ""
    if current_user.about and current_user.about.startswith("Playing:"):
        parts = current_user.about.split("\n\n", 1)
        current_playing = parts[0]
        current_bio = parts[1] if len(parts) > 1 else ""
    elif current_user.about:
        current_bio = current_user.about

    if profile_in.about is not None:
        current_bio = profile_in.about
        
    if profile_in.playing_time is not None:
        playing_str = ",".join(profile_in.playing_time)
        current_playing = f"Playing: {playing_str}"
        
    # Reassemble about value
    about_val = ""
    if current_playing:
        about_val = current_playing
        
    if current_bio:
        if about_val:
            about_val += f"\n\n{current_bio}"
        else:
            about_val = current_bio
            
    current_user.about = about_val if about_val else None

    if profile_in.profile_pic is not None:
        current_user.profile_pic = profile_in.profile_pic
        
    # Update preferred sports if provided
    if profile_in.sports is not None:
        db.query(PreferredSport).filter(PreferredSport.user_id == current_user.id).delete()
        for i, sport in enumerate(profile_in.sports):
            level = profile_in.sports_levels[i] if (profile_in.sports_levels and i < len(profile_in.sports_levels)) else "Beginner"
            pref_sport = PreferredSport(user_id=current_user.id, sport_name=sport, level=level)
            db.add(pref_sport)

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


@router.get("/profile/{user_id}", response_model=PublicProfileResponse)
def get_public_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    # Fetch Preferred Sports
    pref_sports = db.query(PreferredSport).filter(PreferredSport.user_id == user_id).all()
    sports_list = [s.sport_name for s in pref_sports]
    sports_details_list = [{"name": s.sport_name, "level": s.level or "Beginner"} for s in pref_sports]
    
    # Extract playing times
    playing_time_list = []
    bio_text = user.about
    if user.about and user.about.startswith("Playing:"):
        parts = user.about.split("\n\n", 1)
        times_str = parts[0].split("Playing:")[1]
        playing_time_list = [t.strip() for t in times_str.split(",") if t.strip()]
        bio_text = parts[1] if len(parts) > 1 else ""

    # Check friendship status
    status_val = "none"
    friendship_id = None
    
    if user_id == current_user.id:
        status_val = "self"
    else:
        friendship = db.query(Friend).filter(
            or_(
                and_(Friend.user_id == current_user.id, Friend.friend_id == user_id),
                and_(Friend.user_id == user_id, Friend.friend_id == current_user.id)
            )
        ).first()
        if friendship:
            friendship_id = friendship.id
            if friendship.status == "accepted":
                status_val = "accepted"
            elif friendship.status == "pending":
                if friendship.user_id == current_user.id:
                    status_val = "pending_sent"
                else:
                    status_val = "pending_received"

    # Compute mutual friends
    my_friend_ids = db.query(Friend.user_id).filter(
        and_(Friend.friend_id == current_user.id, Friend.status == "accepted")
    ).union(
        db.query(Friend.friend_id).filter(
            and_(Friend.user_id == current_user.id, Friend.status == "accepted")
        )
    ).all()
    my_friend_ids_set = {r[0] for r in my_friend_ids}
    
    u_friend_ids = db.query(Friend.user_id).filter(
        and_(Friend.friend_id == user_id, Friend.status == "accepted")
    ).union(
        db.query(Friend.friend_id).filter(
            and_(Friend.user_id == user_id, Friend.status == "accepted")
        )
    ).all()
    u_friend_ids_set = {r[0] for r in u_friend_ids}
    
    mutual_count = len(my_friend_ids_set.intersection(u_friend_ids_set))

    user_res = PublicProfileUserResponse(
        id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        dob=user.dob,
        gender=user.gender,
        about=bio_text,
        profile_pic=user.profile_pic,
        trust_score=user.trust_score or 0.0,
        ratings_count=user.ratings_count or 0,
        created_at=user.created_at
    )

    return PublicProfileResponse(
        user=user_res,
        preferred_sports=sports_list,
        preferred_sports_details=sports_details_list,
        playing_time=playing_time_list,
        friendship_status=status_val,
        friendship_id=friendship_id,
        mutual_friends_count=mutual_count
    )


@router.post("/profile/{user_id}/rate")
def rate_user(
    user_id: int,
    rate_in: RateUserRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot rate yourself")
        
    if rate_in.rating < 1 or rate_in.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Calculate new trust score
    old_score = user.trust_score or 0.0
    old_count = user.ratings_count or 0
    
    new_count = old_count + 1
    new_score = (old_score * old_count + rate_in.rating) / new_count
    
    user.ratings_count = new_count
    user.trust_score = round(new_score, 1)
    
    db.commit()
    return {"message": "Rating submitted successfully", "trust_score": user.trust_score, "ratings_count": user.ratings_count}
