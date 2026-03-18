
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from uuid import uuid4
from datetime import datetime, timezone, timedelta
import logging

from sqlalchemy.orm import Session

from app.services.explorium_service import ExploriumService
from app.db.deps import get_db
from app.db.models.watcher import Watcher as WatcherModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["watchers"])

# ─────────────────────────────────────────
# Helper: ORM → dict (camelCase for frontend)
# ─────────────────────────────────────────
def watcher_to_dict(w: WatcherModel) -> Dict[str, Any]:
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "type": w.type,
        "status": w.status,
        "match_count": int(w.match_count or 0),
        "matchCount":  int(w.match_count or 0),
        "new_matches_count": 0,
        "newMatches": 0,
        "last_triggered_at": w.last_synced_at.isoformat() if w.last_synced_at else None,
        "lastTriggered":     w.last_synced_at.isoformat() if w.last_synced_at else None,
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "criteria": w.criteria or {},
        # Account
        "accountName":   w.account_name,
        "accountDomain": w.account_domain,
        # Lead
        "leadName":    w.lead_name,
        "leadTitle":   w.lead_title,
        "leadCompany": w.lead_company,
        "leadEmail":   w.lead_email,
        "prospect_id": w.prospect_id,
        "business_id": w.business_id,
        "triggers":    w.triggers or [],
        "recentUpdates": w.recent_updates or [],
        "matches": w.matches or [],
        "notificationSettings": w.notification_settings or {"email": True, "slack": False},
    }


class CreateWatcherRequest(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # 'event', 'account', 'lead'
    criteria: Optional[Dict[str, Any]] = None
    accountName: Optional[str] = None
    accountDomain: Optional[str] = None
    triggers: Optional[List[str]] = None
    leadName: Optional[str] = None
    leadTitle: Optional[str] = None
    leadCompany: Optional[str] = None
    leadEmail: Optional[str] = None
    notificationSettings: Optional[Dict[str, Any]] = None


@router.get("/")
async def list_watchers(type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(WatcherModel)
    if type:
        query = query.filter(WatcherModel.type == type)
    return [watcher_to_dict(w) for w in query.order_by(WatcherModel.created_at.desc()).all()]


@router.post("/event")
async def create_event_watcher(request: CreateWatcherRequest, db: Session = Depends(get_db)):
    wid = f"w-{uuid4().hex[:8]}"
    db_w = WatcherModel(
        id=wid,
        name=request.name,
        description=request.description,
        type="event",
        status="active",
        criteria=request.criteria or {},
        triggers=request.triggers or [],
        notification_settings=request.notificationSettings or {"email": True, "slack": False},
        match_count="0",
        recent_updates=[],
    )
    db.add(db_w); db.commit(); db.refresh(db_w)
    return watcher_to_dict(db_w)


@router.post("/account")
async def create_account_watcher(request: Dict[str, Any], db: Session = Depends(get_db)):
    wid = f"w-{uuid4().hex[:8]}"
    db_w = WatcherModel(
        id=wid,
        name=request.get("name", request.get("accountName", "Account Watcher")),
        description=request.get("description"),
        type="account",
        status="active",
        account_name=request.get("accountName"),
        account_domain=request.get("accountDomain"),
        triggers=request.get("triggers") or [],
        notification_settings=request.get("notificationSettings") or {"email": True, "slack": False},
        match_count="0",
        recent_updates=[],
    )
    db.add(db_w); db.commit(); db.refresh(db_w)
    return watcher_to_dict(db_w)


@router.post("/lead")
async def create_lead_watcher(request: Dict[str, Any], db: Session = Depends(get_db)):
    wid = f"w-{uuid4().hex[:8]}"
    db_w = WatcherModel(
        id=wid,
        name=request.get("name", request.get("leadName", "Lead Watcher")),
        description=request.get("description"),
        type="lead",
        status="active",
        lead_name=request.get("leadName"),
        lead_title=request.get("leadTitle"),
        lead_company=request.get("leadCompany"),
        lead_email=request.get("leadEmail"),
        triggers=request.get("triggers") or [],
        notification_settings=request.get("notificationSettings") or {"email": True, "slack": False},
        match_count="0",
        recent_updates=[],
    )
    db.add(db_w); db.commit(); db.refresh(db_w)
    return watcher_to_dict(db_w)


@router.post("/{id}/toggle")
async def toggle_watcher(id: str, db: Session = Depends(get_db)):
    db_w = db.query(WatcherModel).filter(WatcherModel.id == id).first()
    if not db_w:
        raise HTTPException(status_code=404, detail="Watcher not found")
    db_w.status = "paused" if db_w.status == "active" else "active"
    db.commit(); db.refresh(db_w)
    return watcher_to_dict(db_w)


@router.delete("/{id}")
async def delete_watcher(id: str, db: Session = Depends(get_db)):
    db_w = db.query(WatcherModel).filter(WatcherModel.id == id).first()
    if not db_w:
        raise HTTPException(status_code=404, detail="Watcher not found")
    db.delete(db_w); db.commit()
    return {"status": "success"}


@router.post("/{id}/sync")
async def sync_watcher(id: str, db: Session = Depends(get_db)):
    db_w = db.query(WatcherModel).filter(WatcherModel.id == id).first()
    if not db_w:
        raise HTTPException(status_code=404, detail="Watcher not found")

    svc = ExploriumService()
    w = watcher_to_dict(db_w)

    try:
        if w["type"] == "account":
            bid = db_w.business_id
            if not bid and w.get("accountDomain"):
                match_res = await svc.match_businesses([{"domain": w["accountDomain"], "name": w.get("accountName")}])
                matched = match_res.get("matched_businesses") or []
                if matched:
                    bid = matched[0].get("business_id")
                    db_w.business_id = bid

            updates = []
            if bid:
                try:
                    ts_from = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
                    ws_res = await svc.enrich_website_changes(bid, timestamp_from=ts_from)
                    ws_data = ws_res.get("data") or []
                    if isinstance(ws_data, dict):
                        ws_data = [ws_data]
                    for chg in ws_data:
                        desc = None
                        if isinstance(chg, dict):
                            desc = chg.get("change_description") or chg.get("summary")
                            if not desc:
                                inner = chg.get("data") or {}
                                if isinstance(inner, list):
                                    inner = inner[0] if inner else {}
                                desc = inner.get("change_description") or inner.get("change_implication")
                        if desc:
                            updates.append({
                                "id": f"web-{uuid4()}",
                                "type": "website_change",
                                "description": desc,
                                "date": chg.get("date", datetime.now(timezone.utc).isoformat())
                            })
                except Exception as e:
                    logger.error(f"Website changes failed: {e}")

            db_w.recent_updates = updates
            db_w.match_count = str(len(updates))

        elif w["type"] == "lead":
            prospect_id = db_w.prospect_id
            if not prospect_id:
                match_input = {}
                if db_w.lead_email:    match_input["email"] = db_w.lead_email
                if db_w.lead_name:     match_input["full_name"] = db_w.lead_name
                if db_w.lead_company:  match_input["company_name"] = db_w.lead_company
                if match_input:
                    try:
                        match_res = await svc.match_prospects([match_input])
                        matched = match_res.get("matched_prospects") or []
                        if matched and matched[0].get("prospect_id"):
                            prospect_id = matched[0].get("prospect_id")
                            db_w.prospect_id = prospect_id
                    except Exception as e:
                        logger.error(f"Lead match failed: {e}")

            updates = []
            if prospect_id:
                try:
                    raw_triggers = db_w.triggers or []
                    mapped = []
                    for t in raw_triggers:
                        if t == "job_change":
                            mapped.extend(["prospect_changed_role", "prospect_changed_company"])
                        elif t == "promotion":
                            mapped.append("prospect_changed_role")
                        elif t == "employee_joined_company":
                            mapped.append("prospect_changed_company")
                    if not mapped:
                        mapped = ["prospect_changed_role", "prospect_changed_company", "prospect_job_start_anniversary"]
                    else:
                        mapped = list(set(mapped))

                    events_res = await svc.fetch_prospect_events([prospect_id], mapped)
                    events_data = events_res.get("data", [])
                except Exception as e:
                    logger.error(f"Prospect events failed: {e}")
                    events_data = []

                for ev in events_data:
                    updates.append({
                        "id": f"pev-{ev.get('event_id') or uuid4()}",
                        "type": ev.get("event_type", "prospect_signal"),
                        "description": ev.get("event_description") or f"Activity: {ev.get('event_type')}",
                        "date": ev.get("event_timestamp", datetime.now(timezone.utc).isoformat())
                    })

                # Fallback: contact enrichment
                if not updates:
                    try:
                        info_res = await svc.bulk_enrich_contacts_information([prospect_id])
                        info_data = info_res.get("data", [])
                        logger.info(f">>> [Lead Sync] Got info_data length: {len(info_data)}")
                        if info_data:
                            contact_info = info_data[0].get("data") or info_data[0]
                            emails = contact_info.get("emails") or []
                            phones = contact_info.get("phone_numbers") or contact_info.get("mobile_phone") or []
                            if emails:
                                addr = emails[0].get("address") if isinstance(emails[0], dict) else emails[0]
                                email_type = emails[0].get("type", "professional") if isinstance(emails[0], dict) else "professional"
                                updates.append({
                                    "id": f"pev-c-{uuid4()}",
                                    "type": "contact_update",
                                    "description": f"Verified new contact information: {addr} ({email_type})",
                                    "date": datetime.now(timezone.utc).isoformat()
                                })
                                logger.info(">>> [Lead Sync] Appended email update.")
                            elif phones:
                                updates.append({
                                    "id": f"pev-c-{uuid4()}",
                                    "type": "contact_update",
                                    "description": "Verified new direct dial phone number.",
                                    "date": datetime.now(timezone.utc).isoformat()
                                })
                                logger.info(">>> [Lead Sync] Appended phone update.")
                            else:
                                logger.info(">>> [Lead Sync] No emails or phones found.")
                    except Exception as e:
                        logger.error(f"Fallback contact enrich failed: {e}")

            logger.info(f">>> [Lead Sync] Total updates: {len(updates)}")
            db_w.recent_updates = updates
            db_w.match_count = str(len(updates))

        elif w["type"] == "event" and w.get("criteria"):
            criteria = w.get("criteria") or {}
            if not criteria.get("event_type"):
                criteria["event_type"] = ["merger_and_acquisitions", "new_funding_round"]
            if "last_occurrence" not in criteria:
                criteria["last_occurrence"] = 90

            res = await svc.fetch_businesses(criteria, size=5, mode="full")
            data = res.get("data", [])

            matches = []
            for item in data:
                biz = svc.normalize_company(item)
                event_types = criteria.get("event_type", ["merger_and_acquisitions"])
                matches.append({
                    "id": f"match-{biz['id']}",
                    "company": {
                        "name": biz["name"],
                        "domain": biz["domain"],
                        "logo": biz["logo_url"] or f"https://api.dicebear.com/7.x/initials/svg?seed={biz['name'][:2]}"
                    },
                    "event": {
                        "type": event_types[0] if event_types else "Business Signal",
                        "description": biz["description"] or "Recent signal identified via Explorium Event Stream.",
                        "date": datetime.now(timezone.utc).isoformat()
                    },
                    "matchedAt": datetime.now(timezone.utc).isoformat()
                })

            db_w.matches = matches
            db_w.match_count = str(len(matches))

        # Trigger notifications
        recent = db_w.recent_updates or []
        if len(recent) > 0:
            await notify_updates(w, db_w)

        db_w.last_synced_at = datetime.now(timezone.utc)
        db.commit(); db.refresh(db_w)

        result = watcher_to_dict(db_w)
        return result

    except Exception as e:
        logger.error(f"Sync failed for watcher {id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def notify_updates(w: Dict[str, Any], db_w: WatcherModel = None):
    """Send notifications for new watcher updates."""
    notif = w.get("notificationSettings") or {}
    if db_w:
        notif = db_w.notification_settings or notif
    name = w.get("name", "Watcher Update")
    update_count = len(db_w.recent_updates or []) if db_w else w.get("newMatches", 0)

    if notif.get("email"):
        logger.info(f">>> [Notification] SENDING EMAIL for {name}: {update_count} updates found.")
        try:
            from app.services.gmail_service import GmailService
            gmail = GmailService()
            status = gmail.is_connected()
            if status.get("connected"):
                email = status["email"]
                await gmail.send_email(
                    to_email=email,
                    subject=f"Watcher Alert: {name}",
                    body=f"You have {update_count} new updates for your Watcher '{name}'.\nLog in to your dashboard to view the details.",
                    from_email=email
                )
                logger.info(f">>> [Notification] Email delivered to {email}")
            else:
                logger.info(f">>> [Notification] Gmail not connected. Skipping email for {name}.")
        except Exception as e:
            logger.error(f"Email notification failed: {e}")

    if notif.get("slack"):
        webhook_url = notif.get("webhook")
        if webhook_url:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=5) as client:
                    await client.post(webhook_url, json={"text": f"Watcher Alert: *{name}* found {update_count} new updates."})
            except Exception as e:
                logger.error(f"Slack notification failed: {e}")


@router.get("/gmail/status")
async def gmail_status():
    """Check Gmail connection status."""
    from app.services.gmail_service import GmailService
    svc = GmailService()
    return svc.is_connected()
