import asyncio
from sqlalchemy.orm import Session
from app.models.models import Notification

class NotificationService:
    @staticmethod
    def create_notification(
        user_id: int, 
        title: str, 
        message: str, 
        notif_type: str, 
        db: Session
    ) -> Notification:
        """Create a notification in the database and push via Socket.IO in real time."""
        db_notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notif_type,
            is_read=False
        )
        db.add(db_notif)
        db.commit()
        db.refresh(db_notif)
        
        # Push real-time notification via Socket.IO
        payload = {
            "id": db_notif.id,
            "title": db_notif.title,
            "message": db_notif.message,
            "type": db_notif.type,
            "is_read": db_notif.is_read,
            "created_at": db_notif.created_at.isoformat()
        }
        
        try:
            from app.services.socket_service import sio
            room = f"user_{user_id}"
            
            # Get or create event loop and schedule the coroutine
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # We're inside an async context (uvicorn), schedule as a task
                    asyncio.ensure_future(sio.emit("notification", payload, to=room))
                else:
                    loop.run_until_complete(sio.emit("notification", payload, to=room))
            except RuntimeError:
                # No event loop exists, create one
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(sio.emit("notification", payload, to=room))
                
            print(f"[NotificationService] Pushed real-time notification to {room}: {title}")
        except Exception as e:
            print(f"[NotificationService] Socket emit failed (user may be offline): {e}")
            
        return db_notif

