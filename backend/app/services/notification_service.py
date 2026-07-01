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
        """Create a notification in the database and prepare for real-time dispatch."""
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
        
        # Trigger real-time push if socket server is running
        try:
            from app.services.socket_service import sio
            # Emit notification to the user's private socket channel
            # Running asynchronously or in-process
            sio.start_background_task(
                sio.emit,
                "notification",
                {
                    "id": db_notif.id,
                    "title": db_notif.title,
                    "message": db_notif.message,
                    "type": db_notif.type,
                    "is_read": db_notif.is_read,
                    "created_at": db_notif.created_at.isoformat()
                },
                to=f"user_{user_id}"
            )
        except Exception as e:
            # Socket.IO not initialized or user offline, silent failure is okay
            pass
            
        return db_notif
