from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import socketio
import uvicorn

from app.config.config import settings
from app.database.db import engine, Base
from app.services.socket_service import sio

# Import Routers
from app.controllers import (
    auth_controller,
    game_controller,
    friend_controller,
    squad_controller,
    venue_controller,
    profile_controller,
    notification_controller,
    chat_controller
)

# 1. Create database tables if they do not exist
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables synchronized successfully!")
    
    # Run schema migrations
    from sqlalchemy import text
    with engine.connect() as conn:
        # Add role to users if not exists
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'player';"))
            conn.commit()
            print("Migration: Added role column to users table.")
        except Exception:
            pass
            
        # Add owner_id to venues if not exists
        try:
            conn.execute(text("ALTER TABLE venues ADD COLUMN owner_id INT DEFAULT NULL;"))
            conn.commit()
            conn.execute(text("ALTER TABLE venues ADD CONSTRAINT fk_venues_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE;"))
            conn.commit()
            print("Migration: Added owner_id column to venues table.")
        except Exception:
            pass

        # Add offer_details to venues if not exists
        try:
            conn.execute(text("ALTER TABLE venues ADD COLUMN offer_details VARCHAR(255) DEFAULT NULL;"))
            conn.commit()
            print("Migration: Added offer_details column to venues table.")
        except Exception:
            pass
except Exception as e:
    print("Error synchronizing database tables, please verify MySQL connectivity:", e)

# 2. Initialize FastAPI App
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Full-stack backend engine for SportCircle location-based community platform"
)

# Create uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# 3. Configure CORS Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Bind REST Routers
app.include_router(auth_controller.router)
app.include_router(game_controller.router)
app.include_router(friend_controller.router)
app.include_router(squad_controller.router)
app.include_router(venue_controller.router)
app.include_router(profile_controller.router)
app.include_router(notification_controller.router)
app.include_router(chat_controller.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "docs": "/docs"
    }

# 5. Wrap FastAPI App with Socket.IO ASGI Wrapper
# Exposes both HTTP rest queries and WebSockets under the same uvicorn process
app = socketio.ASGIApp(sio, other_asgi_app=app)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
