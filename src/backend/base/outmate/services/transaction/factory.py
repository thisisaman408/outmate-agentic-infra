"""Transaction service factory for Outmate"""

from __future__ import annotations

from typing import TYPE_CHECKING

from outmate.services.factory import ServiceFactory
from outmate.services.transaction.service import TransactionService

if TYPE_CHECKING:
    from outmate.services.settings.service import SettingsService


class TransactionServiceFactory(ServiceFactory):
    """Factory for creating TransactionService instances."""

    def __init__(self):
        super().__init__(TransactionService)

    def create(self, settings_service: SettingsService):
        """Create a new TransactionService instance.

        Args:
            settings_service: The settings service for checking if transactions are enabled.

        Returns:
            A new TransactionService instance.
        """
        return TransactionService(settings_service)
