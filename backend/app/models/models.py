from sqlalchemy import Column, Integer, String, Date, Time, Double, Text, Boolean, ForeignKey, DateTime, DECIMAL, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    mobile = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(50), default=None)
    last_name = Column(String(50), default=None)
    dob = Column(Date, default=None)
    gender = Column(String(15), default=None)
    latitude = Column(Double, default=None)
    longitude = Column(Double, default=None)
    about = Column(Text, default=None)
    profile_pic = Column(Text, default=None)
    role = Column(String(20), default="player")
    trust_score = Column(Float, default=0.0)
    ratings_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    preferred_sports = relationship("PreferredSport", back_populates="user", cascade="all, delete-orphan")
    wallet = relationship("Wallet", uselist=False, back_populates="user", cascade="all, delete-orphan")
    settings = relationship("Settings", uselist=False, back_populates="user", cascade="all, delete-orphan")
    hosted_games = relationship("Game", back_populates="host", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("PaymentHistory", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class OTPVerification(Base):
    __tablename__ = "otp_verification"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(15), nullable=False)
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_verified = Column(Boolean, default=False)


class PreferredSport(Base):
    __tablename__ = "preferred_sports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sport_name = Column(String(50), nullable=False)
    level = Column(String(20), default="Beginner")

    user = relationship("User", back_populates="preferred_sports")


class Friend(Base):
    __tablename__ = "friends"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    created_at = Column(DateTime, default=datetime.utcnow)


class Squad(Base):
    __tablename__ = "squads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    members = relationship("SquadMember", back_populates="squad", cascade="all, delete-orphan")


class SquadMember(Base):
    __tablename__ = "squad_members"

    id = Column(Integer, primary_key=True, index=True)
    squad_id = Column(Integer, ForeignKey("squads.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), default="member")  # leader, member
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    joined_at = Column(DateTime, default=datetime.utcnow)

    squad = relationship("Squad", back_populates="members")
    user = relationship("User")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    sport_type = Column(String(50), nullable=False)
    location = Column(String(255), nullable=False)
    latitude = Column(Double, default=None)
    longitude = Column(Double, default=None)
    game_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    access = Column(String(15), default="public")  # public, private
    player_count = Column(Integer, nullable=False)
    entry_fee = Column(DECIMAL(10, 2), default=0.00)
    gender = Column(String(15), default="all")  # male, female, all
    equipment_required = Column(String(255), default=None)
    description = Column(Text, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)

    host = relationship("User", back_populates="hosted_games")
    participants = relationship("Participant", back_populates="game", cascade="all, delete-orphan")
    chat_rooms = relationship("ChatRoom", back_populates="game", cascade="all, delete-orphan")


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="joined")  # joined, waiting
    joined_at = Column(DateTime, default=datetime.utcnow)

    game = relationship("Game", back_populates="participants")
    user = relationship("User")


class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(255), nullable=False)
    latitude = Column(Double, default=None)
    longitude = Column(Double, default=None)
    sport = Column(String(50), nullable=False)
    facilities = Column(Text, default=None)  # comma separated
    rating = Column(Float, default=4.0)
    price_per_hour = Column(DECIMAL(10, 2), nullable=False)
    image_url = Column(String(255), default=None)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    offer_details = Column(String(255), default=None)
 
    bookings = relationship("Booking", back_populates="venue", cascade="all, delete-orphan")
    owner = relationship("User")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    booking_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    amount_paid = Column(DECIMAL(10, 2), nullable=False)
    status = Column(String(20), default="confirmed")  # confirmed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="SET NULL"), nullable=True)

    venue = relationship("Venue", back_populates="bookings")
    user = relationship("User", back_populates="bookings")
    game = relationship("Game")


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), default=None)
    type = Column(String(20), default="group")  # direct, group, game, squad
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), default=None)
    squad_id = Column(Integer, ForeignKey("squads.id", ondelete="CASCADE"), default=None)
    user1_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=None)
    user2_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), default=None)
    created_at = Column(DateTime, default=datetime.utcnow)

    game = relationship("Game", back_populates="chat_rooms")
    messages = relationship("Message", back_populates="chat_room", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, default=None)
    image_url = Column(String(255), default=None)
    type = Column(String(20), default="text")  # text, image, poll, payment
    poll_question = Column(String(255), default=None)
    poll_options = Column(Text, default=None)  # JSON-encoded array: ["Option 1", "Option 2"]
    poll_votes = Column(Text, default=None)  # JSON-encoded dictionary: {"0": [user_id, ...], "1": []}
    payment_amount = Column(DECIMAL(10, 2), default=None)
    payment_status = Column(String(20), default=None)  # pending, paid
    created_at = Column(DateTime, default=datetime.utcnow)

    chat_room = relationship("ChatRoom", back_populates="messages")
    sender = relationship("User")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)  # game_request, game_accepted, booking_confirm, booking_reminder, chat_message, friend_request, squad_invite, system
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    favorite_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Wallet(Base):
    __tablename__ = "wallet"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    balance = Column(DECIMAL(10, 2), default=1000.00)

    user = relationship("User", back_populates="wallet")


class PaymentHistory(Base):
    __tablename__ = "payment_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    type = Column(String(20), nullable=False)  # credit, debit
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="payments")


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    push_enabled = Column(Boolean, default=True)
    email_enabled = Column(Boolean, default=True)
    dark_mode = Column(Boolean, default=False)

    user = relationship("User", back_populates="settings")


class BookingAccessRequest(Base):
    __tablename__ = "booking_access_requests"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    game = relationship("Game")
    user = relationship("User")


class UserBlock(Base):
    __tablename__ = "user_blocks"

    id = Column(Integer, primary_key=True, index=True)
    blocker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # Booking, Wallet, Match, Account, Other
    status = Column(String(20), default="Open")  # Open, In Progress, Resolved
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
