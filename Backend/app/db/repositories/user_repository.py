from sqlalchemy.orm import Session
from app.db.models.user import User
from typing import Optional

class UserRepository:

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id):
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create(db: Session, email: str) -> User:
        user = User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
