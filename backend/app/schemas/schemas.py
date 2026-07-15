from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import date, time, datetime
from decimal import Decimal

# --- OTP Schemas ---
class OTPSend(BaseModel):
    mobile: str = Field(..., description="Mobile number to send OTP to")

class OTPVerify(BaseModel):
    mobile: str
    otp_code: str

class OTPVerifyResponse(BaseModel):
    message: str
    verified: bool

class ForgotPasswordRequest(BaseModel):
    username_or_mobile: str

class LoginOTPRequest(BaseModel):
    username_or_mobile: str

class ResetPasswordRequest(BaseModel):
    mobile: str
    otp_code: str
    new_password: str

# --- User & Profile Schemas ---
class UserBase(BaseModel):
    username: str
    mobile: str

class UserCreate(BaseModel):
    username: str
    mobile: str
    password: str
    role: Optional[str] = "player"

class UserLogin(BaseModel):
    username_or_mobile: str
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: Optional[str] = "player"

class TokenRefresh(BaseModel):
    refresh_token: str

class PersonalDetailsCreate(BaseModel):
    first_name: str
    last_name: str
    dob: date
    gender: str
    playing_time: List[str]  # e.g., ["Morning", "Evening"]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    profile_pic: Optional[str] = None
    about: Optional[str] = None

class SportDetail(BaseModel):
    name: str
    level: str

class PreferredSportsCreate(BaseModel):
    sports: List[str]
    levels: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: int
    username: str
    mobile: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    about: Optional[str] = None
    profile_pic: Optional[str] = None
    role: str = "player"
    trust_score: float = 0.0
    ratings_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class PreferredSportResponse(BaseModel):
    sport_name: str
    class Config:
        from_attributes = True

class WalletResponse(BaseModel):
    balance: Decimal
    class Config:
        from_attributes = True

class PaymentHistoryResponse(BaseModel):
    id: int
    amount: Decimal
    type: str  # credit, debit
    description: str
    created_at: datetime
    class Config:
        from_attributes = True

class SettingsResponse(BaseModel):
    push_enabled: bool
    email_enabled: bool
    dark_mode: bool
    class Config:
        from_attributes = True

class ProfileResponse(BaseModel):
    user: UserResponse
    preferred_sports: List[str]
    preferred_sports_details: Optional[List[SportDetail]] = None
    playing_time: List[str]
    wallet: WalletResponse
    settings: SettingsResponse
    class Config:
        from_attributes = True

class PublicProfileUserResponse(BaseModel):
    id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    about: Optional[str] = None
    profile_pic: Optional[str] = None
    trust_score: float = 0.0
    ratings_count: int = 0
    created_at: datetime
    class Config:
        from_attributes = True

class PublicProfileResponse(BaseModel):
    user: PublicProfileUserResponse
    preferred_sports: List[str]
    preferred_sports_details: Optional[List[SportDetail]] = None
    playing_time: List[str]
    friendship_status: str
    friendship_id: Optional[int] = None
    mutual_friends_count: int
    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[date] = None
    gender: Optional[str] = None
    about: Optional[str] = None
    profile_pic: Optional[str] = None
    sports: Optional[List[str]] = None
    sports_levels: Optional[List[str]] = None
    playing_time: Optional[List[str]] = None

class WalletAddFunds(BaseModel):
    amount: Decimal

# --- Friends & Squad Schemas ---
class FriendResponse(BaseModel):
    friendship_id: int
    friend_id: int
    username: str
    mobile: str
    profile_pic: Optional[str] = None
    status: str
    created_at: datetime
    class Config:
        from_attributes = True

class FriendRequest(BaseModel):
    friend_id: int

class FriendRequestAction(BaseModel):
    friendship_id: int
    action: str  # accept, reject

class SquadCreate(BaseModel):
    name: str
    member_ids: List[int]

class SquadMemberResponse(BaseModel):
    user_id: int
    username: str
    profile_pic: Optional[str] = None
    role: str
    status: str = "pending"
    joined_at: datetime
    class Config:
        from_attributes = True

class SquadResponse(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    members: List[SquadMemberResponse]
    class Config:
        from_attributes = True

class SquadMemberAdd(BaseModel):
    user_id: int

class UserSearchResponse(BaseModel):
    id: int
    username: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    profile_pic: Optional[str] = None
    friendship_status: str  # none, pending_sent, pending_received, accepted
    friendship_id: Optional[int] = None
    mutual_friends_count: int
    class Config:
        from_attributes = True

# --- Game & Participant Schemas ---
class GameCreate(BaseModel):
    name: str
    sport_type: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    game_date: date
    start_time: time
    end_time: time
    access: str  # public, private
    player_count: int
    entry_fee: Decimal
    gender: str  # male, female, all
    equipment_required: Optional[str] = None
    description: Optional[str] = None
    squad_id: Optional[int] = None

class GameUpdate(BaseModel):
    name: Optional[str] = None
    sport_type: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    game_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    access: Optional[str] = None
    player_count: Optional[int] = None
    entry_fee: Optional[Decimal] = None
    gender: Optional[str] = None
    equipment_required: Optional[str] = None
    description: Optional[str] = None

class ParticipantResponse(BaseModel):
    user_id: int
    username: str
    profile_pic: Optional[str] = None
    status: str = "joined"  # joined, waiting
    joined_at: datetime
    class Config:
        from_attributes = True

class GameResponse(BaseModel):
    id: int
    host_id: int
    host_username: str
    host_profile_pic: Optional[str] = None
    name: str
    sport_type: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    game_date: date
    start_time: time
    end_time: time
    access: str
    player_count: int
    entry_fee: Decimal
    gender: str
    equipment_required: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    joined_count: int
    is_joined: Optional[bool] = False
    participants: List[ParticipantResponse] = []

    class Config:
        from_attributes = True

# --- Venue & Booking Schemas ---
class VenueResponse(BaseModel):
    id: int
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    sport: str
    facilities: Optional[str] = None
    rating: float
    price_per_hour: Decimal
    image_url: Optional[str] = None
    owner_id: Optional[int] = None
    offer_details: Optional[str] = None

    class Config:
        from_attributes = True

class VenueCreate(BaseModel):
    name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    sport: str
    facilities: Optional[str] = None
    price_per_hour: Decimal
    image_url: Optional[str] = None
    offer_details: Optional[str] = None

    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    venue_id: int
    booking_date: date
    start_time: time
    end_time: time
    amount_paid: Decimal
    game_id: Optional[int] = None
    payment_method: str = "wallet"

class BookingResponse(BaseModel):
    id: int
    venue: VenueResponse
    booking_date: date
    start_time: time
    end_time: time
    amount_paid: Decimal
    status: str
    created_at: datetime
    game_id: Optional[int] = None

    class Config:
        from_attributes = True

# --- Chat & Messaging Schemas ---
class MessageCreate(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    type: str = "text"  # text, image, poll, payment
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    payment_amount: Optional[Decimal] = None

class MessageResponse(BaseModel):
    id: int
    chat_room_id: int
    sender_id: int
    sender_username: str
    sender_profile_pic: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    type: str
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None
    poll_votes: Optional[dict] = None  # {option_index: [user_ids]}
    payment_amount: Optional[Decimal] = None
    payment_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ChatRoomResponse(BaseModel):
    id: int
    name: Optional[str] = None
    type: str  # direct, group, game, squad
    game_id: Optional[int] = None
    squad_id: Optional[int] = None
    created_at: datetime
    last_message: Optional[MessageResponse] = None
    game_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None

    class Config:
        from_attributes = True

class PollVoteRequest(BaseModel):
    message_id: int
    option_index: int

class PaymentStatusUpdateRequest(BaseModel):
    message_id: int
    status: str  # paid

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class RateUserRequest(BaseModel):
    rating: int


# --- Support Ticket Schemas ---
class TicketCreate(BaseModel):
    title: str
    description: str
    category: str

class TicketResponse(BaseModel):
    id: int
    title: str
    description: str
    category: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

