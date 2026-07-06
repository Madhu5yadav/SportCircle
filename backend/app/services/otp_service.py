import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.models import OTPVerification
from app.config.config import settings

class OTPService:
    @staticmethod
    def generate_otp(mobile: str, db: Session) -> str:
        """Generate a 6-digit OTP, store in database, and send via Twilio if configured."""
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
        
        # Send real SMS if Twilio credentials are provided
        if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER:
            try:
                from twilio.rest import Client
                
                # Format to E.164 (defaults to +91 if exactly 10 digits without prefix)
                formatted_mobile = mobile
                if not mobile.startswith('+'):
                    if len(mobile) == 10:
                        formatted_mobile = f"+91{mobile}"
                    else:
                        formatted_mobile = f"+{mobile}"
                
                print(f"Sending real SMS via Twilio to {formatted_mobile}...")
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                message = client.messages.create(
                    body=f"[SportCircle] Your verification OTP code is: {otp_code}. Expires in 5 minutes.",
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=formatted_mobile
                )
                print(f"Twilio SMS sent successfully! SID: {message.sid}")
            except Exception as e:
                print(f"Error sending SMS via Twilio: {e}")
                print("Falling back to local simulation.")
        else:
            print("Twilio SMS integration not configured (Missing TWILIO_ACCOUNT_SID, AUTH_TOKEN, or PHONE_NUMBER in .env).")
            print("Falling back to local simulation.")
            
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
