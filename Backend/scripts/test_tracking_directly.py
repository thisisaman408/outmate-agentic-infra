import asyncio
import uuid
from app.db.session import SessionLocal
from app.api.routes.visitors import track_visitor
from app.db.models.visitor import SiteConfig, Visit

async def test_tracking_logic():
    print("Testing tracking logic directly...")
    db = SessionLocal()
    try:
        # 1. Setup
        pixel_key = "outmate_test_key_123"
        site_config = db.query(SiteConfig).filter(SiteConfig.pixel_key == pixel_key).first()
        if not site_config:
            print("Creating test site config...")
            site_config = SiteConfig(
                org_id=uuid.uuid4(),
                pixel_key=pixel_key,
                domain="localhost"
            )
            db.add(site_config)
            db.commit()
            db.refresh(site_config)
        
        # 2. Call the tracking function logic (we'll simulate the endpoint call part)
        # Instead of calling the route which uses FastAPI Depends, we'll just do the logic
        ip = "8.8.8.8" # Google DNS IP for enrichment test
        url = "http://localhost:3000/pricing"
        
        from app.tasks.visitors import _process_visitor_data
        
        print(f"Simulating visitor process for IP: {ip}...")
        await _process_visitor_data(str(site_config.org_id), {
            "ip": ip,
            "url": url,
            "user_agent": "Mozilla/5.0 Test",
            "intent_score": 1.0
        })
        
        # 3. Verify
        visit = db.query(Visit).filter(Visit.ip == ip).order_by(Visit.created_at.desc()).first()
        if visit:
            print(f"SUCCESS: Visit recorded! ID: {visit.id}")
            print(f"Resolution: {visit.resolution}")
        else:
            print("FAILURE: Visit not found in DB.")
            
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_tracking_logic())
