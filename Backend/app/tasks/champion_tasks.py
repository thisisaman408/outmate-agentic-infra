"""
Champion Job-Change Alert Tasks
================================
poll_champion_job_changes  — Celery Beat every 6 h.
    Fetches all active lead-type watchers with track_job_changes=True that have
    a linkedin_url and haven't been checked in the last 6 h.
    Processes in batches of 50; handles CrustData 429 with 30-min reschedule.

handle_champion_change  — Per-contact task dispatched by the poll.
    Generates a contextual re-engagement email, stores ChampionChangeEvent,
    fires an in-app notification.

classify_change  — Pure helper (also importable for tests).
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from difflib import SequenceMatcher
from typing import Optional

import httpx

from app.core.celery_app import celery_app
from app.core.config import settings

logger = logging.getLogger(__name__)

CRUSTDATA_ENRICH_URL = "https://api.crustdata.com/screener/person/enrich"
FUZZY_THRESHOLD = 0.80
ALERT_COOLDOWN_DAYS = 30
BATCH_SIZE = 50
STALE_HOURS = 6


# ─────────────────────────────────────────────────────────────────────────────
# Pure helpers
# ─────────────────────────────────────────────────────────────────────────────

def _similar(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def classify_change(
    prev_company: str,
    prev_title: str,
    new_company: str,
    new_title: str,
    watched_domains: list,
) -> Optional[str]:
    """
    Returns "left_account" | "joined_account" | "promoted" | None.
    None means no actionable change detected (fuzzy match above threshold or identical job).
    """
    company_changed = bool(new_company) and _similar(prev_company, new_company) < FUZZY_THRESHOLD
    title_changed   = bool(new_title)   and _similar(prev_title,   new_title)   < FUZZY_THRESHOLD

    if not company_changed and not title_changed:
        return None

    if not company_changed and title_changed:
        return "promoted"

    # Company changed — classify by watched_domains membership
    def _matches_watched(company: str) -> bool:
        if not company:
            return False
        c_lower = company.lower()
        for domain in watched_domains:
            d_lower = domain.lower().replace("www.", "").strip()
            if d_lower and (d_lower in c_lower or c_lower in d_lower):
                return True
        return False

    prev_watched = _matches_watched(prev_company)
    new_watched  = _matches_watched(new_company)

    if prev_watched and not new_watched:
        return "left_account"
    if new_watched and not prev_watched:
        return "joined_account"
    # Company changed but neither side is a watched domain — treat as left_account
    return "left_account"


# ─────────────────────────────────────────────────────────────────────────────
# CrustData sync call (Celery workers are synchronous)
# ─────────────────────────────────────────────────────────────────────────────

class _RateLimitError(Exception):
    pass


def _crustdata_enrich_batch(linkedin_urls: list) -> list:
    """
    Call CrustData /screener/person/enrich for up to 25 URLs at once.
    Returns list of profile dicts.
    Raises _RateLimitError on HTTP 429.
    """
    params = {
        "linkedin_profile_url": ",".join(linkedin_urls),
        "fields": "name,title,current_employers",
        "enrich_realtime": "false",
    }
    headers = {
        "Authorization": f"Token {settings.CRUSTDATA_API_KEY}",
        "Accept": "application/json",
    }
    resp = httpx.get(CRUSTDATA_ENRICH_URL, params=params, headers=headers, timeout=30.0)
    if resp.status_code == 429:
        raise _RateLimitError("CrustData 429")
    resp.raise_for_status()
    data = resp.json()
    return data if isinstance(data, list) else [data]


# ─────────────────────────────────────────────────────────────────────────────
# Task 1: Poll (Beat — every 6 hours)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=2, name="app.tasks.champion_tasks.poll_champion_job_changes")
def poll_champion_job_changes(self):
    """
    Celery Beat task — runs every 6 hours.
    Queries stale lead-type watchers, diffs CrustData profiles against stored
    snapshots, dispatches handle_champion_change for real job changes.
    """
    from sqlalchemy import distinct
    from app.db.session import SessionLocal
    from app.db.models.watcher import Watcher
    from app.db.models.champion_change_event import ChampionChangeEvent

    db = SessionLocal()
    try:
        stale_cutoff = datetime.now(timezone.utc) - timedelta(hours=STALE_HOURS)

        watchers = (
            db.query(Watcher)
            .filter(
                Watcher.type == "lead",
                Watcher.status == "active",
                Watcher.track_job_changes == True,  # noqa: E712
                Watcher.linkedin_url.isnot(None),
            )
            .filter(
                (Watcher.last_job_check_at == None) |  # noqa: E711
                (Watcher.last_job_check_at < stale_cutoff)
            )
            .all()
        )
        logger.info(f"[ChampionPoll] {len(watchers)} stale lead watchers to check")

        if not watchers:
            return

        # All watched account domains (for classify_change)
        domain_rows = (
            db.query(distinct(Watcher.account_domain))
            .filter(
                Watcher.type == "account",
                Watcher.status == "active",
                Watcher.account_domain.isnot(None),
            )
            .all()
        )
        watched_domains = [r[0] for r in domain_rows if r[0]]

        # CrustData supports up to 25 URLs per call; we batch by BATCH_SIZE (50)
        # and split each batch of 50 into two sub-batches of 25.
        for batch_start in range(0, len(watchers), BATCH_SIZE):
            batch = watchers[batch_start: batch_start + BATCH_SIZE]
            watcher_map = {w.linkedin_url: w for w in batch if w.linkedin_url}

            # Sub-batch into 25 for CrustData
            all_urls = list(watcher_map.keys())
            profiles: list = []
            for sub_start in range(0, len(all_urls), 25):
                sub_urls = all_urls[sub_start: sub_start + 25]
                try:
                    profiles.extend(_crustdata_enrich_batch(sub_urls))
                except _RateLimitError:
                    logger.warning("[ChampionPoll] CrustData 429 — rescheduling in 30 min")
                    raise self.retry(countdown=1800)
                except Exception as exc:
                    logger.error(f"[ChampionPoll] CrustData sub-batch failed: {exc}")
                    continue

            for profile in profiles:
                # CrustData returns query_linkedin_profile_urn_or_slug as list of slugs
                slugs = profile.get("query_linkedin_profile_urn_or_slug") or []
                slug = slugs[0] if slugs else None

                # Match slug back to watcher by checking if slug appears in the stored URL
                matched_watcher = None
                if slug:
                    for url, w in watcher_map.items():
                        if slug in url:
                            matched_watcher = w
                            break

                if not matched_watcher:
                    continue

                employers = profile.get("current_employers") or []
                new_company = employers[0].get("employer_name", "") if employers else ""
                new_title   = profile.get("title") or ""

                prev_company = matched_watcher.last_known_company or matched_watcher.lead_company or ""
                prev_title   = matched_watcher.last_known_title   or matched_watcher.lead_title   or ""

                change_type = classify_change(prev_company, prev_title, new_company, new_title, watched_domains)

                # Always update last_job_check_at
                matched_watcher.last_job_check_at = datetime.now(timezone.utc)

                if change_type:
                    # 30-day cooldown — check by watcher_id (per-contact proxy)
                    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(days=ALERT_COOLDOWN_DAYS)
                    recent = (
                        db.query(ChampionChangeEvent)
                        .filter(
                            ChampionChangeEvent.watcher_id == matched_watcher.id,
                            ChampionChangeEvent.detected_at >= cooldown_cutoff,
                        )
                        .first()
                    )
                    if recent:
                        logger.info(f"[ChampionPoll] Cooldown active for watcher {matched_watcher.id}")
                        db.commit()
                        continue

                    # Update snapshots before dispatching so a second poll won't re-fire
                    matched_watcher.last_known_company = new_company or prev_company
                    matched_watcher.last_known_title   = new_title   or prev_title
                    db.commit()

                    logger.info(
                        f"[ChampionPoll] Dispatching handle for watcher {matched_watcher.id}: "
                        f"{change_type} | '{prev_company}' → '{new_company}'"
                    )
                    handle_champion_change.delay(
                        watcher_id=matched_watcher.id,
                        contact_name=matched_watcher.lead_name or profile.get("name") or "",
                        contact_linkedin=matched_watcher.linkedin_url,
                        prev_company=prev_company,
                        prev_title=prev_title,
                        new_company=new_company,
                        new_title=new_title,
                        change_type=change_type,
                        user_id=str(matched_watcher.user_id),
                    )
                else:
                    db.commit()

    except self.MaxRetriesExceededError:
        raise
    except Exception as exc:
        logger.error(f"[ChampionPoll] Unexpected error: {exc}", exc_info=True)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# Task 2: Handle change (dispatched per-contact)
# ─────────────────────────────────────────────────────────────────────────────

@celery_app.task(bind=True, max_retries=2, name="app.tasks.champion_tasks.handle_champion_change")
def handle_champion_change(
    self,
    watcher_id: str,
    contact_name: str,
    contact_linkedin: str,
    prev_company: str,
    prev_title: str,
    new_company: str,
    new_title: str,
    change_type: str,
    user_id: str,
):
    """
    Per-contact task:
    1. Select the correct champion email prompt.
    2. Generate a re-engagement email via OpenRouterService.
    3. Store a ChampionChangeEvent row.
    4. Fire an in-app CopilotNotification.
    """
    import asyncio
    from app.db.session import SessionLocal
    from app.db.models.champion_change_event import ChampionChangeEvent
    from app.services.openrouter_service import OpenRouterService
    from app.services.copilot.prompts import (
        CHAMPION_LEFT_ACCOUNT_PROMPT,
        CHAMPION_JOINED_ACCOUNT_PROMPT,
        CHAMPION_PROMOTED_PROMPT,
    )

    db = SessionLocal()
    try:
        # 1. Build the system prompt with context filled in
        prompt_map = {
            "left_account":   CHAMPION_LEFT_ACCOUNT_PROMPT,
            "joined_account": CHAMPION_JOINED_ACCOUNT_PROMPT,
            "promoted":       CHAMPION_PROMOTED_PROMPT,
        }
        template = prompt_map.get(change_type, CHAMPION_LEFT_ACCOUNT_PROMPT)
        try:
            system_prompt = template.format(
                contact_name=contact_name or "there",
                prev_company=prev_company or "your previous company",
                prev_title=prev_title or "your previous role",
                new_company=new_company or "your new company",
                new_title=new_title or "your new role",
            )
        except KeyError:
            system_prompt = template  # template may use positional-style braces; skip format

        user_message = (
            f"Contact: {contact_name}\n"
            f"Previous company: {prev_company}\n"
            f"Previous title: {prev_title}\n"
            f"New company: {new_company}\n"
            f"New title: {new_title}\n"
            f"Change type: {change_type}\n\n"
            "Write the re-engagement email now."
        )

        # 2. Generate email (best-effort — store null if LLM fails)
        draft_email_json: Optional[str] = None
        try:
            svc = OpenRouterService()
            loop = asyncio.new_event_loop()
            try:
                draft_email_json = loop.run_until_complete(
                    svc.chat_completion_text(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        max_tokens=600,
                    )
                )
            finally:
                loop.close()
        except Exception as exc:
            logger.warning(f"[ChampionHandle] Email generation failed (non-fatal): {exc}")

        # 3. Store ChampionChangeEvent
        event = ChampionChangeEvent(
            id=f"cce-{uuid.uuid4().hex[:10]}",
            watcher_id=watcher_id,
            user_id=user_id,
            contact_name=contact_name,
            contact_linkedin=contact_linkedin,
            prev_company=prev_company,
            prev_title=prev_title,
            new_company=new_company,
            new_title=new_title,
            change_type=change_type,
            draft_email=draft_email_json,
            status="pending",
            is_read=False,
        )
        db.add(event)
        db.commit()

        # 4. Fire in-app notification
        change_labels = {
            "left_account":   (f"{contact_name} left {prev_company}",          "champion_move", "red"),
            "joined_account": (f"New champion at {new_company}: {contact_name}", "champion_move", "indigo"),
            "promoted":       (f"{contact_name} promoted to {new_title}",       "job_change",    "indigo"),
        }
        title, notif_type, priority = change_labels.get(
            change_type, (f"Job change: {contact_name}", "job_change", "indigo")
        )
        body_map = {
            "left_account":   f"{contact_name} left {prev_company} ({prev_title}) and joined {new_company} ({new_title}).",
            "joined_account": f"{contact_name} just joined {new_company} as {new_title}.",
            "promoted":       f"{contact_name} promoted from {prev_title} to {new_title} at {new_company}.",
        }

        try:
            from app.db.repositories.notification_repository import NotificationRepository
            repo = NotificationRepository(db)
            repo.create(
                user_id=user_id,
                type=notif_type,
                title=title,
                body=body_map.get(change_type, "Job change detected."),
                cta_url="/copilot?tab=champion-alerts",
                priority=priority,
                company=new_company or prev_company,
            )
        except Exception as exc:
            logger.warning(f"[ChampionHandle] Notification failed (non-fatal): {exc}")

        logger.info(
            f"[ChampionHandle] Event {event.id} stored for watcher {watcher_id}, "
            f"type={change_type}, '{prev_company}' → '{new_company}'"
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"[ChampionHandle] Error for watcher {watcher_id}: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=300)
    finally:
        db.close()
