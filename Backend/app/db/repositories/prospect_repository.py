from sqlalchemy.orm import Session
from app.db.models.prospect import Prospect
from typing import Dict, Optional

class ProspectRepository:

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[Prospect]:
        return db.query(Prospect).filter(Prospect.email == email).first()

    @staticmethod
    def get_by_external_id(db: Session, external_id: str) -> Optional[Prospect]:
        return db.query(Prospect).filter(Prospect.external_id == external_id).first()

    @staticmethod
    def get_by_linkedin_url(db: Session, linkedin_url: str) -> Optional[Prospect]:
        return db.query(Prospect).filter(Prospect.linkedin_url == linkedin_url).first()

    @staticmethod
    def create_or_update(
        db: Session,
        email: str,
        raw_data: Dict,
        provider_source: str,
        **kwargs
    ) -> Prospect:

        prospect = None
        if email:
            prospect = db.query(Prospect).filter(Prospect.email == email).first()

        if not prospect and kwargs.get('external_id'):
            prospect = db.query(Prospect).filter(Prospect.external_id == kwargs.get('external_id')).first()

        if not prospect and kwargs.get('linkedin_url'):
            prospect = db.query(Prospect).filter(Prospect.linkedin_url == kwargs.get('linkedin_url')).first()

        if prospect:
            for key, value in kwargs.items():
                try:
                    setattr(prospect, key, value)
                except Exception:
                    pass
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

    @staticmethod
    def create_or_update_by_keys(
        db: Session,
        keys: Dict[str, str],
        raw_data: Dict,
        provider_source: str,
        **kwargs
    ) -> Prospect:
        """Upsert prospect using durable keys: external_id, linkedin_url, email (in that order)."""
        prospect = None
        external_id = keys.get('external_id')
        linkedin_url = keys.get('linkedin_url')
        email = keys.get('email')

        if external_id:
            prospect = ProspectRepository.get_by_external_id(db, external_id)
        if not prospect and linkedin_url:
            prospect = ProspectRepository.get_by_linkedin_url(db, linkedin_url)
        if not prospect and email:
            prospect = ProspectRepository.get_by_email(db, email)

        if prospect:
            for key, value in kwargs.items():
                try:
                    setattr(prospect, key, value)
                except Exception:
                    pass
            prospect.raw_data = raw_data
            prospect.provider_source = provider_source
        else:
            prospect = Prospect(
                raw_data=raw_data,
                provider_source=provider_source,
                **kwargs
            )
            # attach keys if present
            if external_id:
                prospect.external_id = external_id
            if linkedin_url:
                prospect.linkedin_url = linkedin_url
            if email:
                prospect.email = email
            db.add(prospect)

        db.commit()
        db.refresh(prospect)
        return prospect
