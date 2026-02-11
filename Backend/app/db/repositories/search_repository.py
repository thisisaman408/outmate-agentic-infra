from sqlalchemy.orm import Session
from typing import Dict
from app.db.models.search import SearchQuery


class SearchRepository:

    @staticmethod
    def create(
        db: Session,
        user_id,
        provider_id,
        query_params: Dict,
        credits_used: int,
        result_count: int,
        status: str = "completed"
    ) -> SearchQuery:
        """
        Persist a search query execution.
        """
        search = SearchQuery(
            user_id=user_id,
            provider_id=provider_id,
            query_params=query_params,
            credits_used=credits_used,
            result_count=result_count,
            status=status,
        )

        db.add(search)
        db.commit()
        db.refresh(search)
        return search

    @staticmethod
    def list_by_user(
        db: Session,
        user_id,
        limit: int = 20
    ):
        """
        Fetch recent searches for a user (history).
        """
        return (
            db.query(SearchQuery)
            .filter(SearchQuery.user_id == user_id)
            .order_by(SearchQuery.created_at.desc())
            .limit(limit)
            .all()
        )
