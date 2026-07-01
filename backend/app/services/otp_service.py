import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import OTPVerification

class OTPService:
    @staticmethod
    def generate_otp(mobile: str, db: Session) -> str:
        """Generate a 6-digit OTP, store in database, and simulate sending."""
        # Generate a random 6-digit code
        otp_code = f"{random.randint(100000, 999999)}"
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Save to database
        db_otp = OTPVerification(
            mobile=mobile,
            otp_code=otp_code,
            expires_at=expires_at,
            is_verified=False
        )
        db.add(db_otp)
        db.commit()
        
        # Simulate SMS by printing to terminal logs
        print("\n" + "="*50)
        print(f" SPORTCIRCLE SMS OTP FOR {mobile}: {otp_code}")
        print(f" Expires at: {expires_at} UTC")
        print("="*50 + "\n")
        
        return otp_code

    @staticmethod
    def verify_otp(mobile: str, otp_code: str, db: Session) -> bool:
        """Verify the OTP code for the mobile number."""
        # Get the latest active OTP for this mobile
        otp_record = (
            db.query(OTPVerification)
            .filter(
                OTPVerification.mobile == mobile,
                OTPVerification.otp_code == otp_code,
                OTPVerification.expires_at > datetime.utcnow(),
                OTPVerification.is_verified == False
            )
            .order_by(OTPVerification.id.desc())
            .first()
        )
        
        if not otp_record:
            return False
            
        otp_record.is_verified = True
        db.commit()
        return True
