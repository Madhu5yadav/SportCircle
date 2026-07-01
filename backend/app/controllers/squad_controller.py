from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.db import get_db
from app.models.models import User, Squad, SquadMember, ChatRoom
from app.schemas.schemas import SquadCreate, SquadResponse, SquadMemberAdd, SquadMemberResponse
from app.middleware.auth import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Squads"])

@router.post("/create-squad", response_model=SquadResponse, status_code=status.HTTP_201_CREATED)
def create_squad(
    squad_in: SquadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Create Squad
    db_squad = Squad(name=squad_in.name, created_by=current_user.id)
    db.add(db_squad)
    db.commit()
    db.refresh(db_squad)
    
    # 2. Add Leader
    leader_member = SquadMember(squad_id=db_squad.id, user_id=current_user.id, role="leader")
    db.add(leader_member)
    
    # 3. Add other members
    for uid in squad_in.member_ids:
        if uid == current_user.id:
            continue
        member = SquadMember(squad_id=db_squad.id, user_id=uid, role="member")
        db.add(member)
        
        # Notify user they were added to a squad
        NotificationService.create_notification(
            user_id=uid,
            title="Squad Invitation",
            message=f"You have been added to the squad '{db_squad.name}' by {current_user.username}!",
            notif_type="squad_invite",
            db=db
        )
        
    # 4. Create a chat room for this squad
    db_chat_room = ChatRoom(
        name=f"Squad: {db_squad.name}",
        type="squad",
        squad_id=db_squad.id
    )
    db.add(db_chat_room)
    
    db.commit()
    return get_squad_details(db_squad.id, db)


@router.post("/add-squad-member/{squad_id}")
def add_member(
    squad_id: int,
    req: SquadMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    squad = db.query(Squad).filter(Squad.id == squad_id).first()
    if not squad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Squad not found"
        )
        
    # Check if user is the leader
    leader = db.query(SquadMember).filter(
        SquadMember.squad_id == squad_id,
        SquadMember.user_id == current_user.id,
        SquadMember.role == "leader"
    ).first()
    
    if not leader:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad leader can add members"
        )
        
    # Check if already a member
    existing = db.query(SquadMember).filter(
        SquadMember.squad_id == squad_id,
        SquadMember.user_id == req.user_id
    ).first()
    
    if existing:
        return {"message": "User is already a member of this squad"}
        
    # Add member
    db_member = SquadMember(squad_id=squad_id, user_id=req.user_id, role="member")
    db.add(db_member)
    db.commit()
    
    # Notify user
    NotificationService.create_notification(
        user_id=req.user_id,
        title="Added to Squad",
        message=f"You have been added to the squad '{squad.name}'!",
        notif_type="squad_invite",
        db=db
    )
    
    return {"message": "Member added successfully"}


@router.delete("/remove-squad-member/{squad_id}/{user_id}")
def remove_member(
    squad_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    squad = db.query(Squad).filter(Squad.id == squad_id).first()
    if not squad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Squad not found"
        )
        
    # Check permission: Caller must be the leader, OR they are removing themselves
    is_leader = db.query(SquadMember).filter(
        SquadMember.squad_id == squad_id,
        SquadMember.user_id == current_user.id,
        SquadMember.role == "leader"
    ).first() is not None
    
    if not is_leader and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the squad leader can remove other members"
        )
        
    # Find member
    member = db.query(SquadMember).filter(
        SquadMember.squad_id == squad_id,
        SquadMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Squad member not found"
        )
        
    if member.role == "leader":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove leader. Leave the squad instead."
        )
        
    db.delete(member)
    db.commit()
    
    # Notify user
    NotificationService.create_notification(
        user_id=user_id,
        title="Removed from Squad",
        message=f"You have been removed from the squad '{squad.name}'",
        notif_type="system",
        db=db
    )
    
    return {"message": "Member removed successfully"}


@router.delete("/leave-squad/{squad_id}")
def leave_squad(
    squad_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    squad = db.query(Squad).filter(Squad.id == squad_id).first()
    if not squad:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Squad not found"
        )
        
    member = db.query(SquadMember).filter(
        SquadMember.squad_id == squad_id,
        SquadMember.user_id == current_user.id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You are not a member of this squad"
        )
        
    if member.role == "leader":
        # If leader leaves, delete the entire squad (cascade deletes members and chats)
        db.delete(squad)
        db.commit()
        return {"message": "Left squad. Since you were the leader, the squad was disbanded."}
    else:
        db.delete(member)
        db.commit()
        
        # Notify leader
        NotificationService.create_notification(
            user_id=squad.created_by,
            title="Member Left Squad",
            message=f"{current_user.username} has left your squad '{squad.name}'",
            notif_type="system",
            db=db
        )
        return {"message": "Left squad successfully"}


@router.get("/squads", response_model=List[SquadResponse])
def get_user_squads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find all squads where current user is a member
    memberships = db.query(SquadMember).filter(SquadMember.user_id == current_user.id).all()
    squad_ids = [m.squad_id for m in memberships]
    
    squads = db.query(Squad).filter(Squad.id.in_(squad_ids)).all() if squad_ids else []
    return [get_squad_details(s.id, db) for s in squads]


# Helper to build SquadResponse schema
def get_squad_details(squad_id: int, db: Session) -> SquadResponse:
    squad = db.query(Squad).filter(Squad.id == squad_id).first()
    members = db.query(SquadMember).filter(SquadMember.squad_id == squad_id).all()
    
    members_list = []
    for m in members:
        members_list.append(SquadMemberResponse(
            user_id=m.user.id,
            username=m.user.username,
            profile_pic=m.user.profile_pic,
            role=m.role,
            joined_at=m.joined_at
        ))
        
    return SquadResponse(
        id=squad.id,
        name=squad.name,
        created_by=squad.created_by,
        created_at=squad.created_at,
        members=members_list
    )
