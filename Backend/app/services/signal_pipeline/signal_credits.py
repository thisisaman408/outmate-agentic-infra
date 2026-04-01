"""
Signal Credits Manager — Handle credit deduction for signal consumption.

Each signal type has a credit cost based on rarity and value:
- job_change: 2 credits
- funding: 3 credits
- hiring: 2 credits
- g2_intent: 4 credits
- website_visit: 1 credit
- email_open: 1 credit
- linkedin_activity: 2 credits
"""

import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models.credit import CreditTransaction
from app.db.models.user import User

logger = logging.getLogger(__name__)

# Credit costs per signal type
SIGNAL_CREDIT_COSTS = {
    "job_change": 2,
    "funding": 3,
    "hiring": 2,
    "g2_intent": 4,
    "website_visit": 1,
    "email_open": 1,
    "linkedin_activity": 2,
}


class SignalCreditManager:
    """Manage credit deduction for signal consumption."""

    def __init__(self, db: Session):
        self.db = db

    def get_signal_cost(self, signal_type: str) -> int:
        """Get credit cost for signal type."""
        return SIGNAL_CREDIT_COSTS.get(signal_type, 2)

    async def deduct_credits(
        self,
        user_id: UUID,
        signal_type: str,
        signal_id: UUID,
        reason: str = "signal_consumption",
    ) -> bool:
        """
        Deduct credits for signal consumption.

        Args:
            user_id: User ID
            signal_type: Type of signal
            signal_id: Reference to signal_events.id
            reason: Reason for deduction

        Returns:
            True if deducted, False if insufficient credits or error
        """
        try:
            cost = self.get_signal_cost(signal_type)

            # Check current balance
            user = self.db.query(User).filter_by(id=user_id).first()
            if not user:
                logger.error(f"User {user_id} not found")
                return False

            if user.credits_balance < cost:
                logger.warning(
                    f"Insufficient credits for user {user_id}: "
                    f"needs {cost}, has {user.credits_balance}"
                )
                return False

            # Deduct credits
            user.credits_balance -= cost

            # Log transaction
            transaction = CreditTransaction(
                user_id=user_id,
                amount=-cost,  # Negative = usage
                transaction_type="usage",
                reference_id=signal_id,
                description=f"{reason}: signal_type={signal_type}",
                transaction_metadata={
                    "signal_type": signal_type,
                    "cost": cost,
                    "reason": reason,
                },
            )

            self.db.add(transaction)
            self.db.commit()

            logger.info(
                f"Deducted {cost} credits from user {user_id} for signal {signal_type} "
                f"(type={signal_type}, remaining={user.credits_balance})"
            )

            return True
        except Exception as e:
            logger.error(f"Failed to deduct credits: {e}", exc_info=True)
            self.db.rollback()
            return False

    async def check_credits_available(self, user_id: UUID, signal_type: str) -> bool:
        """
        Check if user has sufficient credits for a signal type.

        Args:
            user_id: User ID
            signal_type: Type of signal

        Returns:
            True if user has enough credits
        """
        try:
            cost = self.get_signal_cost(signal_type)
            user = self.db.query(User).filter_by(id=user_id).first()

            if not user:
                return False

            return user.credits_balance >= cost
        except Exception as e:
            logger.error(f"Failed to check credits: {e}")
            return False

    async def get_user_credits(self, user_id: UUID) -> Optional[int]:
        """Get current credit balance for user."""
        try:
            user = self.db.query(User).filter_by(id=user_id).first()
            if user:
                return user.credits_balance
            return None
        except Exception as e:
            logger.error(f"Failed to get user credits: {e}")
            return None
