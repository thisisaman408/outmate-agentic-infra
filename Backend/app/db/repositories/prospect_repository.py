from sqlalchemy.orm import Session
from app.db.models.prospect import Prospect
from typing import Dict, Optional

class ProspectRepository:

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[Prospect]:
        return db.query(Prospect).filter(Prospect.email == email).first()

    @staticmethod
    def create_or_update(
        db: Session,
        email: str,
        raw_data: Dict,
        provider_source: str,
        **kwargs
    ) -> Prospect:

        prospect = db.query(Prospect).filter(Prospect.email == email).first()

        if prospect:
            for key, value in kwargs.items():
                setattr(prospect, key, value)
            prospect.raw_data = raw_data
            prospect.provider_source = provider_source
        else:
            prospect = Prospect(
                email=email,
                raw_data=raw_data,
                provider_source=provider_source,
                **kwargs
            )
            db.add(prospect)

        db.commit()
        db.refresh(prospect)
        return prospect
