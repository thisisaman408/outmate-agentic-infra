from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.visitor import Visit

def verify_visits():
    db = SessionLocal()
    try:
        visits = db.query(Visit).all()
        print(f"Total visits in DB: {len(visits)}")
        for v in visits:
            print(f"Visit ID: {v.id}, IP: {v.ip}, URL: {v.url}, Matched: {v.matched}")
            print(f"Resolution: {v.resolution}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_visits()
