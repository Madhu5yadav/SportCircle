from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database.db import get_db
from app.models.models import User, SupportTicket
from app.schemas.schemas import TicketCreate, TicketResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/tickets", tags=["Support Tickets"])

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(
    ticket_in: TicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticket = SupportTicket(
        user_id=current_user.id,
        title=ticket_in.title,
        description=ticket_in.description,
        category=ticket_in.category,
        status="Open"
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("", response_model=List[TicketResponse])
def get_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tickets = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id).order_by(SupportTicket.created_at.desc()).all()
    return tickets
