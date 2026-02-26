import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.visitor import SiteConfig

def create_test_config():
    db = SessionLocal()
    try:
        # Check if exists
        pixel_key = "outmate_test_key_123"
        existing = db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
        if existing:
            print(f"Test config already exists for org {existing.org_id}")
            return
        
        new_config = SiteConfig(
            org_id=uuid.uuid4(),
            pixel_key=pixel_key,
            domain="localhost",
            icp_filters={"industries": ["Software", "SaaS"]},
            webhook_urls=["https://webhook.site/placeholder-url"] # Placeholder
        )
        db.add(new_config)
        db.commit()
        print(f"Created test config for org {new_config.org_id}")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_config()
