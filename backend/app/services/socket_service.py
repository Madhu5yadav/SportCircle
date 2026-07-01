import socketio
import json
from sqlalchemy.orm import Session
from app.database.db import SessionLocal
from app.models.models import User, Message, ChatRoom, Game, Participant
from datetime import datetime

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(
    async_mode="asgi", 
    cors_allowed_origins="*"
)

# Active connections map: user_id -> sid
user_connections = {}

@sio.event
async def connect(sid, environ):
    print(f"Socket connected: {sid}")
    # Extract query params for auth/user identity if available
    query_string = environ.get("QUERY_STRING", "")
    params = {}
    if query_string:
        for pair in query_string.split("&"):
            if "=" in pair:
                k, v = pair.split("=")
                params[k] = v
                
    user_id = params.get("userId")
    if user_id:
        try:
            uid = int(user_id)
            user_connections[uid] = sid
            # Join personal room for notifications
            await sio.enter_room(sid, f"user_{uid}")
            print(f"Registered user_{uid} to socket connection {sid}")
        except ValueError:
            pass

@sio.event
async def disconnect(sid):
    print(f"Socket disconnected: {sid}")
    # Remove from active connections
    for uid, conn_sid in list(user_connections.items()):
        if conn_sid == sid:
            del user_connections[uid]
            print(f"Removed user_{uid} from connection map")
            break

@sio.event
async def register(sid, data):
    """Client-driven registration of user_id to socket."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            pass
            
    user_id = data.get("userId") if isinstance(data, dict) else data
    if user_id:
        try:
            uid = int(user_id)
            user_connections[uid] = sid
            await sio.enter_room(sid, f"user_{uid}")
            print(f"Registered user_{uid} via register event")
            return {"status": "ok", "message": "Registered"}
        except ValueError:
            return {"status": "error", "message": "Invalid user ID"}

@sio.event
async def join_chat(sid, data):
    """Join a specific group/game/squad chat channel."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            pass
            
    room_id = data.get("roomId") if isinstance(data, dict) else data
    if room_id:
        room_name = f"chat_{room_id}"
        await sio.enter_room(sid, room_name)
        print(f"Socket {sid} joined room {room_name}")
        return {"status": "ok", "room": room_name}

@sio.event
async def leave_chat(sid, data):
    """Leave a specific chat channel."""
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            pass
            
    room_id = data.get("roomId") if isinstance(data, dict) else data
    if room_id:
        room_name = f"chat_{room_id}"
        await sio.leave_room(sid, room_name)
        print(f"Socket {sid} left room {room_name}")
        return {"status": "ok", "room": room_name}

@sio.event
async def typing_status(sid, data):
    """Broadcast typing indicator to others in the chat room."""
    room_id = data.get("roomId")
    user_id = data.get("userId")
    username = data.get("username")
    is_typing = data.get("isTyping", False)
    
    if room_id and user_id:
        await sio.emit(
            "user_typing",
            {
                "roomId": room_id,
                "userId": user_id,
                "username": username,
                "isTyping": is_typing
            },
            room=f"chat_{room_id}",
            skip_sid=sid
        )

@sio.event
async def mark_seen(sid, data):
    """Acknowledge reading of messages in a room."""
    room_id = data.get("roomId")
    user_id = data.get("userId")
    
    if room_id and user_id:
        # Broadcast that user has seen messages in room
        await sio.emit(
            "messages_seen",
            {
                "roomId": room_id,
                "userId": user_id,
                "seenAt": datetime.utcnow().isoformat()
            },
            room=f"chat_{room_id}",
            skip_sid=sid
        )

# Helper function to broadcast message to room
async def broadcast_chat_message(room_id: int, message_payload: dict):
    """Broadcast message to room_id subscribers."""
    await sio.emit("message", message_payload, room=f"chat_{room_id}")

# Helper function to broadcast game slots updates
async def broadcast_game_joined_update(game_id: int, joined_count: int, max_count: int):
    """Broadcast current slots left for a game to all maps/explore lists."""
    await sio.emit(
        "game_slots_updated",
        {
            "gameId": game_id,
            "joinedCount": joined_count,
            "maxCount": max_count,
            "slotsRemaining": max(0, max_count - joined_count)
        }
    )
