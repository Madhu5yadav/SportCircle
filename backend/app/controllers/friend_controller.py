from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional

from app.database.db import get_db
from app.models.models import User, Friend, Favorite
from app.schemas.schemas import FriendResponse, FriendRequest, FriendRequestAction, UserSearchResponse
from app.middleware.auth import get_current_user
from app.services.notification_service import NotificationService

router = APIRouter(tags=["Friends"])

@router.post("/friend-request", status_code=status.HTTP_201_CREATED)
def send_friend_request(
    req: FriendRequest, 
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if req.friend_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot send a friend request to yourself"
        )
        
    # Check if target user exists
    target = db.query(User).filter(User.id == req.friend_id).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    # Check if request already exists (either direction)
    existing = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == req.friend_id),
            and_(Friend.user_id == req.friend_id, Friend.friend_id == current_user.id)
        )
    ).first()
    
    if existing:
        if existing.status == "accepted":
            return {"message": "You are already friends with this user"}
        elif existing.user_id == current_user.id:
            return {"message": "Friend request already sent, pending approval"}
        else:
            return {"message": "This user has already sent you a request, check pending invitations"}
            
    # Create request
    db_request = Friend(user_id=current_user.id, friend_id=req.friend_id, status="pending")
    db.add(db_request)
    db.commit()
    
    # Notify target user
    NotificationService.create_notification(
        user_id=req.friend_id,
        title="Friend Request",
        message=f"{current_user.username} sent you a friend request!",
        notif_type="friend_request",
        db=db
    )
    
    return {"message": "Friend request sent successfully"}


@router.put("/friend-request")
def action_friend_request(
    action_in: FriendRequestAction,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    request = db.query(Friend).filter(Friend.id == action_in.friendship_id).first()
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request record not found"
        )
        
    if request.friend_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to take action on this request"
        )
        
    if action_in.action == "accept":
        request.status = "accepted"
        db.commit()
        
        # Notify request sender
        NotificationService.create_notification(
            user_id=request.user_id,
            title="Friend Request Accepted",
            message=f"{current_user.username} accepted your friend request!",
            notif_type="friend_accepted",
            db=db
        )
        return {"message": "Friend request accepted"}
    elif action_in.action == "reject":
        request.status = "rejected"
        db.delete(request)  # Delete rejected invitations for database cleaning
        db.commit()
        return {"message": "Friend request rejected"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Use 'accept' or 'reject'"
        )


@router.get("/friends", response_model=List[FriendResponse])
def list_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find all friendships where status = 'accepted'
    friendships = db.query(Friend).filter(
        and_(
            or_(Friend.user_id == current_user.id, Friend.friend_id == current_user.id),
            Friend.status == "accepted"
        )
    ).all()
    
    friends_list = []
    for f in friendships:
        # Determine who the friend is
        friend_user_id = f.friend_id if f.user_id == current_user.id else f.user_id
        friend_user = db.query(User).filter(User.id == friend_user_id).first()
        
        if friend_user:
            friends_list.append(FriendResponse(
                friendship_id=f.id,
                friend_id=friend_user.id,
                username=friend_user.username,
                mobile=friend_user.mobile,
                profile_pic=friend_user.profile_pic,
                status=f.status,
                created_at=f.created_at
            ))
            
    return friends_list


@router.get("/friend-requests/pending", response_model=List[FriendResponse])
def list_pending_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Find requests received by current user that are pending
    friendships = db.query(Friend).filter(
        Friend.friend_id == current_user.id,
        Friend.status == "pending"
    ).all()
    
    pending_list = []
    for f in friendships:
        sender_user = db.query(User).filter(User.id == f.user_id).first()
        if sender_user:
            pending_list.append(FriendResponse(
                friendship_id=f.id,
                friend_id=sender_user.id,
                username=sender_user.username,
                mobile=sender_user.mobile,
                profile_pic=sender_user.profile_pic,
                status=f.status,
                created_at=f.created_at
            ))
            
    return pending_list


@router.post("/favorite/{friend_id}")
def toggle_favorite(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify they are friends first
    friendship = db.query(Friend).filter(
        and_(
            or_(
                and_(Friend.user_id == current_user.id, Friend.friend_id == friend_id),
                and_(Friend.user_id == friend_id, Friend.friend_id == current_user.id)
            ),
            Friend.status == "accepted"
        )
    ).first()
    
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only favorite accepted friends"
        )
        
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id,
        Favorite.favorite_user_id == friend_id
    ).first()
    
    if existing:
        db.delete(existing)
        db.commit()
        return {"message": "Friend removed from favorites", "is_favorite": False}
    else:
        fav = Favorite(user_id=current_user.id, favorite_user_id=friend_id)
        db.add(fav)
        db.commit()
        return {"message": "Friend added to favorites", "is_favorite": True}


@router.get("/favorites", response_model=List[FriendResponse])
def get_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    favs = db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
    fav_list = []
    
    for f in favs:
        friend_user = db.query(User).filter(User.id == f.favorite_user_id).first()
        # Find friendship record
        friendship = db.query(Friend).filter(
            or_(
                and_(Friend.user_id == current_user.id, Friend.friend_id == f.favorite_user_id),
                and_(Friend.user_id == f.favorite_user_id, Friend.friend_id == current_user.id)
            )
        ).first()
        
        if friend_user and friendship:
            fav_list.append(FriendResponse(
                friendship_id=friendship.id,
                friend_id=friend_user.id,
                username=friend_user.username,
                mobile=friend_user.mobile,
                profile_pic=friend_user.profile_pic,
                status=friendship.status,
                created_at=f.created_at
            ))
            
    return fav_list


@router.get("/users/search", response_model=List[UserSearchResponse])
def search_users(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not query.strip():
        return []
        
    # Search all users except current_user
    users = db.query(User).filter(
        and_(
            User.id != current_user.id,
            or_(
                User.username.like(f"%{query}%"),
                User.first_name.like(f"%{query}%"),
                User.last_name.like(f"%{query}%")
            )
        )
    ).limit(30).all()
    
    results = []
    for u in users:
        # Check friendship status
        friendship = db.query(Friend).filter(
            or_(
                and_(Friend.user_id == current_user.id, Friend.friend_id == u.id),
                and_(Friend.user_id == u.id, Friend.friend_id == current_user.id)
            )
        ).first()
        
        status_val = "none"
        friendship_id = None
        if friendship:
            friendship_id = friendship.id
            if friendship.status == "accepted":
                status_val = "accepted"
            elif friendship.status == "pending":
                if friendship.user_id == current_user.id:
                    status_val = "pending_sent"
                else:
                    status_val = "pending_received"
                    
        # Compute mutual friends
        # Find friends of current_user
        my_friend_ids = db.query(Friend.user_id).filter(
            and_(Friend.friend_id == current_user.id, Friend.status == "accepted")
        ).union(
            db.query(Friend.friend_id).filter(
                and_(Friend.user_id == current_user.id, Friend.status == "accepted")
            )
        ).all()
        my_friend_ids_set = {r[0] for r in my_friend_ids}
        
        # Find friends of user u
        u_friend_ids = db.query(Friend.user_id).filter(
            and_(Friend.friend_id == u.id, Friend.status == "accepted")
        ).union(
            db.query(Friend.friend_id).filter(
                and_(Friend.user_id == u.id, Friend.status == "accepted")
            )
        ).all()
        u_friend_ids_set = {r[0] for r in u_friend_ids}
        
        mutual_count = len(my_friend_ids_set.intersection(u_friend_ids_set))
        
        results.append(UserSearchResponse(
            id=u.id,
            username=u.username,
            first_name=u.first_name,
            last_name=u.last_name,
            profile_pic=u.profile_pic,
            friendship_status=status_val,
            friendship_id=friendship_id,
            mutual_friends_count=mutual_count
        ))
        
    return results


@router.delete("/friend/remove/{friend_id}")
def remove_friend_by_id(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    friendship = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == friend_id),
            and_(Friend.user_id == friend_id, Friend.friend_id == current_user.id)
        )
    ).first()
    
    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found"
        )
        
    db.delete(friendship)
    db.commit()
    return {"message": "Friend removed successfully"}

