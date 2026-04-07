from typing import Any, Dict, Optional
import uuid
from collections import Counter

from sqlalchemy.orm import Session

from app.db.models.company_visitor_memory import CompanyVisitorMemory
from app.db.models.office_ip_cluster import OfficeIpCluster
from app.services.person_resolution_learning_service import PersonResolutionLearningService


class VisitorLearningService:
    def __init__(self):
        self.person_learning = PersonResolutionLearningService()

    def ip_prefix(self, ip: Optional[str]) -> Optional[str]:
        if not ip:
            return None
        ip = str(ip).strip()
        if ":" in ip:
            parts = ip.split(":")
            return ":".join(parts[:4]) if len(parts) >= 4 else ip
        if "." in ip:
            parts = ip.split(".")
            if len(parts) == 4:
                return ".".join(parts[:3]) + ".0/24"
        return None

    def get_office_cluster(self, db: Session, *, org_id: str, ip: Optional[str], company_domain: Optional[str] = None) -> Optional[OfficeIpCluster]:
        prefix = self.ip_prefix(ip)
        if not prefix:
            return None
        query = db.query(OfficeIpCluster).filter(
            OfficeIpCluster.org_id == uuid.UUID(org_id),
            OfficeIpCluster.ip_prefix == prefix,
        )
        if company_domain:
            query = query.filter(OfficeIpCluster.company_domain == company_domain)
        return query.order_by(OfficeIpCluster.confidence.desc(), OfficeIpCluster.last_seen_at.desc()).first()

    def get_company_memory(self, db: Session, *, org_id: str, company_domain: Optional[str]) -> Optional[CompanyVisitorMemory]:
        if not company_domain:
            return None
        return (
            db.query(CompanyVisitorMemory)
            .filter(
                CompanyVisitorMemory.org_id == uuid.UUID(org_id),
                CompanyVisitorMemory.company_domain == company_domain,
            )
            .first()
        )

    def observe_visit(
        self,
        db: Session,
        *,
        org_id: str,
        ip: Optional[str],
        resolution: Dict[str, Any],
        person_resolution: Optional[Dict[str, Any]] = None,
    ) -> None:
        company_domain = resolution.get("domain")
        company_name = resolution.get("company")
        if not company_domain:
            return

        memory = self.get_company_memory(db, org_id=org_id, company_domain=company_domain)
        if not memory:
            memory = CompanyVisitorMemory(
                org_id=uuid.UUID(org_id),
                company_domain=company_domain,
                company_name=company_name,
            )
            db.add(memory)
        memory.company_name = company_name or memory.company_name
        memory.visitor_count = int(memory.visitor_count or 0) + 1
        unique_visitors = list(memory.unique_visitors or [])
        visitor_id = str(resolution.get("visitor_id") or "").strip()
        if visitor_id:
            unique_visitors = ([visitor_id] + [vid for vid in unique_visitors if vid != visitor_id])[:100]
        memory.unique_visitors = unique_visitors
        if (person_resolution or {}).get("status") in {"predicted_medium", "predicted_high", "company_only"}:
            memory.anonymous_repeat_count = int(memory.anonymous_repeat_count or 0) + 1

        latest_persona = (person_resolution or {}).get("likely_persona")
        personas = list(memory.latest_personas or [])
        if latest_persona:
            personas = ([latest_persona] + [p for p in personas if p != latest_persona])[:10]
            memory.latest_personas = personas
        role_coverage = list(memory.role_coverage or [])
        if latest_persona:
            role_coverage = ([latest_persona] + [role for role in role_coverage if role != latest_persona])[:10]
        memory.role_coverage = role_coverage

        sequence_type = str(((resolution.get("journey_sequence") or {}).get("sequence_type") or "")).strip().lower()
        sequence_types = list(memory.active_sequence_types or [])
        if sequence_type and sequence_type != "unknown":
            sequence_types = ([sequence_type] + [seq for seq in sequence_types if seq != sequence_type])[:10]
        memory.active_sequence_types = sequence_types

        top_candidates = list(memory.top_candidate_people or [])
        for candidate in (person_resolution or {}).get("top_candidates") or []:
            if candidate.get("full_name") or candidate.get("email"):
                top_candidates = [candidate] + [
                    existing for existing in top_candidates
                    if (existing.get("email") or existing.get("full_name")) != (candidate.get("email") or candidate.get("full_name"))
                ]
        memory.top_candidate_people = top_candidates[:15]
        suppressed_candidates = list(memory.suppressed_candidates or [])
        if (person_resolution or {}).get("negative_candidates"):
            for candidate in (person_resolution or {}).get("negative_candidates") or []:
                candidate_key = (candidate.get("candidate_key") or "").strip().lower()
                if not candidate_key:
                    continue
                suppressed_candidates = [candidate] + [
                    existing for existing in suppressed_candidates
                    if (existing.get("candidate_key") or "").strip().lower() != candidate_key
                ]
        memory.suppressed_candidates = suppressed_candidates[:20]
        memory.buying_committee_size = len({
            (item.get("email") or item.get("full_name") or "").lower()
            for item in (memory.top_candidate_people or [])
            if item.get("email") or item.get("full_name")
        })
        account_strength = self.build_account_intelligence(memory)
        memory.evidence = {
            **(memory.evidence or {}),
            "last_person_resolution_status": (person_resolution or {}).get("status"),
            "last_company_confidence": resolution.get("confidence"),
            "account_intelligence": account_strength,
        }

        prefix = self.ip_prefix(ip)
        company_confidence = float(resolution.get("confidence") or 0.0)
        if prefix and company_confidence >= 0.55:
            cluster = self.get_office_cluster(db, org_id=org_id, ip=ip, company_domain=company_domain)
            if not cluster:
                cluster = OfficeIpCluster(
                    org_id=uuid.UUID(org_id),
                    company_domain=company_domain,
                    company_name=company_name,
                    ip_prefix=prefix,
                )
                db.add(cluster)
            cluster.company_name = company_name or cluster.company_name
            cluster.evidence_count = int(cluster.evidence_count or 0) + 1
            sample_ips = list(cluster.sample_ips or [])
            if ip and ip not in sample_ips:
                sample_ips = ([ip] + sample_ips)[:12]
            cluster.sample_ips = sample_ips
            cluster.confidence = round(min(0.95, max(float(cluster.confidence or 0.0), 0.35) + min(company_confidence * 0.08, 0.08)), 2)
            cluster.evidence = {
                **(cluster.evidence or {}),
                "company_confidence": company_confidence,
                "last_company_name": company_name,
            }

    def learn_from_verified_identity(
        self,
        db: Session,
        *,
        org_id: str,
        ip: Optional[str],
        resolution: Dict[str, Any],
        profile_data: Optional[Dict[str, Any]] = None,
        behavioral: Optional[Dict[str, Any]] = None,
        person_resolution: Optional[Dict[str, Any]] = None,
    ) -> None:
        person_id = resolution.get("person_identification") or {}
        if person_id.get("status") != "verified":
            return
        company_domain = resolution.get("domain")
        if not company_domain:
            return

        memory = self.get_company_memory(db, org_id=org_id, company_domain=company_domain)
        if not memory:
            memory = CompanyVisitorMemory(
                org_id=uuid.UUID(org_id),
                company_domain=company_domain,
                company_name=resolution.get("company"),
            )
            db.add(memory)

        revealed = list(memory.revealed_people or [])
        revealed_person = {
            "full_name": resolution.get("full_name"),
            "email": resolution.get("email"),
            "linkedin_url": resolution.get("linkedin_url"),
            "job_title": resolution.get("job_title"),
        }
        key = (revealed_person.get("email") or revealed_person.get("linkedin_url") or revealed_person.get("full_name") or "").lower()
        if key:
            revealed = [revealed_person] + [
                item for item in revealed
                if (item.get("email") or item.get("linkedin_url") or item.get("full_name") or "").lower() != key
            ]
        memory.revealed_people = revealed[:20]
        memory.buying_committee_size = len({
            (item.get("email") or item.get("full_name") or "").lower()
            for item in (memory.revealed_people or [])
            if item.get("email") or item.get("full_name")
        })

        prefix = self.ip_prefix(ip)
        if prefix:
            cluster = self.get_office_cluster(db, org_id=org_id, ip=ip, company_domain=company_domain)
            if not cluster:
                cluster = OfficeIpCluster(
                    org_id=uuid.UUID(org_id),
                    company_domain=company_domain,
                    company_name=resolution.get("company"),
                    ip_prefix=prefix,
                )
                db.add(cluster)
            cluster.verified_reveal_count = int(cluster.verified_reveal_count or 0) + 1
            cluster.evidence_count = int(cluster.evidence_count or 0) + 1
            cluster.confidence = round(min(0.98, max(float(cluster.confidence or 0.0), 0.6) + 0.12), 2)
            sample_ips = list(cluster.sample_ips or [])
            if ip and ip not in sample_ips:
                sample_ips = ([ip] + sample_ips)[:12]
            cluster.sample_ips = sample_ips
            cluster.evidence = {
                **(cluster.evidence or {}),
                "last_verified_email": resolution.get("email"),
                "last_verified_title": resolution.get("job_title"),
            }

        self.person_learning.learn_from_outcome(
            db,
            org_id=org_id,
            resolution=resolution,
            profile_data=profile_data,
            behavioral=behavioral,
            person_resolution=person_resolution,
            verified_identity={
                "full_name": resolution.get("full_name"),
                "email": resolution.get("email"),
                "linkedin_url": resolution.get("linkedin_url"),
                "job_title": resolution.get("job_title"),
            },
        )

    def build_account_intelligence(self, memory: CompanyVisitorMemory) -> Dict[str, Any]:
        unique_visitors = list(memory.unique_visitors or [])
        role_coverage = [role for role in (memory.role_coverage or []) if role]
        sequence_types = [seq for seq in (memory.active_sequence_types or []) if seq]
        revealed_people = list(memory.revealed_people or [])
        top_candidates = list(memory.top_candidate_people or [])

        account_score = min(
            1.0,
            (
                min(len(unique_visitors) * 0.08, 0.32)
                + min(len(role_coverage) * 0.09, 0.27)
                + min(len(sequence_types) * 0.08, 0.16)
                + min(len(revealed_people) * 0.08, 0.16)
                + min(len(top_candidates) * 0.03, 0.09)
            ),
        )

        stage = "single_visitor"
        if len(unique_visitors) >= 3 and len(role_coverage) >= 2:
            stage = "multi_role_committee"
        elif len(unique_visitors) >= 2:
            stage = "emerging_account_interest"
        if len(revealed_people) >= 2:
            stage = "known_buying_committee"

        return {
            "stage": stage,
            "account_score": round(account_score, 2),
            "unique_visitor_count": len(unique_visitors),
            "role_coverage": role_coverage[:6],
            "sequence_types": sequence_types[:6],
            "revealed_people_count": len(revealed_people),
        }
