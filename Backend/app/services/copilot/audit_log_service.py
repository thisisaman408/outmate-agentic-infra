"""AuditLogService — records every Co-Pilot action (single + orchestrated)."""

from __future__ import annotations

import time
import uuid
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.db.models.copilot_audit_log import CopilotAuditLog

logger = logging.getLogger(__name__)


class AuditLogService:
    """Persists Co-Pilot actions to copilot_audit_log for compliance and learning."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------ #
    # Write                                                                 #
    # ------------------------------------------------------------------ #

    def record(
        self,
        *,
        user_id: str,
        action_type: str,
        prospect_id: Optional[str] = None,
        company_name: Optional[str] = None,
        user_prompt: Optional[str] = None,
        plan: Optional[Dict] = None,
        steps_run: Optional[List[Dict]] = None,
        output: Optional[Dict] = None,
        status: str = "success",
        credits_used: int = 0,
        duration_ms: Optional[int] = None,
        enrichment_sources: Optional[List[str]] = None,
    ) -> CopilotAuditLog:
        """Insert a new audit row. Silently swallows DB errors so caller is never blocked."""
        try:
            entry = CopilotAuditLog(
                id=uuid.uuid4(),
                user_id=uuid.UUID(str(user_id)),
                prospect_id=self._safe_uuid(prospect_id),
                company_name=company_name,
                action_type=action_type,
                user_prompt=user_prompt,
                plan=plan,
                steps_run=steps_run,
                output=output,
                status=status,
                credits_used=credits_used,
                duration_ms=duration_ms,
                enrichment_sources=enrichment_sources,
            )
            self.db.add(entry)
            self.db.commit()
            self.db.refresh(entry)
            return entry
        except Exception as exc:
            logger.error("AuditLogService.record failed: %s", exc, exc_info=True)
            self.db.rollback()
            return None  # type: ignore[return-value]

    @staticmethod
    def _safe_uuid(value) -> Optional[uuid.UUID]:
        if not value:
            return None
        try:
            return uuid.UUID(str(value))
        except (ValueError, AttributeError):
            return None

    # ------------------------------------------------------------------ #
    # Read                                                                  #
    # ------------------------------------------------------------------ #

    def list_for_user(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[CopilotAuditLog]:
        """Return the most recent audit entries for a user (newest first)."""
        return (
            self.db.query(CopilotAuditLog)
            .filter(CopilotAuditLog.user_id == uuid.UUID(str(user_id)))
            .order_by(CopilotAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def get_by_id(self, entry_id: str) -> Optional[CopilotAuditLog]:
        """Fetch one audit entry by its UUID."""
        try:
            return (
                self.db.query(CopilotAuditLog)
                .filter(CopilotAuditLog.id == uuid.UUID(str(entry_id)))
                .first()
            )
        except Exception:
            return None

    def get_past_actions_for_prospect(
        self,
        user_id: str,
        prospect_id: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """Return last N actions for a prospect — used by ContextEngine."""
        rows = (
            self.db.query(CopilotAuditLog)
            .filter(
                CopilotAuditLog.user_id == uuid.UUID(str(user_id)),
                CopilotAuditLog.prospect_id == uuid.UUID(str(prospect_id)),
            )
            .order_by(CopilotAuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "action_type": r.action_type,
                "user_prompt": r.user_prompt,
                "status": r.status,
                "credits_used": r.credits_used,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
