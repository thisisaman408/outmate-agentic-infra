"""
One-time script to seed the test SiteConfig (pixel key) into the database.
Run from the Backend/ directory:

    python scripts/seed_visitor_pixel.py

This creates the row that validates the pixel key used by the dashboard's
"Setup Tracking Pixel" snippet and the hardcoded test key in visitors/page.tsx.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import uuid
from app.db.session import SessionLocal
from app.db.models.visitor import SiteConfig

TEST_PIXEL_KEY = "outmate_test_key_123"
# Fixed org_id so repeated runs are idempotent
TEST_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")

def seed():
    db = SessionLocal()
    try:
        existing = db.query(SiteConfig).filter(SiteConfig.pixel_key == TEST_PIXEL_KEY).first()
        if existing:
            print(f"[OK] SiteConfig already exists — org_id={existing.org_id}, pixel_key={existing.pixel_key}")
            return

        config = SiteConfig(
            org_id=TEST_ORG_ID,
            pixel_key=TEST_PIXEL_KEY,
            domain="localhost",
        )
        db.add(config)
        db.commit()
        print(f"[CREATED] SiteConfig seeded:")
        print(f"  org_id    = {TEST_ORG_ID}")
        print(f"  pixel_key = {TEST_PIXEL_KEY}")
        print(f"  domain    = localhost")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
