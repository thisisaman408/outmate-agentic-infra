from collections import Counter
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse
import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.visitor_journey_sequence import VisitorJourneySequence


class JourneySequenceService:
    def _page_token(self, url: str, page_type: Optional[str] = None) -> str:
        if page_type:
            return str(page_type).strip().lower()
        try:
            path = (urlparse(url).path or "").lower()
        except Exception:
            path = str(url or "").lower()
        for token in ("pricing", "demo", "contact", "docs", "api", "security", "integrations", "comparison", "case-study", "blog", "features", "product", "about"):
            if token in path:
                return token
        return "other"

    def analyze_sequence(self, visit_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not visit_history:
            return {
                "sequence_type": "unknown",
                "page_sequence": [],
                "transition_summary": {},
                "metrics": {},
                "sequence_score": 0.0,
            }

        tokens: List[str] = []
        for visit in list(reversed(visit_history[-12:])):
            tokens.append(self._page_token(visit.get("url", ""), visit.get("page_type")))

        deduped_tokens: List[str] = []
        for token in tokens:
            if not deduped_tokens or deduped_tokens[-1] != token:
                deduped_tokens.append(token)

        transitions = Counter()
        for idx in range(len(deduped_tokens) - 1):
            transitions[f"{deduped_tokens[idx]}->{deduped_tokens[idx + 1]}"] += 1

        has_docs = any(t in deduped_tokens for t in ("docs", "api", "integrations", "security"))
        has_buying = any(t in deduped_tokens for t in ("pricing", "demo", "contact", "comparison"))
        has_research = any(t in deduped_tokens for t in ("features", "product", "case-study", "about"))
        repeat_depth = len(deduped_tokens)

        sequence_type = "casual_browse"
        score = 0.2
        if has_docs and has_buying:
            sequence_type = "technical_evaluation"
            score = 0.82
        elif has_research and has_buying:
            sequence_type = "buyer_evaluation"
            score = 0.74
        elif has_docs:
            sequence_type = "technical_research"
            score = 0.62
        elif has_buying:
            sequence_type = "commercial_intent"
            score = 0.66
        elif repeat_depth >= 4:
            sequence_type = "active_research"
            score = 0.54

        return {
            "sequence_type": sequence_type,
            "page_sequence": deduped_tokens[:10],
            "transition_summary": dict(transitions.most_common(8)),
            "metrics": {
                "has_docs": has_docs,
                "has_buying": has_buying,
                "has_research": has_research,
                "sequence_depth": repeat_depth,
            },
            "sequence_score": round(score, 2),
        }

    def load_sequence(
        self,
        db: Session,
        *,
        org_id: str,
        visitor_id: Optional[str] = None,
        fingerprint: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Optional[VisitorJourneySequence]:
        filters = []
        if visitor_id:
            filters.append(VisitorJourneySequence.visitor_id == str(visitor_id))
        if fingerprint:
            filters.append(VisitorJourneySequence.fingerprint == str(fingerprint))
        if session_id:
            filters.append(VisitorJourneySequence.session_id == str(session_id))
        if not filters:
            return None
        return (
            db.query(VisitorJourneySequence)
            .filter(
                VisitorJourneySequence.org_id == uuid.UUID(org_id),
                or_(*filters),
            )
            .order_by(VisitorJourneySequence.last_seen_at.desc())
            .first()
        )

    def upsert_sequence(
        self,
        db: Session,
        *,
        org_id: str,
        visitor_id: Optional[str],
        fingerprint: Optional[str],
        session_id: Optional[str],
        company_domain: Optional[str],
        analysis: Dict[str, Any],
    ) -> VisitorJourneySequence:
        sequence = self.load_sequence(
            db,
            org_id=org_id,
            visitor_id=visitor_id,
            fingerprint=fingerprint,
            session_id=session_id,
        )
        if not sequence:
            sequence = VisitorJourneySequence(org_id=uuid.UUID(org_id))
            db.add(sequence)

        if visitor_id:
            sequence.visitor_id = str(visitor_id)
        if fingerprint:
            sequence.fingerprint = str(fingerprint)
        if session_id:
            sequence.session_id = str(session_id)
        if company_domain:
            sequence.company_domain = company_domain

        sequence.sequence_type = analysis.get("sequence_type")
        sequence.page_sequence = analysis.get("page_sequence") or []
        sequence.transition_summary = analysis.get("transition_summary") or {}
        sequence.metrics = analysis.get("metrics") or {}
        sequence.event_count = int(sequence.event_count or 0) + 1
        return sequence
