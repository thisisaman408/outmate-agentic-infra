import math
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.db.models.person_resolution_learning_stat import PersonResolutionLearningStat


class PersonResolutionLearningService:
    def _scoped_feature(self, scope: str, feature_type: str, feature_value: str) -> tuple[str, str]:
        return (f"{scope}:{feature_type}", feature_value)

    def _upsert_stat(
        self,
        db: Session,
        *,
        org_id: str,
        feature_type: str,
        feature_value: str,
        success: bool,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        stat = (
            db.query(PersonResolutionLearningStat)
            .filter(
                PersonResolutionLearningStat.org_id == uuid.UUID(org_id),
                PersonResolutionLearningStat.feature_type == feature_type,
                PersonResolutionLearningStat.feature_value == feature_value,
            )
            .first()
        )
        if not stat:
            stat = PersonResolutionLearningStat(
                org_id=uuid.UUID(org_id),
                feature_type=feature_type,
                feature_value=feature_value,
            )
            db.add(stat)
        stat.seen_count = int(stat.seen_count or 0) + 1
        if success:
            stat.success_count = int(stat.success_count or 0) + 1
        if metadata:
            stat.metadata_json = {**(stat.metadata_json or {}), **metadata}

    def learn_from_outcome(
        self,
        db: Session,
        *,
        org_id: str,
        resolution: Dict[str, Any],
        profile_data: Optional[Dict[str, Any]] = None,
        behavioral: Optional[Dict[str, Any]] = None,
        person_resolution: Optional[Dict[str, Any]] = None,
        verified_identity: Optional[Dict[str, Any]] = None,
    ) -> None:
        verified_identity = verified_identity or {}
        person_resolution = person_resolution or {}
        profile_data = profile_data or {}
        behavioral = behavioral or {}

        features: List[Tuple[str, str]] = []
        domain = str(resolution.get("domain") or "").strip().lower()
        if domain:
            features.append(("company_domain", domain))
        page_type = str(resolution.get("page_type") or "").strip().lower()
        if page_type:
            features.append(("page_type", page_type))
        persona = str(behavioral.get("predicted_persona") or person_resolution.get("likely_persona") or "").strip().lower()
        if persona and persona != "unknown":
            features.append(("persona", persona))
        outbound = str(resolution.get("last_outbound_domain") or "").strip().lower()
        if outbound:
            features.append(("outbound_domain", outbound))
        office_conf = float(person_resolution.get("office_cluster_confidence") or 0.0)
        if office_conf >= 0.5:
            features.append(("office_cluster", domain or "present"))
        repeat_visits = int(person_resolution.get("repeat_visits") or 0)
        if repeat_visits >= 2:
            features.append(("repeat_visits", "2_plus"))
        journey_sequence = resolution.get("journey_sequence") or {}
        sequence_type = str(journey_sequence.get("sequence_type") or "").strip().lower()
        if sequence_type and sequence_type != "unknown":
            features.append(("sequence_type", sequence_type))
        for pt in list(profile_data.get("page_types") or [])[:5]:
            cleaned = str(pt).strip().lower()
            if cleaned:
                features.append(("profile_page_type", cleaned))

        scoped_features: List[Tuple[str, str]] = []
        if domain and persona and persona != "unknown":
            scoped_features.append(self._scoped_feature("domain_persona", "company_domain", f"{domain}|{persona}"))
        if domain and page_type:
            scoped_features.append(self._scoped_feature("domain_page", "company_domain", f"{domain}|{page_type}"))
        if persona and page_type and persona != "unknown":
            scoped_features.append(self._scoped_feature("persona_page", "persona", f"{persona}|{page_type}"))
        if domain and sequence_type:
            scoped_features.append(self._scoped_feature("domain_sequence", "company_domain", f"{domain}|{sequence_type}"))
        features.extend(scoped_features)

        verified_key = self._person_key(verified_identity)
        top_candidates = list(person_resolution.get("top_candidates") or [])
        top_candidate_key = self._person_key(top_candidates[0]) if top_candidates else None
        candidate_match = bool(verified_key and top_candidate_key and verified_key == top_candidate_key)
        if top_candidate_key:
            features.append(("top_candidate_key", top_candidate_key))

        for feature_type, feature_value in features:
            self._upsert_stat(
                db,
                org_id=org_id,
                feature_type=feature_type,
                feature_value=feature_value,
                success=(feature_type != "top_candidate_key" or candidate_match),
                metadata={
                    "last_domain": domain,
                    "last_persona": persona,
                    "last_page_type": page_type,
                },
            )

    def get_learned_signal(
        self,
        db: Session,
        *,
        org_id: str,
        features: List[Tuple[str, str]],
    ) -> Dict[str, Any]:
        if not features:
            return {"boost": 0.0, "penalty": 0.0, "evidence": [], "penalties": [], "feature_breakdown": []}

        boost = 0.0
        penalty = 0.0
        evidence: List[str] = []
        penalties: List[str] = []
        feature_breakdown: List[Dict[str, Any]] = []
        deduped = []
        seen = set()
        for feature_type, feature_value in features:
            key = (feature_type, feature_value)
            if feature_value and key not in seen:
                deduped.append(key)
                seen.add(key)

        for feature_type, feature_value in deduped[:12]:
            stat = (
                db.query(PersonResolutionLearningStat)
                .filter(
                    PersonResolutionLearningStat.org_id == uuid.UUID(org_id),
                    PersonResolutionLearningStat.feature_type == feature_type,
                    PersonResolutionLearningStat.feature_value == feature_value,
                )
                .first()
            )
            if not stat:
                continue
            seen_count = int(stat.seen_count or 0)
            success_count = int(stat.success_count or 0)
            if seen_count < 2:
                continue
            rate = success_count / max(seen_count, 1)
            breakdown = {
                "feature_type": feature_type,
                "feature_value": feature_value,
                "success_rate": round(rate, 2),
                "seen_count": seen_count,
                "success_count": success_count,
                "boost": 0.0,
                "penalty": 0.0,
            }
            if rate >= 0.5:
                feature_boost = min((rate - 0.5) * math.log(seen_count + 1) * 0.08, 0.12)
                if feature_boost > 0:
                    boost += feature_boost
                    evidence.append(f"learned:{feature_type}")
                    breakdown["boost"] = round(feature_boost, 3)
            else:
                feature_penalty = min((0.5 - rate) * math.log(seen_count + 1) * 0.09, 0.16)
                if feature_penalty > 0:
                    penalty += feature_penalty
                    penalties.append(f"negative:{feature_type}")
                    breakdown["penalty"] = round(feature_penalty, 3)
            if breakdown["boost"] > 0 or breakdown["penalty"] > 0:
                feature_breakdown.append(breakdown)

        feature_breakdown.sort(key=lambda item: (item["boost"], item["penalty"]), reverse=True)
        return {
            "boost": round(min(boost, 0.22), 3),
            "penalty": round(min(penalty, 0.24), 3),
            "evidence": list(dict.fromkeys(evidence)),
            "penalties": list(dict.fromkeys(penalties)),
            "feature_breakdown": feature_breakdown[:8],
        }

    def _person_key(self, person: Optional[Dict[str, Any]]) -> Optional[str]:
        if not isinstance(person, dict):
            return None
        email = person.get("email")
        linkedin = person.get("linkedin_url")
        name = person.get("full_name")
        if email:
            return f"email:{str(email).strip().lower()}"
        if linkedin:
            return f"linkedin:{str(linkedin).strip().lower()}"
        if name:
            return f"name:{str(name).strip().lower()}"
        return None
