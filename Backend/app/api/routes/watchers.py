
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

router = APIRouter(
    prefix="/api/v1/watchers",
    tags=["watchers"]
)

# Alias router so legacy frontend bundles calling /api/watchers still work
legacy_router = APIRouter(
    tags=["watchers"]
)

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
        "criteria": {k: v for k, v in (w.criteria or {}).items() if v} if w.criteria else {},
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
            # Map frontend trigger names to Explorium event types
            _acct_trigger_map = {
                "Funding Events": ["new_funding_round", "new_investment"],
                "Website Content Changes": [],  # handled by enrich_website_changes
                "Job Changes": ["team_expansion", "team_reduction"],
                "Technology Changes": ["product_launch"],
                "News Mentions": ["merger_and_acquisitions", "ipo_announcement", "acquisition"],
                "Web Traffic Changes": [],  # handled by website traffic enrichment
                # Legacy API-style triggers
                "funding": ["new_funding_round", "new_investment"],
                "job_changes": ["team_expansion", "team_reduction"],
                "technology_changes": ["product_launch"],
                "news_mentions": ["merger_and_acquisitions", "ipo_announcement"],
            }
            raw_triggers = db_w.triggers or []

            bid = db_w.business_id
            if not bid and w.get("accountDomain"):
                try:
                    match_res = await svc.match_businesses([{"domain": w["accountDomain"], "name": w.get("accountName")}])
                    matched = match_res.get("matched_businesses") or []
                    if matched:
                        bid = matched[0].get("business_id")
                        db_w.business_id = bid
                        logger.info(f">>> [Account Sync] Matched business_id: {bid} for {w.get('accountDomain')}")
                except Exception as e:
                    logger.error(f"Business match failed for {w.get('accountDomain')}: {e}")

            updates = []
            if bid:
                # Build the set of Explorium event types from selected triggers
                api_event_types = set()
                wants_website_changes = False
                for t in raw_triggers:
                    mapped = _acct_trigger_map.get(t, [])
                    api_event_types.update(mapped)
                    if t in ("Website Content Changes", "Web Traffic Changes"):
                        wants_website_changes = True
                # If no specific triggers selected, fetch everything
                if not raw_triggers:
                    api_event_types = {"new_funding_round", "merger_and_acquisitions",
                                       "ipo_announcement", "team_expansion", "team_reduction"}
                    wants_website_changes = True

                # 1. Enroll the business for event monitoring (idempotent)
                if api_event_types:
                    try:
                        await svc.enroll_business_events([bid], list(api_event_types))
                        logger.info(f">>> [Account Sync] Enrolled {bid} for events: {api_event_types}")
                    except Exception as e:
                        logger.warning(f"Event enrollment failed (may already be enrolled): {e}")

                # 2. Fetch business events
                if api_event_types:
                    try:
                        ts_from = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
                        ev_res = await svc.fetch_business_events([bid], list(api_event_types), timestamp_from=ts_from)
                        ev_data = ev_res.get("data", [])
                        for ev in ev_data:
                            ev_type = ev.get("event_type", "business_signal")
                            updates.append({
                                "id": f"bev-{ev.get('event_id') or uuid4()}",
                                "type": ev_type,
                                "description": ev.get("event_description") or ev.get("description") or f"Signal: {ev_type.replace('_', ' ')}",
                                "date": ev.get("event_timestamp") or ev.get("timestamp") or datetime.now(timezone.utc).isoformat()
                            })
                    except Exception as e:
                        logger.error(f"Business events failed: {e}")

                # 3. Website changes
                if wants_website_changes or not updates:
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

                # 4. Use fetch_businesses as alternative event source
                if not updates and api_event_types:
                    try:
                        # Search for this specific company by domain with the selected event types
                        search_criteria = {
                            "event_type": list(api_event_types),
                            "last_occurrence": 365,
                            "company_name": w.get("accountName", ""),
                        }
                        res = await svc.fetch_businesses(search_criteria, size=3, mode="full")
                        data = res.get("data", [])
                        account_domain = (w.get("accountDomain") or "").lower()
                        for item in data:
                            biz = svc.normalize_company(item)
                            biz_domain = (biz.get("domain") or "").lower()
                            # Only include results matching this account
                            if account_domain and biz_domain and (account_domain in biz_domain or biz_domain in account_domain):
                                display_events = ", ".join(t.replace("_", " ") for t in api_event_types)
                                updates.append({
                                    "id": f"fb-{biz.get('id', uuid4())}",
                                    "type": "business_signal",
                                    "description": biz.get("description") or f"Recent activity detected: {display_events}",
                                    "date": datetime.now(timezone.utc).isoformat()
                                })
                    except Exception as e:
                        logger.error(f"Fetch businesses fallback failed: {e}")

                # 5. Firmographics as last resort
                if not updates:
                    selected_triggers_str = ", ".join(raw_triggers) if raw_triggers else "all activity"
                    updates.append({
                        "id": f"info-{uuid4()}",
                        "type": "monitoring",
                        "description": f"No recent {selected_triggers_str.lower()} detected for {w.get('accountName', 'this account')}. Monitoring is now active and will alert on new events.",
                        "date": datetime.now(timezone.utc).isoformat()
                    })
                    try:
                        fg_res = await svc.bulk_enrich_firmographics([bid])
                        fg_data = fg_res.get("data", [])
                        if fg_data:
                            raw_info = fg_data[0].get("data") or fg_data[0]
                            normalized = svc.normalize_company(raw_info)
                            name = normalized.get("name") or w.get("accountName", "Company")
                            industry = normalized.get("industry") or raw_info.get("linkedin_category") or raw_info.get("primary_industry") or ""
                            employees = (
                                normalized.get("employees")
                                or raw_info.get("number_of_employees")
                                or raw_info.get("employee_count")
                                or raw_info.get("linkedin_employee_count")
                                or ""
                            )
                            revenue = normalized.get("revenue") or raw_info.get("estimated_revenue") or ""
                            desc_parts = []
                            if industry:
                                desc_parts.append(f"Industry: {industry}")
                            if employees:
                                desc_parts.append(f"Employees: {employees}")
                            if revenue:
                                desc_parts.append(f"Revenue: {revenue}")
                            if desc_parts:
                                updates.append({
                                    "id": f"fg-{uuid4()}",
                                    "type": "company_profile",
                                    "description": f"{name} — {', '.join(desc_parts)}",
                                    "date": datetime.now(timezone.utc).isoformat()
                                })
                    except Exception as e:
                        logger.error(f"Firmographics fallback failed: {e}")
            else:
                logger.warning(f">>> [Account Sync] Could not match business for domain: {w.get('accountDomain')}")
                updates.append({
                    "id": f"info-{uuid4()}",
                    "type": "info",
                    "description": f"Could not find a matching business record for {w.get('accountDomain') or w.get('accountName', 'this account')}. Please verify the domain is correct.",
                    "date": datetime.now(timezone.utc).isoformat()
                })

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
                            logger.info(f">>> [Lead Sync] Matched prospect_id: {prospect_id}")
                    except Exception as e:
                        logger.error(f"Lead match failed: {e}")

            updates = []
            if prospect_id:
                # Map human-readable trigger names from frontend to Explorium event types
                trigger_map = {
                    "Role Change": ["prospect_changed_role"],
                    "Company Change": ["prospect_changed_company"],
                    "Job Anniversary": ["prospect_job_start_anniversary"],
                    "Content Published": ["prospect_changed_role"],
                    "Speaking Engagements": ["prospect_changed_role"],
                    "Social Media Activity": ["prospect_changed_role"],
                    # Legacy API-style triggers
                    "job_change": ["prospect_changed_role", "prospect_changed_company"],
                    "promotion": ["prospect_changed_role"],
                    "employee_joined_company": ["prospect_changed_company"],
                }
                raw_triggers = db_w.triggers or []
                mapped = []
                for t in raw_triggers:
                    mapped.extend(trigger_map.get(t, []))
                mapped = list(set(mapped)) if mapped else [
                    "prospect_changed_role", "prospect_changed_company", "prospect_job_start_anniversary"
                ]

                try:
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

                # Fallback: contact enrichment + lead profile
                if not updates:
                    # Add a note that no trigger events were detected yet
                    selected_triggers = ", ".join(raw_triggers) if raw_triggers else "all activity"
                    updates.append({
                        "id": f"pev-info-{uuid4()}",
                        "type": "monitoring",
                        "description": f"No recent {selected_triggers.lower()} events detected. Monitoring is active and will alert on new activity.",
                        "date": datetime.now(timezone.utc).isoformat()
                    })

                    # Enrich with contact info
                    try:
                        info_res = await svc.bulk_enrich_contacts_information([prospect_id])
                        info_data = info_res.get("data", [])
                        if info_data:
                            contact_info = info_data[0].get("data") or info_data[0]
                            emails = contact_info.get("emails") or []
                            phones = contact_info.get("phone_numbers") or contact_info.get("mobile_phone") or []
                            title = contact_info.get("title") or contact_info.get("job_title") or db_w.lead_title or ""
                            company = contact_info.get("company_name") or db_w.lead_company or ""

                            # Build a profile summary
                            profile_parts = []
                            if title:
                                profile_parts.append(f"Title: {title}")
                            if company:
                                profile_parts.append(f"Company: {company}")
                            if emails:
                                addr = emails[0].get("address") if isinstance(emails[0], dict) else emails[0]
                                profile_parts.append(f"Email: {addr}")
                            if phones:
                                phone = phones[0].get("number") if isinstance(phones[0], dict) else phones[0]
                                profile_parts.append(f"Phone: {phone}")

                            if profile_parts:
                                updates.append({
                                    "id": f"pev-c-{uuid4()}",
                                    "type": "lead_profile",
                                    "description": f"Enriched profile — {'; '.join(profile_parts)}",
                                    "date": datetime.now(timezone.utc).isoformat()
                                })
                    except Exception as e:
                        logger.error(f"Fallback contact enrich failed: {e}")
            else:
                lead_desc = db_w.lead_name or db_w.lead_email or "this lead"
                logger.warning(f">>> [Lead Sync] Could not match prospect for: {lead_desc}")
                updates.append({
                    "id": f"info-{uuid4()}",
                    "type": "info",
                    "description": f"Could not find a matching prospect record for {lead_desc}. Try adding an email address for better matching.",
                    "date": datetime.now(timezone.utc).isoformat()
                })

            logger.info(f">>> [Lead Sync] Total updates: {len(updates)}")
            db_w.recent_updates = updates
            db_w.match_count = str(len(updates))

        elif w["type"] == "event" and w.get("criteria"):
            criteria = w.get("criteria") or {}
            # Use the user-selected event types; only fall back when none were chosen
            user_event_types = criteria.get("event_type") or []
            if not user_event_types:
                user_event_types = ["New Funding Round", "Merger & Acquisitions"]
                criteria["event_type"] = user_event_types
            if "last_occurrence" not in criteria:
                criteria["last_occurrence"] = 90

            res = await svc.fetch_businesses(criteria, size=5, mode="full")
            data = res.get("data", [])

            matches = []
            for item in data:
                biz = svc.normalize_company(item)
                # Display the user's chosen event type(s), not the API identifier
                display_type = user_event_types[0] if user_event_types else "Business Signal"
                matches.append({
                    "id": f"match-{biz['id']}",
                    "company": {
                        "name": biz["name"],
                        "domain": biz["domain"],
                        "logo": biz["logo_url"] or f"https://api.dicebear.com/7.x/initials/svg?seed={biz['name'][:2]}"
                    },
                    "event": {
                        "type": display_type,
                        "description": biz["description"] or f"Recent {display_type.lower()} signal identified via Explorium Event Stream.",
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


# ─────────────────────────────────────────
# Legacy /api/watchers routes (no /v1/)
# Mirrors all endpoints above so older frontend bundles still work.
# Uses explicit full paths (no prefix) to avoid trailing-slash 404s
# since redirect_slashes=False in the FastAPI app.
# ─────────────────────────────────────────
legacy_router.get("/api/watchers")(list_watchers)
legacy_router.get("/api/watchers/")(list_watchers)
legacy_router.post("/api/watchers/event")(create_event_watcher)
legacy_router.post("/api/watchers/account")(create_account_watcher)
legacy_router.post("/api/watchers/lead")(create_lead_watcher)
legacy_router.post("/api/watchers/{id}/toggle")(toggle_watcher)
legacy_router.delete("/api/watchers/{id}")(delete_watcher)
legacy_router.post("/api/watchers/{id}/sync")(sync_watcher)
legacy_router.get("/api/watchers/gmail/status")(gmail_status)
