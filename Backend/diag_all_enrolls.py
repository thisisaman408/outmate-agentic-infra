from app.db.session import SessionLocal
from app.db.models.event_enrollment import EventEnrollment

def diag():
    db = SessionLocal()
    enrolls = db.query(EventEnrollment).all()
    with open('all_enrollments_final.txt', 'w') as f:
        for e in enrolls:
            f.write(f"ID: {e.entity_id}, Name: {e.entity_name}, Type: {e.entity_type}\n")
    print(f"Done. Wrote {len(enrolls)} enrollments.")

if __name__ == "__main__":
    diag()
