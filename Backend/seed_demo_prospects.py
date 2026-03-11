import uuid
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models.prospect import Prospect
from app.db.models.company import Company
from datetime import datetime

def seed_demo_data():
    db = SessionLocal()
    try:
        # 1. Create a demo company first
        demo_company = Company(
            id=uuid.uuid4(),
            name="Innovatech Solutions",
            domain="innovatech.ai",
            industry="Software & Technology",
            description="Leading AI-driven analytics platform for B2B intelligence.",
            employee_count_range="201-500",
            headquarters_city="San Francisco",
            headquarters_country="USA",
            enriched=True
        )
        db.add(demo_company)
        db.flush() # Get the ID

        # 2. Add demo prospects
        prospects = [
            Prospect(
                id=uuid.uuid4(),
                company_id=demo_company.id,
                first_name="Sarah",
                last_name="Chen",
                full_name="Sarah Chen",
                email="sarah.chen@innovatech.ai",
                job_title="VP of Sales",
                seniority_level="VP",
                department="Sales",
                country="USA",
                city="San Francisco",
                linkedin_url="https://linkedin.com/in/sarahchen-demo",
                provider_source="Manual Seed",
                enriched=True,
                data_quality_score=95
            ),
            Prospect(
                id=uuid.uuid4(),
                company_id=demo_company.id,
                first_name="Marcus",
                last_name="Rodriguez",
                full_name="Marcus Rodriguez",
                email="marcus.r@innovatech.ai",
                job_title="Director of Engineering",
                seniority_level="Director",
                department="Engineering",
                country="USA",
                city="Austin",
                linkedin_url="https://linkedin.com/in/marcusr-demo",
                provider_source="Manual Seed",
                enriched=True,
                data_quality_score=92
            ),
            Prospect(
                id=uuid.uuid4(),
                company_id=demo_company.id,
                first_name="Elena",
                last_name="Petrova",
                full_name="Elena Petrova",
                email="elena.p@innovatech.ai",
                job_title="Head of Growth",
                seniority_level="Director",
                department="Marketing",
                country="UK",
                city="London",
                linkedin_url="https://linkedin.com/in/elenap-demo",
                provider_source="Manual Seed",
                enriched=True,
                data_quality_score=88
            )
        ]
        
        db.add_all(prospects)
        db.commit()
        print(f"SUCCESS: Seeded 1 company and {len(prospects)} prospects.")
        
    except Exception as e:
        db.rollback()
        print(f"ERROR: Seeding failed: {type(e).__name__}: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_data()
