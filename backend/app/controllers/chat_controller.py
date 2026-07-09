from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from typing import List, Optional
from datetime import datetime, timedelta
import json
from decimal import Decimal

from app.database.db import get_db
from app.models.models import User, ChatRoom, Message, Participant, SquadMember, Wallet, PaymentHistory
from app.schemas.schemas import ChatRoomResponse, MessageResponse, MessageCreate, PollVoteRequest, PaymentStatusUpdateRequest
from app.middleware.auth import get_current_user
from app.services.socket_service import broadcast_chat_message, sio

router = APIRouter(tags=["Chat"])

@router.get("/chat", response_model=List[ChatRoomResponse])
def get_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Find all game rooms user is participating in
    joined_games = db.query(Participant.game_id).filter(Participant.user_id == current_user.id).subquery()
    game_rooms = db.query(ChatRoom).filter(ChatRoom.game_id.in_(joined_games)).all()
    
    # 2. Find all squad rooms user is a member of
    joined_squads = db.query(SquadMember.squad_id).filter(SquadMember.user_id == current_user.id).subquery()
    squad_rooms = db.query(ChatRoom).filter(ChatRoom.squad_id.in_(joined_squads)).all()
    
    all_rooms = game_rooms + squad_rooms
    # Sort rooms by creation time in descending order (newest first)
    all_rooms.sort(key=lambda r: r.created_at or datetime.min, reverse=True)
    
    rooms_response = []
    for r in all_rooms:
        # Get last message
        last_msg = (
            db.query(Message)
            .filter(Message.chat_room_id == r.id)
            .order_by(Message.id.desc())
            .first()
        )
        
        last_msg_res = None
        if last_msg:
            last_msg_res = MessageResponse(
                id=last_msg.id,
                chat_room_id=last_msg.chat_room_id,
                sender_id=last_msg.sender_id,
                sender_username=last_msg.sender.username,
                sender_profile_pic=last_msg.sender.profile_pic,
                content=last_msg.content,
                image_url=last_msg.image_url,
                type=last_msg.type,
                created_at=last_msg.created_at
            )
            
        rooms_response.append(ChatRoomResponse(
            id=r.id,
            name=r.name,
            type=r.type,
            game_id=r.game_id,
            squad_id=r.squad_id,
            created_at=r.created_at,
            last_message=last_msg_res,
            game_date=r.game.game_date if (r.game_id and r.game) else None,
            start_time=r.game.start_time if (r.game_id and r.game) else None,
            end_time=r.game.end_time if (r.game_id and r.game) else None
        ))
        
    return rooms_response


@router.get("/chat/room/{room_id}", response_model=ChatRoomResponse)
def get_chat_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    # Check if participant in game/squad
    is_authorized = False
    if room.game_id:
        is_authorized = db.query(Participant).filter(
            Participant.game_id == room.game_id,
            Participant.user_id == current_user.id
        ).first() is not None
    elif room.squad_id:
        is_authorized = db.query(SquadMember).filter(
            SquadMember.squad_id == room.squad_id,
            SquadMember.user_id == current_user.id
        ).first() is not None
        
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view this chat room"
        )
        
    last_msg = (
        db.query(Message)
        .filter(Message.chat_room_id == room.id)
        .order_by(Message.id.desc())
        .first()
    )
    
    last_msg_res = None
    if last_msg:
        last_msg_res = MessageResponse(
            id=last_msg.id,
            chat_room_id=last_msg.chat_room_id,
            sender_id=last_msg.sender_id,
            sender_username=last_msg.sender.username,
            sender_profile_pic=last_msg.sender.profile_pic,
            content=last_msg.content,
            image_url=last_msg.image_url,
            type=last_msg.type,
            created_at=last_msg.created_at
        )
        
    return ChatRoomResponse(
        id=room.id,
        name=room.name,
        type=room.type,
        game_id=room.game_id,
        squad_id=room.squad_id,
        created_at=room.created_at,
        last_message=last_msg_res,
        game_date=room.game.game_date if (room.game_id and room.game) else None,
        start_time=room.game.start_time if (room.game_id and room.game) else None,
        end_time=room.game.end_time if (room.game_id and room.game) else None
    )


@router.get("/messages", response_model=List[MessageResponse])
def get_room_messages(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify user is in the room
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    # Check if participant in game/squad
    is_authorized = False
    if room.game_id:
        is_authorized = db.query(Participant).filter(
            Participant.game_id == room.game_id,
            Participant.user_id == current_user.id
        ).first() is not None
    elif room.squad_id:
        is_authorized = db.query(SquadMember).filter(
            SquadMember.squad_id == room.squad_id,
            SquadMember.user_id == current_user.id
        ).first() is not None
        
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to view messages in this chat"
        )
        
    messages = (
        db.query(Message)
        .filter(Message.chat_room_id == room_id)
        .order_by(Message.id.asc())
        .all()
    )
    
    formatted_messages = []
    for m in messages:
        formatted_messages.append(MessageResponse(
            id=m.id,
            chat_room_id=m.chat_room_id,
            sender_id=m.sender_id,
            sender_username=m.sender.username,
            sender_profile_pic=m.sender.profile_pic,
            content=m.content,
            image_url=m.image_url,
            type=m.type,
            poll_question=m.poll_question,
            poll_options=json.loads(m.poll_options) if m.poll_options else None,
            poll_votes=json.loads(m.poll_votes) if m.poll_votes else None,
            payment_amount=m.payment_amount,
            payment_status=m.payment_status,
            created_at=m.created_at
        ))
        
    return formatted_messages


@router.post("/chat", response_model=MessageResponse)
async def post_message(
    room_id: int,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    # Block chat if 10 mins past game start time
    if room.game_id and room.game:
        game_start_dt = datetime.combine(room.game.game_date, room.game.start_time)
        if datetime.now() > game_start_dt + timedelta(minutes=10):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Chatting is blocked as this game started more than 10 minutes ago"
            )
            
    # Serialize poll options / vote shells if present
    opts_json = None
    votes_json = None
    if msg_in.type == "poll" and msg_in.poll_options:
        opts_json = json.dumps(msg_in.poll_options)
        # Create empty vote list for each option
        empty_votes = {str(idx): [] for idx in range(len(msg_in.poll_options))}
        votes_json = json.dumps(empty_votes)
        
    db_msg = Message(
        chat_room_id=room_id,
        sender_id=current_user.id,
        content=msg_in.content,
        image_url=msg_in.image_url,
        type=msg_in.type,
        poll_question=msg_in.poll_question,
        poll_options=opts_json,
        poll_votes=votes_json,
        payment_amount=msg_in.payment_amount,
        payment_status="pending" if msg_in.type == "payment" else None
    )
    db.add(db_msg)
    db.commit()
    db.refresh(db_msg)
    
    # Format message response
    res = MessageResponse(
        id=db_msg.id,
        chat_room_id=db_msg.chat_room_id,
        sender_id=db_msg.sender_id,
        sender_username=current_user.username,
        sender_profile_pic=current_user.profile_pic,
        content=db_msg.content,
        image_url=db_msg.image_url,
        type=db_msg.type,
        poll_question=db_msg.poll_question,
        poll_options=msg_in.poll_options,
        poll_votes=json.loads(votes_json) if votes_json else None,
        payment_amount=db_msg.payment_amount,
        payment_status=db_msg.payment_status,
        created_at=db_msg.created_at
    )
    
    # Broadcast to Socket.IO room channel
    await broadcast_chat_message(room_id, {
        "id": res.id,
        "chat_room_id": res.chat_room_id,
        "sender_id": res.sender_id,
        "sender_username": res.sender_username,
        "sender_profile_pic": res.sender_profile_pic,
        "content": res.content,
        "image_url": res.image_url,
        "type": res.type,
        "poll_question": res.poll_question,
        "poll_options": opts_json, # Emit stringified version as stored
        "poll_votes": votes_json,
        "payment_amount": str(res.payment_amount) if res.payment_amount else None,
        "payment_status": res.payment_status,
        "created_at": res.created_at.isoformat()
    })
    
    return res


@router.post("/chat/poll-vote")
async def vote_poll(
    vote_in: PollVoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == vote_in.message_id).first()
    if not msg or msg.type != "poll":
        raise HTTPException(status_code=400, detail="Poll message not found")
        
    votes = json.loads(msg.poll_votes) if msg.poll_votes else {}
    opt_key = str(vote_in.option_index)
    
    if opt_key not in votes:
        votes[opt_key] = []
        
    # Toggle vote: remove if already present, else add
    if current_user.id in votes[opt_key]:
        votes[opt_key].remove(current_user.id)
    else:
        # Remove vote from any other option if single choice preferred,
        # but let's allow multi selection since sports platforms often ask preferences.
        # Toggling is standard
        votes[opt_key].append(current_user.id)
        
    msg.poll_votes = json.dumps(votes)
    db.commit()
    
    # Broadcast updated votes via Socket.IO
    await sio.emit(
        "poll_updated",
        {
            "roomId": msg.chat_room_id,
            "messageId": msg.id,
            "pollVotes": msg.poll_votes
        },
        room=f"chat_{msg.chat_room_id}"
    )
    
    return {"message": "Vote recorded", "votes": votes}


@router.post("/chat/pay-request")
async def pay_request(
    pay_in: PollVoteRequest, # Repurpose the schema with message_id
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == pay_in.message_id).first()
    if not msg or msg.type != "payment":
        raise HTTPException(status_code=400, detail="Payment request not found")
        
    if msg.payment_status == "paid":
        return {"message": "Already paid"}
        
    # 1. Check wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet or wallet.balance < msg.payment_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance"
        )
        
    # 2. Transact
    wallet.balance -= msg.payment_amount
    msg.payment_status = "paid"
    
    # Save transaction history
    history = PaymentHistory(
        user_id=current_user.id,
        amount=msg.payment_amount,
        type="debit",
        description=f"Paid request '{msg.content}' to @{msg.sender.username}"
    )
    db.add(history)
    
    # Add balance to request creator's wallet!
    creator_wallet = db.query(Wallet).filter(Wallet.user_id == msg.sender_id).first()
    if creator_wallet:
        creator_wallet.balance += msg.payment_amount
        # Log credit for request creator
        credit_history = PaymentHistory(
            user_id=msg.sender_id,
            amount=msg.payment_amount,
            type="credit",
            description=f"Received request payment from @{current_user.username}"
        )
        db.add(credit_history)
        
    db.commit()
    
    # Broadcast status change via Socket.IO
    await sio.emit(
        "payment_status_updated",
        {
            "roomId": msg.chat_room_id,
            "messageId": msg.id,
            "status": "paid"
        },
        room=f"chat_{msg.chat_room_id}"
    )
    
    return {"message": "Payment successful"}


@router.delete("/chat/exit/{room_id}")
def exit_chat(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Chat room not found")
        
    if room.game_id:
        participant = db.query(Participant).filter(
            Participant.game_id == room.game_id,
            Participant.user_id == current_user.id
        ).first()
        if participant:
            db.delete(participant)
            db.commit()
    elif room.squad_id:
        member = db.query(SquadMember).filter(
            SquadMember.squad_id == room.squad_id,
            SquadMember.user_id == current_user.id
        ).first()
        if member:
            db.delete(member)
            db.commit()
            
    return {"message": "Exited chat room successfully"}
