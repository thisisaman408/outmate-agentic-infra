"company_repository.py"
from sqlalchemy.orm import Session
from typing import Dict, Optional
from app.db.models.company import Company
from sqlalchemy.exc import ProgrammingError
import logging
import json
logger = logging.getLogger(__name__)

class CompanyRepository:
    
    @staticmethod
    def get_by_domain(db: Session, domain: str) -> Optional[Company]:
        """Get company by domain, handling missing columns gracefully"""
        try:
            # Simple query with only basic columns
            return db.query(Company).filter(Company.domain == domain).first()
        except ProgrammingError as e:
            logger.warning(f"Query error for {domain}: {e}")
            return None
    
    @staticmethod
    def create_or_update(
        db: Session,
        domain: str,
        raw_data: Dict,
        provider_source: str,
        **kwargs
    ) -> Optional[Company]:
        """Create or update company with schema safety"""
        if not domain or domain.strip() == "":
            return None
        
        domain = domain.strip().lower()
        
        try:
            # Try the normal ORM approach first
            company = db.query(Company).filter(Company.domain == domain).first()
            
            if company:
                # Update only if value is not None
                for key, value in kwargs.items():
                    if value is not None:
                        try:
                            setattr(company, key, value)
                        except AttributeError:
                            # Column doesn't exist, skip it
                            pass
                
                # Always try to update these
                try:
                    company.raw_data = raw_data
                    company.provider_source = provider_source
                except AttributeError:
                    pass
                    
                db.commit()
                return company
            else:
                # Create new company - use only basic fields
                company = Company(
                    domain=domain,
                    name=kwargs.get('name', domain),
                    industry=kwargs.get('industry', ''),
                    website=kwargs.get('website', ''),
                    raw_data=raw_data,
                    provider_source=provider_source
                )
                db.add(company)
                db.commit()
                db.refresh(company)
                return company
                
        except Exception as e:
            db.rollback()
            logger.error(f"ORM approach failed for {domain}: {e}")
            
            # Try direct SQL with proper EXCLUDED syntax
            try:
                from sqlalchemy import text
                # Check if provider_source column exists
                result = db.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'companies' 
                    AND column_name = 'provider_source'
                """))
                
                has_provider_source = result.fetchone() is not None
                
                if has_provider_source:
                    # Use proper EXCLUDED syntax
                    db.execute(text("""
                        INSERT INTO companies (domain, name, provider_source, raw_data) 
                        VALUES (:domain, :name, :provider_source, CAST(:raw_data AS JSONB))
                        ON CONFLICT (domain) DO UPDATE 
                        SET name = EXCLUDED.name, 
                            provider_source = EXCLUDED.provider_source,
                            raw_data = EXCLUDED.raw_data
                    """), {
                        "domain": domain,
                        "name": kwargs.get('name', domain),
                        "provider_source": provider_source,
                        "raw_data": json.dumps(raw_data) if raw_data else '{}'
                    })
                else:
                    # Without provider_source column
                    db.execute(text("""
                        INSERT INTO companies (domain, name) 
                        VALUES (:domain, :name)
                        ON CONFLICT (domain) DO UPDATE 
                        SET name = EXCLUDED.name
                    """), {
                        "domain": domain,
                        "name": kwargs.get('name', domain)
                    })
                
                db.commit()
                
                # Return a minimal company object
                company = Company()
                company.domain = domain
                company.name = kwargs.get('name', domain)
                return company
                
            except Exception as sql_error:
                logger.error(f"SQL fallback also failed for {domain}: {sql_error}")
                db.rollback()
                return None