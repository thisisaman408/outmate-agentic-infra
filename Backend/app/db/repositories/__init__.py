"""
Repository layer for database access.

Each repository encapsulates all database operations
for a specific domain entity.
"""

from app.db.repositories.user_repository import UserRepository
from app.db.repositories.company_repository import CompanyRepository
from app.db.repositories.prospect_repository import ProspectRepository
from app.db.repositories.search_repository import SearchRepository

__all__ = [
    "UserRepository",
    "CompanyRepository",
    "ProspectRepository",
    "SearchRepository",
]
