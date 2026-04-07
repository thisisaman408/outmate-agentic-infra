import asyncio
import uuid
from app.db.session import SessionLocal
from app.db.models.signal_event import SignalEvent
from app.tasks.sequence_tasks import _generate_signal_sequence

USER_ID = "0ba556e2-8457-418b-aff8-3ec70330bc8e"

db = SessionLocal()

# Create a test signal directly in the DB
signal = SignalEvent(
    id=uuid.uuid4(),
    signal_type="funding",
    source="test",
    company_domain="stripe.com",
    company_name="Stripe",
    prospect_name="John Collison",
    prospect_title="CEO",
    raw_data={"funding_amount": "$600M", "funding_round": "Series I"},
    icp_score=85,
    discovered_at=__import__("datetime").datetime.utcnow(),
)
db.add(signal)
db.commit()
db.refresh(signal)
print(f"Signal created: {signal.id}")
db.close()

# Run the sequence generation
asyncio.run(_generate_signal_sequence(signal_id=str(signal.id), user_id=USER_ID))
print("Done — check http://localhost:3000/copilot (Signal Drafts tab)")
