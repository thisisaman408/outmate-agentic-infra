import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Literal, Optional


class CampaignDashboardService:
    def __init__(self):
        now = datetime.utcnow()
        self._sequences: List[Dict[str, Any]] = []
        self._campaigns: List[Dict[str, Any]] = []
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
        if self._sequences:
            seq = self._sequences[len(self._inbox_feed) % len(self._sequences)]
            title = f"{seq['name']} captured {seq['leads']} new leads"
            message = f"{seq['owner']} refreshed the {seq['status']} sequence · bounce {seq['bounce_rate']}% · sent {seq['sent']} touches"
            source = "Sequence monitor"
        else:
            title = "Inbox refreshed"
            message = "New activity added to your account."
            source = "Signal ingestion"
        entry = {
            "id": str(uuid.uuid4()),
            "title": title,
            "message": message,
            "timestamp": self._global_inbox_last.isoformat(),
            "source": source,
        }
        self._inbox_feed.insert(0, entry)
        return {"message": "Global Inbox refreshed", "last_refreshed": entry["timestamp"]}

    async def trigger_global_analytics(self) -> Dict[str, Any]:
        self._global_analytics_last = datetime.utcnow()
        total_leads = sum(c.get("leadsCount", 0) for c in self._campaigns)
        avg_open_rate = (
            sum(c.get("stats", {}).get("openRate", 0) for c in self._campaigns) / max(len(self._campaigns), 1)
        )
        avg_reply_rate = (
            sum(c.get("stats", {}).get("replyRate", 0) for c in self._campaigns) / max(len(self._campaigns), 1)
        )
        snapshots = [
            {
                "id": str(uuid.uuid4()),
                "label": "Leads captured",
                "value": f"{total_leads} open opportunities",
                "trend": "positive" if total_leads > 0 else "steady",
                "timestamp": self._global_analytics_last.isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Average open rate",
                "value": f"{avg_open_rate:.1f}%",
                "trend": "positive" if avg_open_rate >= 30 else "steady",
                "timestamp": self._global_analytics_last.isoformat(),
            },
            {
                "id": str(uuid.uuid4()),
                "label": "Average reply rate",
                "value": f"{avg_reply_rate:.1f}%",
                "trend": "positive" if avg_reply_rate >= 5 else "steady",
                "timestamp": self._global_analytics_last.isoformat(),
            },
        ]
        for snapshot in snapshots:
            self._analytics_feed.insert(0, snapshot)
        return {"message": "Global Analytics snapshot captured", "last_refreshed": snapshots[0]["timestamp"]}

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
