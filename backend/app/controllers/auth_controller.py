from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database.db import get_db
from app.models.models import User, OTPVerification, PreferredSport, Wallet, Settings
from app.schemas.schemas import (
    UserCreate, UserLogin, Token, TokenRefresh, OTPSend, OTPVerify, 
    OTPVerifyResponse, ForgotPasswordRequest, ResetPasswordRequest,
    PersonalDetailsCreate, PreferredSportsCreate, ProfileResponse, 
    UserResponse, WalletResponse, SettingsResponse, ProfileUpdate
)
from app.utils.security import (
    hash_password, verify_password, create_access_token, 
    create_refresh_token, decode_token
)
from app.services.otp_service import OTPService
from app.middleware.auth import get_current_user
import json

router = APIRouter(tags=["Authentication"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    # 1. Check if username exists
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
        
    # 2. Check if mobile exists
    existing_mobile = db.query(User).filter(User.mobile == user_in.mobile).first()
    if existing_mobile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile number already registered"
        )
        
    # 3. Create user
    hashed_pwd = hash_password(user_in.password)
    db_user = User(
        username=user_in.username,
        mobile=user_in.mobile,
        password_hash=hashed_pwd
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Initialize wallet for testing
    db_wallet = Wallet(user_id=db_user.id, balance=1000.00)
    db.add(db_wallet)
    
    # Initialize settings
    db_settings = Settings(user_id=db_user.id)
    db.add(db_settings)
    db.commit()
    
    # 4. Trigger OTP send
    otp_code = OTPService.generate_otp(db_user.mobile, db)

    # No real SMS gateway is configured; OTP is returned directly for dev/testing.
    return {"message": "User registered successfully. OTP sent.", "mobile": db_user.mobile, "otp": otp_code}


@router.post("/send-otp")
def send_otp(otp_in: OTPSend, db: Session = Depends(get_db)):
    # Verify if user exists (for reset password, etc.) or allow sending OTP for signup
    otp_code = OTPService.generate_otp(otp_in.mobile, db)
    # No real SMS gateway is configured; OTP is returned directly for dev/testing.
    return {"message": "OTP sent successfully.", "otp": otp_code}


@router.post("/verify-otp")
def verify_otp(verify_in: OTPVerify, db: Session = Depends(get_db)):
    success = OTPService.verify_otp(verify_in.mobile, verify_in.otp_code, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    # Get user to issue tokens
    user = db.query(User).filter(User.mobile == verify_in.mobile).first()
    if not user:
        return {"message": "Mobile number verified.", "verified": True}
        
    # User exists, issue tokens so they auto-login
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return {
        "message": "OTP verified successfully",
        "verified": True,
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user_id": user.id,
            "username": user.username
        }
    }


@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    # Find user by username or mobile
    user = db.query(User).filter(
        (User.username == login_in.username_or_mobile) | 
        (User.mobile == login_in.username_or_mobile)
    ).first()
    
    if not user or not verify_password(login_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/mobile or password"
        )
        
    # Issue JWT tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }


@router.post("/refresh-token")
def refresh_token(token_in: TokenRefresh, db: Session = Depends(get_db)):
    payload = decode_token(token_in.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
        
    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username
    }


@router.post("/forgot-password")
def forgot_password(forgot_in: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.mobile == forgot_in.mobile).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mobile number not registered"
        )
        
    otp_code = OTPService.generate_otp(user.mobile, db)
    # No real SMS gateway is configured; OTP is returned directly for dev/testing.
    return {"message": "OTP for password reset sent.", "otp": otp_code}


@router.post("/reset-password")
def reset_password(reset_in: ResetPasswordRequest, db: Session = Depends(get_db)):
    # 1. Verify OTP first
    success = OTPService.verify_otp(reset_in.mobile, reset_in.otp_code, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
        
    # 2. Update password
    user = db.query(User).filter(User.mobile == reset_in.mobile).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    user.password_hash = hash_password(reset_in.new_password)
    db.commit()
    return {"message": "Password reset successfully. You can now login."}


# --- Onboarding Details API ---

@router.put("/profile/personal-details")
def save_personal_details(
    details: PersonalDetailsCreate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    current_user.first_name = details.first_name
    current_user.last_name = details.last_name
    current_user.dob = details.dob
    current_user.gender = details.gender
    current_user.latitude = details.latitude
    current_user.longitude = details.longitude
    if details.profile_pic is not None:
        current_user.profile_pic = details.profile_pic
    
    # Store preferred playing time in about column as JSON or serialise it
    # We will use about/custom columns. Let's serialize playing times into user settings or about text
    # In order to store preferred playing times cleanly:
    # Let's save it to settings under a JSON or serialise. Since settings is a single table,
    # we can serialize playing times or save in user.about or settings push_enabled etc.
    # Actually, we can serialize it inside user's "about" field if we want, or make a JSON representation.
    # Let's write playing time in settings by mapping settings columns, or serialize inside about field
    # (e.g. "Playing Time: Morning, Evening").
    # Let's put a custom property or serialized string in user.about or let's store it as serialized JSON in users table about column.
    playing_time_str = ",".join(details.playing_time)
    current_user.about = f"Playing: {playing_time_str}"
    
    db.commit()
    return {"message": "Personal details saved successfully."}


@router.post("/profile/preferred-sports")
def save_preferred_sports(
    sports_in: PreferredSportsCreate, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    # 1. Clear old preferred sports
    db.query(PreferredSport).filter(PreferredSport.user_id == current_user.id).delete()
    
    # 2. Add new sports
    for sport in sports_in.sports:
        pref_sport = PreferredSport(user_id=current_user.id, sport_name=sport)
        db.add(pref_sport)
        
    db.commit()
    return {"message": "Preferred sports saved successfully."}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # Since JWT is stateless, logout on server is client deleting tokens.
    # We can return success.
    return {"message": "Logged out successfully."}
