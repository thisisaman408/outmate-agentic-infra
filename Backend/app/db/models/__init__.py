"""
Central model registry.

Importing all models here ensures:
- SQLAlchemy registers all tables
- Base.metadata.create_all() works correctly
- Alembic migrations can detect all models
"""

from app.db.models.user import User
from app.db.models.provider import DataProvider
from app.db.models.company import Company
from app.db.models.prospect import Prospect
from app.db.models.search import SearchQuery
from app.db.models.credit import CreditTransaction
from app.db.models.export import ExportJob
from app.db.models.filter import AvailableFilter, ProviderFilterMapping
from app.db.models.search_result import SearchResult
from app.db.models.cache import CachedQuery
from app.db.models.api_log import ApiUsageLog
from app.db.models.visitor import SiteConfig, Visit, Alert

__all__ = [
    "User",
    "DataProvider",
    "Company",
    "Prospect",
    "SearchQuery",
    "CreditTransaction",
    "ExportJob",
    "AvailableFilter",
    "ProviderFilterMapping",
    "SearchResult",
    "CachedQuery",
    "ApiUsageLog",
    "SiteConfig",
    "Visit",
    "Alert",
]
