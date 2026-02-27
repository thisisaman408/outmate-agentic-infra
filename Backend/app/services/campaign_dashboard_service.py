import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Literal, Optional


class CampaignDashboardService:
    def __init__(self):
        self._sequences = []
        self._campaigns = []
        self._email_accounts = []
        self._blocklist = []
        self._global_inbox_last = None
        self._global_analytics_last = None
        self._inbox_feed = []
        self._analytics_feed = []

    async def list_sequences(self) -> List[Dict[str, Any]]:
        return self._sequences.copy()

    async def list_campaigns(self) -> List[Dict[str, Any]]:
        return self._campaigns.copy()

    async def create_campaign(
        self,
        name: str,
        objective: str,
        leads: List[str],
        schedule: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        campaign = {
            "id": str(uuid.uuid4()),
            "name": name,
            "status": "draft",
            "objective": objective,
            "message": "",
            "leads": leads,
            "leadsCount": len(leads),
            "stats": {
                "sent": 0,
                "opened": 0,
                "replied": 0,
                "bounced": 0,
                "openRate": 0,
                "replyRate": 0,
            },
            "schedule": schedule,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat(),
        }
        self._campaigns.insert(0, campaign)
        return campaign

    async def list_email_accounts(self) -> List[Dict[str, Any]]:
        return self._email_accounts.copy()

    async def add_email_account(self, email: str, provider: str) -> Dict[str, Any]:
        account = {
            "id": str(uuid.uuid4()),
            "email": email,
            "provider": provider,
            "connected_at": datetime.utcnow().isoformat(),
            "status": "Connected",
        }
        self._email_accounts.insert(0, account)
        return account

    async def list_blocklist(self) -> List[Dict[str, Any]]:
        return self._blocklist.copy()

    async def add_blocklist_entry(self, domain: str, reason: str, added_by: str) -> Dict[str, Any]:
        entry = {
            "id": str(uuid.uuid4()),
            "domain": domain,
            "reason": reason,
            "added_by": added_by,
            "added_at": datetime.utcnow().isoformat(),
        }
        self._blocklist.insert(0, entry)
        return entry

    async def trigger_global_inbox(self) -> Dict[str, Any]:
        self._global_inbox_last = datetime.utcnow()
        entry = {
            "id": str(uuid.uuid4()),
            "title": "Inbox refreshed",
            "message": "Detected new funding signal matching the active ICP.",
            "timestamp": self._global_inbox_last.isoformat(),
            "source": "Signal ingestion",
        }
        self._inbox_feed.insert(0, entry)
        return {"message": "Global Inbox refreshed", "last_refreshed": entry["timestamp"]}

    async def trigger_global_analytics(self) -> Dict[str, Any]:
        self._global_analytics_last = datetime.utcnow()
        snapshot = {
            "id": str(uuid.uuid4()),
            "label": "Funding velocity score",
            "value": "2.4x vs last 7 days",
            "trend": "positive",
            "timestamp": self._global_analytics_last.isoformat(),
        }
        self._analytics_feed.insert(0, snapshot)
        return {"message": "Global Analytics snapshot captured", "last_refreshed": snapshot["timestamp"]}

    async def get_global_inbox_feed(self) -> List[Dict[str, Any]]:
        return self._inbox_feed.copy()

    async def get_global_analytics_feed(self) -> List[Dict[str, Any]]:
        return self._analytics_feed.copy()

    async def update_campaign_status(self, campaign_id: str, status: Literal["draft", "running", "paused", "completed"]) -> Dict[str, Any]:
        for campaign in self._campaigns:
            if campaign["id"] == campaign_id:
                campaign["status"] = status
                campaign["updatedAt"] = datetime.utcnow().isoformat()
                if status == "running":
                    campaign["stats"]["sent"] += 5
                return campaign
        raise ValueError("Campaign not found")

    async def get_global_status(self) -> Dict[str, Optional[str]]:
        return {
            "inbox": self._global_inbox_last.isoformat() if self._global_inbox_last else None,
            "analytics": self._global_analytics_last.isoformat() if self._global_analytics_last else None,
        }
