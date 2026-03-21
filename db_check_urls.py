import os
import sys
import json

sys.path.append(os.path.abspath('Backend'))
from app.db.session import SessionLocal
# Import all models to avoid relationship errors
from app.db.models.user import User
from app.db.models.company import Company
from app.db.models.event_enrollment import EventEnrollment
from app.db.models.event_cache import EventCache

db = SessionLocal()
events = db.query(EventCache).filter_by(entity_type='prospect').limit(5).all()

for e in events:
    print("---")
    print(f"Name: {e.entity_name}")
    print(f"Type: {e.event_type}")
    print(f"Source URL DB: {e.source_url}")
    
    # Parse metadata to see if it holds a better URL
    meta = e.metadata_ if hasattr(e, 'metadata_') else getattr(e, 'metadata', {})
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except:
            pass
    print(f"Metadata url: {meta.get('url') if isinstance(meta, dict) else 'none'}")
