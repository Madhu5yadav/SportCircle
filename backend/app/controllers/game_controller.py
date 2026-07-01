from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import date, time, datetime
from typing import List, Optional
from math import radians, cos, sin, asin, sqrt

from app.database.db import get_db
from app.models.models import User, Game, Participant, ChatRoom, Notification
from app.schemas.schemas import GameCreate, GameResponse, ParticipantResponse
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

    # 3. Create a chat room for this game
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
        joined_count = db.query(Participant).filter(Participant.game_id == g.id).count()
        is_joined = db.query(Participant).filter(
            Participant.game_id == g.id, 
            Participant.user_id == current_user.id
        ).first() is not None
        
        # Build participants list
        parts_list = []
        for p in g.participants:
            parts_list.append(ParticipantResponse(
                user_id=p.user.id,
                username=p.user.username,
                profile_pic=p.user.profile_pic,
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
        return {"message": "Already joined this game"}
        
    # Check slots available
    joined_count = db.query(Participant).filter(Participant.game_id == id).count()
    if joined_count >= game.player_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Game is already full"
        )
        
    # Join
    p = Participant(game_id=id, user_id=current_user.id)
    db.add(p)
    db.commit()
    
    # Broadcast count update via Socket.IO
    new_count = joined_count + 1
    await broadcast_game_joined_update(game.id, new_count, game.player_count)
    
    # Notify host
    if game.host_id != current_user.id:
        NotificationService.create_notification(
            user_id=game.host_id,
            title="Player Joined!",
            message=f"{current_user.username} joined your game '{game.name}'!",
            notif_type="game_accepted",
            db=db
        )
        
    return {"message": "Joined game successfully", "joined_count": new_count}


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
        
    if game.host_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Host cannot leave their own game. Delete or cancel instead."
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
        
    db.delete(existing)
    db.commit()
    
    # Broadcast count update
    joined_count = db.query(Participant).filter(Participant.game_id == id).count()
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


# Helper to construct full game details
def get_game_details(game_id: int, user: User, db: Session) -> Optional[GameResponse]:
    g = db.query(Game).filter(Game.id == game_id).first()
    if not g:
        return None
        
    joined_count = db.query(Participant).filter(Participant.game_id == g.id).count()
    is_joined = db.query(Participant).filter(
        Participant.game_id == g.id, 
        Participant.user_id == user.id
    ).first() is not None
    
    parts_list = []
    for p in g.participants:
        parts_list.append(ParticipantResponse(
            user_id=p.user.id,
            username=p.user.username,
            profile_pic=p.user.profile_pic,
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
        is_joined=is_joined,
        participants=parts_list
    )
