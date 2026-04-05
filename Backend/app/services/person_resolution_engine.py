import hashlib
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models.anonymous_visitor_profile import AnonymousVisitorProfile
from app.db.models.company_visitor_memory import CompanyVisitorMemory
from app.db.models.office_ip_cluster import OfficeIpCluster
from app.services.person_resolution_learning_service import PersonResolutionLearningService
from app.services.behavioral_scoring import TITLE_TO_PERSONA


class PersonResolutionEngine:
    """
    Anonymous visitor person-resolution layer.

    This engine does not claim deterministic identity for pure anonymous traffic.
    Instead, it ranks candidate employees and returns an explainable confidence
    object that the caller can keep separate from verified identities.
    """

    def load_profile(
        self,
        db: Session,
        *,
        org_id: str,
        visitor_id: Optional[str] = None,
        fingerprint: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Optional[AnonymousVisitorProfile]:
        filters = []
        if visitor_id:
            filters.append(AnonymousVisitorProfile.visitor_id == str(visitor_id))
        if fingerprint:
            filters.append(AnonymousVisitorProfile.fingerprint == str(fingerprint))
        if session_id:
            filters.append(AnonymousVisitorProfile.session_id == str(session_id))
        if not filters:
            return None
        return (
            db.query(AnonymousVisitorProfile)
            .filter(
                AnonymousVisitorProfile.org_id == uuid.UUID(org_id),
                or_(*filters),
            )
            .order_by(AnonymousVisitorProfile.last_seen_at.desc())
            .first()
        )

    def resolve(
        self,
        *,
        db: Session,
        org_id: str,
        resolution: Dict[str, Any],
        behavioral: Optional[Dict[str, Any]] = None,
        profile: Optional[AnonymousVisitorProfile] = None,
        company_memory: Optional[CompanyVisitorMemory] = None,
        office_cluster: Optional[OfficeIpCluster] = None,
    ) -> Dict[str, Any]:
        current_person = resolution.get("person_identification") or {}
        if current_person.get("status") == "verified":
            return {
                "status": "verified",
                "confidence": float(current_person.get("confidence") or 0.99),
                "method": current_person.get("method") or "verified",
                "likely_persona": (behavioral or {}).get("predicted_persona") or None,
                "evidence": ["deterministic_first_party_identity"],
                "contradictions": [],
                "top_candidates": [],
                "promote_to_ui": True,
            }

        candidates = list(resolution.get("employees") or resolution.get("decision_makers") or [])
        company = (resolution.get("company") or "").strip().lower()
        domain = (resolution.get("domain") or "").strip().lower()
        geo = resolution.get("geo") or {}
        persona = ((behavioral or {}).get("predicted_persona") or "unknown").lower()
        persona_conf = float((behavioral or {}).get("persona_confidence") or 0.0)
        engagement = float((behavioral or {}).get("engagement_score") or 0.0)
        company_conf = float(resolution.get("confidence") or 0.0)
        repeat_visits = int(getattr(profile, "visit_count", 0) or 0)
        profile_data = getattr(profile, "profile_data", {}) or {}
        prior_candidates = profile_data.get("prior_candidate_keys") or []
        revealed_people = list(getattr(company_memory, "revealed_people", []) or [])
        suppressed_candidates = list(getattr(company_memory, "suppressed_candidates", []) or [])
        buying_committee_size = int(getattr(company_memory, "buying_committee_size", 0) or 0)
        account_intelligence = ((getattr(company_memory, "evidence", {}) or {}).get("account_intelligence") or {})
        account_score = float(account_intelligence.get("account_score") or 0.0)
        role_coverage = list(getattr(company_memory, "role_coverage", []) or [])
        unique_visitor_count = int(account_intelligence.get("unique_visitor_count") or 0)
        office_cluster_conf = float(getattr(office_cluster, "confidence", 0.0) or 0.0)
        office_verified = int(getattr(office_cluster, "verified_reveal_count", 0) or 0)
        journey_sequence = resolution.get("journey_sequence") or {}
        sequence_type = str(journey_sequence.get("sequence_type") or "").strip().lower()
        sequence_score = float(journey_sequence.get("sequence_score") or 0.0)
        learning = PersonResolutionLearningService()
        learning_features = []
        if domain:
            learning_features.append(("company_domain", domain))
        if persona and persona != "unknown":
            learning_features.append(("persona", persona))
        if resolution.get("page_type"):
            learning_features.append(("page_type", str(resolution.get("page_type")).strip().lower()))
        if resolution.get("last_outbound_domain"):
            learning_features.append(("outbound_domain", str(resolution.get("last_outbound_domain")).strip().lower()))
        if office_cluster_conf >= 0.5:
            learning_features.append(("office_cluster", domain or "present"))
        if repeat_visits >= 2:
            learning_features.append(("repeat_visits", "2_plus"))
        if sequence_type and sequence_type != "unknown":
            learning_features.append(("sequence_type", sequence_type))
        for page_type in list(profile_data.get("page_types") or [])[:5]:
            cleaned = str(page_type).strip().lower()
            if cleaned:
                learning_features.append(("profile_page_type", cleaned))
        learned_signal = learning.get_learned_signal(db, org_id=org_id, features=learning_features)
        suppressed_candidate_keys = {
            (item.get("candidate_key") or "").strip().lower()
            for item in suppressed_candidates
            if item.get("candidate_key")
        }

        evidence: List[str] = []
        contradictions: List[str] = []
        score_components: List[Dict[str, Any]] = []
        if repeat_visits >= 2:
            evidence.append("repeat_anonymous_visitor")
            score_components.append({"reason": "repeat_anonymous_visitor", "impact": round(min(repeat_visits * 0.03, 0.12), 3)})
        if company_conf >= 0.55 and (company or domain):
            evidence.append("company_resolved")
            score_components.append({"reason": "company_resolved", "impact": round(min(company_conf * 0.12, 0.12), 3)})
        if persona != "unknown" and persona_conf >= 0.35:
            evidence.append(f"persona:{persona}")
            score_components.append({"reason": f"persona:{persona}", "impact": round(min(persona_conf * 0.18, 0.18), 3)})
        if engagement >= 35:
            evidence.append("high_engagement")
            score_components.append({"reason": "high_engagement", "impact": round(min(engagement / 500.0, 0.12), 3)})
        if office_cluster_conf >= 0.5:
            evidence.append("office_ip_cluster")
            score_components.append({"reason": "office_ip_cluster", "impact": round(min(office_cluster_conf * 0.12, 0.12), 3)})
        if buying_committee_size >= 2:
            evidence.append("account_buying_committee")
            score_components.append({"reason": "account_buying_committee", "impact": round(min(buying_committee_size * 0.02, 0.08), 3)})
        if account_score >= 0.4:
            evidence.append("account_intelligence")
            score_components.append({"reason": "account_intelligence", "impact": round(min(account_score * 0.14, 0.14), 3)})
        if sequence_type and sequence_type != "unknown":
            evidence.append(f"sequence:{sequence_type}")
            score_components.append({"reason": f"sequence:{sequence_type}", "impact": round(min(sequence_score * 0.14, 0.14), 3)})
        evidence.extend(learned_signal.get("evidence") or [])
        if float(learned_signal.get("boost") or 0.0) > 0:
            score_components.append({"reason": "learned_signal", "impact": round(float(learned_signal.get("boost") or 0.0), 3)})
        if float(learned_signal.get("penalty") or 0.0) > 0:
            contradictions.extend(learned_signal.get("penalties") or [])
            score_components.append({"reason": "negative_learning", "impact": round(-float(learned_signal.get("penalty") or 0.0), 3)})

        scored = []
        for candidate in candidates[:25]:
            score = 0.0
            reasons: List[str] = []

            title = str(candidate.get("job_title") or candidate.get("title") or "").lower()
            candidate_persona = self._title_to_persona(title)
            candidate_company = str(candidate.get("company_name") or candidate.get("company") or "").strip().lower()
            candidate_domain = str(candidate.get("company_domain") or candidate.get("domain") or "").strip().lower()

            if persona != "unknown" and candidate_persona == persona:
                score += 0.28
                reasons.append("persona_match")
            elif candidate_persona == "executive":
                score += 0.08
                reasons.append("executive_fallback")
            if candidate_persona and candidate_persona in role_coverage:
                score += 0.08
                reasons.append("account_role_coverage_match")

            seniority = str(candidate.get("seniority") or "").lower()
            if seniority in {"c_suite", "vp", "director"}:
                score += 0.08
                reasons.append("seniority_fit")

            if company and candidate_company and candidate_company == company:
                score += 0.12
                reasons.append("company_match")
            if domain and candidate_domain and candidate_domain == domain:
                score += 0.14
                reasons.append("domain_match")

            cand_country = str(candidate.get("country") or candidate.get("location_country") or "").lower()
            cand_city = str(candidate.get("city") or candidate.get("location_city") or "").lower()
            if geo.get("country") and cand_country and str(geo.get("country")).lower() == cand_country:
                score += 0.08
                reasons.append("country_match")
            if geo.get("city") and cand_city and str(geo.get("city")).lower() == cand_city:
                score += 0.04
                reasons.append("city_match")

            campaign = candidate.get("campaign_engagement") or {}
            if any(campaign.get(k) for k in ("open_count", "reply_count", "meeting_count", "engagement_count")):
                score += min(
                    float(campaign.get("open_count", 0)) * 0.01
                    + float(campaign.get("reply_count", 0)) * 0.05
                    + float(campaign.get("meeting_count", 0)) * 0.12
                    + float(campaign.get("engagement_count", 0)) * 0.02,
                    0.16,
                )
                reasons.append("campaign_history")

            if candidate.get("email"):
                score += 0.04
                reasons.append("has_email")
            if candidate.get("linkedin_url"):
                score += 0.03
                reasons.append("has_linkedin")

            candidate_key = self._candidate_key(candidate)
            if candidate_key and candidate_key in prior_candidates:
                score += 0.12
                reasons.append("historical_repeat_candidate")
            if candidate_key and candidate_key in suppressed_candidate_keys:
                score -= 0.22
                reasons.append("suppressed_candidate")
            revealed_key_match = False
            for revealed in revealed_people:
                revealed_key = self._candidate_key(revealed)
                if candidate_key and revealed_key and candidate_key == revealed_key:
                    revealed_key_match = True
                    break
                if (
                    candidate.get("full_name") and revealed.get("full_name")
                    and str(candidate.get("full_name")).strip().lower() == str(revealed.get("full_name")).strip().lower()
                ):
                    revealed_key_match = True
                    break
            if revealed_key_match:
                score += 0.18
                reasons.append("matched_revealed_account_contact")

            score += min(persona_conf * 0.18, 0.18)
            score += min(engagement / 500.0, 0.12)
            score += min(company_conf * 0.12, 0.12)
            score += min(repeat_visits * 0.03, 0.12)
            score += min(office_cluster_conf * 0.12, 0.12)
            score += min(buying_committee_size * 0.02, 0.08)
            score += min(account_score * 0.14, 0.14)
            score += min(office_verified * 0.02, 0.08)
            score += min(sequence_score * 0.14, 0.14)
            score += float(learned_signal.get("boost") or 0.0)
            score -= float(learned_signal.get("penalty") or 0.0)

            if not (candidate.get("email") or candidate.get("linkedin_url") or candidate.get("full_name")):
                score -= 0.08
                contradictions.append("weak_candidate_profile")

            scored.append({
                "candidate": candidate,
                "score": round(max(score, 0.0), 4),
                "reasons": reasons,
            })

        scored.sort(key=lambda item: item["score"], reverse=True)
        top_scored = scored[:5]
        top_candidates = [
            {
                "full_name": item["candidate"].get("full_name"),
                "email": item["candidate"].get("email"),
                "linkedin_url": item["candidate"].get("linkedin_url"),
                "job_title": item["candidate"].get("job_title"),
                "seniority": item["candidate"].get("seniority"),
                "candidate_key": self._candidate_key(item["candidate"]),
                "score": round(item["score"], 2),
                "reasons": item["reasons"],
            }
            for item in top_scored
        ]

        negative_candidates = [
            {
                "candidate_key": self._candidate_key(item["candidate"]),
                "full_name": item["candidate"].get("full_name"),
                "email": item["candidate"].get("email"),
                "job_title": item["candidate"].get("job_title"),
                "reason": "suppressed_candidate" if "suppressed_candidate" in item["reasons"] else "negative_learning",
            }
            for item in top_scored
            if self._candidate_key(item["candidate"]) and (
                "suppressed_candidate" in item["reasons"] or float(learned_signal.get("penalty") or 0.0) >= 0.08
            )
        ]

        best_score = float(top_scored[0]["score"]) if top_scored else 0.0
        best_candidate = top_scored[0]["candidate"] if top_scored else None

        status = "anonymous"
        promote_to_ui = False
        if best_candidate and best_score >= 0.78 and company_conf >= 0.45 and repeat_visits >= 1:
            status = "predicted_high"
            promote_to_ui = True
            evidence.append("high_confidence_candidate_match")
        elif best_candidate and best_score >= 0.62 and company_conf >= 0.4:
            status = "predicted_medium"
            evidence.append("medium_confidence_candidate_match")
        elif company or domain:
            status = "company_only"
        else:
            contradictions.append("no_stable_company_or_person_match")

        return {
            "status": status,
            "confidence": round(best_score, 2),
            "method": "person_resolution_engine",
            "likely_persona": None if persona == "unknown" else persona,
            "evidence": list(dict.fromkeys(evidence)),
            "contradictions": list(dict.fromkeys(contradictions)),
            "top_candidates": top_candidates,
            "promote_to_ui": promote_to_ui,
            "repeat_visits": repeat_visits,
            "buying_committee_size": buying_committee_size,
            "account_stage": account_intelligence.get("stage"),
            "account_score": round(account_score, 2),
            "account_role_coverage": role_coverage[:6],
            "account_unique_visitor_count": unique_visitor_count,
            "office_cluster_confidence": round(office_cluster_conf, 2),
            "sequence_type": sequence_type or None,
            "sequence_score": round(sequence_score, 2),
            "score_components": score_components[:10],
            "learned_feature_breakdown": learned_signal.get("feature_breakdown") or [],
            "negative_learning_penalty": round(float(learned_signal.get("penalty") or 0.0), 3),
            "negative_candidates": negative_candidates[:5],
            "explanation_summary": self._build_summary(
                status=status,
                persona=persona,
                company=company,
                domain=domain,
                repeat_visits=repeat_visits,
                top_candidate=top_candidates[0] if top_candidates else None,
                office_cluster_conf=office_cluster_conf,
                sequence_type=sequence_type,
                account_stage=str(account_intelligence.get("stage") or ""),
            ),
        }

    def upsert_profile(
        self,
        db: Session,
        *,
        org_id: str,
        data: Dict[str, Any],
        resolution: Dict[str, Any],
        engine_result: Dict[str, Any],
        behavioral: Optional[Dict[str, Any]] = None,
    ) -> AnonymousVisitorProfile:
        visitor_id = data.get("visitor_id")
        fingerprint = data.get("fp") or resolution.get("fingerprint")
        session_id = data.get("session_id") or resolution.get("session_id")
        profile = self.load_profile(
            db,
            org_id=org_id,
            visitor_id=visitor_id,
            fingerprint=fingerprint,
            session_id=session_id,
        )
        if not profile:
            profile = AnonymousVisitorProfile(org_id=uuid.UUID(org_id))
            db.add(profile)

        if visitor_id:
            profile.visitor_id = str(visitor_id)
        if fingerprint:
            profile.fingerprint = str(fingerprint)
        if session_id:
            profile.session_id = str(session_id)

        user_agent = data.get("user_agent") or ""
        if user_agent:
            profile.user_agent_hash = hashlib.sha256(user_agent.encode("utf-8")).hexdigest()
        if data.get("ip"):
            profile.last_ip = data.get("ip")

        profile.company_name = resolution.get("company")
        profile.company_domain = resolution.get("domain")
        profile.latest_persona = ((behavioral or {}).get("predicted_persona") or engine_result.get("likely_persona") or None)
        profile.latest_buying_stage = (behavioral or {}).get("buying_stage")
        profile.visit_count = int(profile.visit_count or 0) + 1
        profile.total_active_ms = int(profile.total_active_ms or 0) + int(data.get("active_ms") or 0)

        existing_profile_data = dict(profile.profile_data or {})
        page_types = set(existing_profile_data.get("page_types") or [])
        if resolution.get("page_type"):
            page_types.add(str(resolution.get("page_type")))
        recent_urls = list(existing_profile_data.get("recent_urls") or [])
        if data.get("url"):
            recent_urls = ([str(data.get("url"))] + recent_urls)[:10]
        candidate_keys = []
        for candidate in engine_result.get("top_candidates") or []:
            candidate_key = self._candidate_key(candidate)
            if candidate_key:
                candidate_keys.append(candidate_key)

        profile.profile_data = {
            **existing_profile_data,
            "page_types": sorted(page_types),
            "recent_urls": recent_urls,
            "last_page_title": resolution.get("page_title"),
            "last_outbound_domain": resolution.get("last_outbound_domain"),
            "signals": {
                "cta_clicks": resolution.get("cta_clicks"),
                "scroll_depth": resolution.get("scroll_depth"),
                "active_ms": resolution.get("active_ms"),
            },
            "prior_candidate_keys": list(dict.fromkeys(candidate_keys + list(existing_profile_data.get("prior_candidate_keys") or [])))[:20],
        }
        profile.resolution_summary = {
            "person_resolution": engine_result,
            "person_identification": resolution.get("person_identification") or {},
            "company": resolution.get("company"),
            "domain": resolution.get("domain"),
            "confidence": resolution.get("confidence"),
        }
        profile.candidate_people = engine_result.get("top_candidates") or []
        return profile

    def _title_to_persona(self, title: str) -> str:
        for pattern, persona in TITLE_TO_PERSONA.items():
            if pattern in title:
                return persona
        return "unknown"

    def _candidate_key(self, candidate: Dict[str, Any]) -> Optional[str]:
        email = candidate.get("email")
        linkedin = candidate.get("linkedin_url")
        name = candidate.get("full_name")
        if email:
            return f"email:{str(email).strip().lower()}"
        if linkedin:
            return f"linkedin:{str(linkedin).strip().lower()}"
        if name:
            return f"name:{str(name).strip().lower()}"
        return None

    def _build_summary(
        self,
        *,
        status: str,
        persona: str,
        company: str,
        domain: str,
        repeat_visits: int,
        top_candidate: Optional[Dict[str, Any]],
        office_cluster_conf: float,
        sequence_type: str,
        account_stage: str,
    ) -> str:
        parts: List[str] = []
        if company or domain:
            parts.append(f"company={company or domain}")
        if persona and persona != "unknown":
            parts.append(f"persona={persona}")
        if repeat_visits:
            parts.append(f"repeat_visits={repeat_visits}")
        if office_cluster_conf >= 0.5:
            parts.append(f"office_cluster={round(office_cluster_conf, 2)}")
        if sequence_type and sequence_type != "unknown":
            parts.append(f"sequence={sequence_type}")
        if account_stage:
            parts.append(f"account_stage={account_stage}")
        if top_candidate and top_candidate.get("full_name"):
            parts.append(f"top_candidate={top_candidate.get('full_name')}")
        if not parts:
            return f"{status}: insufficient evidence"
        return f"{status}: " + ", ".join(parts)
