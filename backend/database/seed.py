import sys
import os
# Add backend directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pymysql
from sqlalchemy import create_engine
from app.config.config import settings
from app.database.db import Base, SessionLocal
from app.models.models import User, Venue, Wallet, Settings
from app.utils.security import hash_password

def create_database_if_not_exists():
    """Connect to MySQL and create the database if it doesn't exist."""
    print("Connecting to MySQL server to check database...")
    # Parse username, password, host, port from DATABASE_URL
    # Defaulting to root with no password on localhost:3306
    connection = pymysql.connect(
        host="localhost",
        user="root",
        password="",
        port=3306
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("CREATE DATABASE IF NOT EXISTS sportcircle")
            print("Database 'sportcircle' verified/created successfully!")
    finally:
        connection.close()

def seed_data():
    db = SessionLocal()
    try:
        # 1. Seed featured venues
        print("Checking/seeding sports venues...")
        venue_count = db.query(Venue).count()
        if venue_count == 0:
            venues = [
                Venue(
                    name="HSR Sports Arena",
                    location="HSR Layout Sector 2, Bengaluru, Karnataka 560102",
                    latitude=12.9121,
                    longitude=77.6443,
                    sport="Football, Badminton, Basketball",
                    facilities="Parking, Washroom, Drinking Water, Night Lights, Locker Room",
                    rating=4.7,
                    price_per_hour=750.00,
                    image_url="https://images.unsplash.com/photo-1529900748604-07564a03e7a6?q=80&w=600"
                ),
                Venue(
                    name="Sarjapur Cricket Ground",
                    location="Sarjapur Main Rd, Carmelaram, Bengaluru, Karnataka 560035",
                    latitude=12.9082,
                    longitude=77.6835,
                    sport="Cricket, Kabaddi",
                    facilities="Parking, Cafeteria, Drinking Water, Equipment Rental",
                    rating=4.5,
                    price_per_hour=1200.00,
                    image_url="https://images.unsplash.com/photo-1531415080290-bc98545ab2ef?q=80&w=600"
                ),
                Venue(
                    name="Koramangala Badminton Hub",
                    location="80 Feet Rd, Koramangala 4th Block, Bengaluru, Karnataka 560034",
                    latitude=12.9348,
                    longitude=77.6245,
                    sport="Badminton, Table Tennis",
                    facilities="Washroom, Changing Rooms, Air Conditioning, Pro Shop",
                    rating=4.8,
                    price_per_hour=350.00,
                    image_url="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600"
                ),
                Venue(
                    name="Indiranagar Swim & Court",
                    location="100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038",
                    latitude=12.9634,
                    longitude=77.6412,
                    sport="Swimming, Tennis",
                    facilities="Parking, Washroom, Shower Rooms, Coaching Available",
                    rating=4.6,
                    price_per_hour=900.00,
                    image_url="https://images.unsplash.com/photo-1544698310-74ea9d1c8258?q=80&w=600"
                ),
            ]
            db.bulk_save_objects(venues)
            print("Featured venues seeded successfully!")
        else:
            print("Venues already seeded, skipping.")

        # 2. Seed default test user if not exists
        print("Checking/seeding default test user...")
        test_user = db.query(User).filter(User.username == "madhu_yadav").first()
        if not test_user:
            # Create user
            db_user = User(
                username="madhu_yadav",
                mobile="9876543210",
                password_hash=hash_password("Password@123"),
                first_name="Madhu",
                last_name="Yadav",
                dob="1998-05-15",
                gender="Male",
                latitude=12.9121,
                longitude=77.6443,
                about="Playing: Morning, Evening",
                profile_pic="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150"
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            
            # Setup wallet with starting balance
            db_wallet = Wallet(user_id=db_user.id, balance=1500.00)
            db.add(db_wallet)
            
            # Setup settings
            db_settings = Settings(user_id=db_user.id)
            db.add(db_settings)
            db.commit()
            print("Default test user 'madhu_yadav' seeded successfully!")
            print("Credentials -> Username: madhu_yadav / password: Password@123 / mobile: 9876543210")
        else:
            print("Test user already exists, skipping.")

    except Exception as e:
        print("Error during database seeding:", e)
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    try:
        create_database_if_not_exists()
        
        # Connect with sqlalchemy and synchronize schema
        print("Synchronizing schema tables...")
        engine = create_engine(settings.DATABASE_URL)
        Base.metadata.create_all(bind=engine)
        print("Schema tables synchronized successfully!")
        
        seed_data()
        print("Database setup completed successfully!")
    except Exception as err:
        print("Fatal error during database creation/migration:", err)
