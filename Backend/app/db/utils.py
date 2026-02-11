"""
Database utility functions matching SQL functions in the schema.
These provide Python equivalents of PostgreSQL stored procedures.
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.models import User, CreditTransaction
from uuid import UUID
from typing import Optional
from datetime import datetime


def get_user_credits(db: Session, user_id: UUID) -> int:
    """
    Get the current credit balance for a user.
    
    Python equivalent of: SELECT get_user_credits('user-uuid');
    
    Args:
        db: Database session
        user_id: User UUID
        
    Returns:
        Current credit balance (0 if user not found)
    """
    user = db.query(User).filter(User.id == user_id).first()
    return user.credits_balance if user else 0


def deduct_credits(
    db: Session,
    user_id: UUID,
    amount: int,
    reference_id: Optional[UUID],
    description: str
) -> bool:
    """
    Deduct credits from a user's balance and log the transaction.
    
    Python equivalent of: SELECT deduct_credits('user-uuid', 10, 'search-uuid', 'Company search');
    
    Args:
        db: Database session
        user_id: User UUID
        amount: Number of credits to deduct (positive number)
        reference_id: Optional reference to related entity (e.g., search_query_id)
        description: Transaction description
        
    Returns:
        True if successful, False if insufficient credits
        
    Raises:
        ValueError: If amount is negative
    """
    if amount < 0:
        raise ValueError("Amount must be positive")
    
    # Lock the user row for update to prevent race conditions
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    
    if not user:
        return False
    
    # Check if sufficient credits
    if user.credits_balance < amount:
        return False
    
    # Deduct credits
    user.credits_balance -= amount
    user.updated_at = datetime.now()
    
    # Log transaction
    transaction = CreditTransaction(
        user_id=user_id,
        amount=-amount,  # Negative for usage
        transaction_type='usage',
        reference_id=reference_id,
        description=description
    )
    db.add(transaction)
    
    try:
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False


def add_credits(
    db: Session,
    user_id: UUID,
    amount: int,
    transaction_type: str,
    reference_id: Optional[UUID] = None,
    description: str = ""
) -> bool:
    """
    Add credits to a user's balance (purchase, bonus, refund).
    
    Args:
        db: Database session
        user_id: User UUID
        amount: Number of credits to add (positive number)
        transaction_type: 'purchase', 'bonus', or 'refund'
        reference_id: Optional reference to related entity
        description: Transaction description
        
    Returns:
        True if successful, False otherwise
        
    Raises:
        ValueError: If amount is negative or transaction_type is invalid
    """
    if amount < 0:
        raise ValueError("Amount must be positive")
    
    valid_types = ['purchase', 'bonus', 'refund']
    if transaction_type not in valid_types:
        raise ValueError(f"Invalid transaction_type. Must be one of: {valid_types}")
    
    # Lock the user row for update
    user = db.query(User).filter(User.id == user_id).with_for_update().first()
    
    if not user:
        return False
    
    # Add credits
    user.credits_balance += amount
    user.updated_at = datetime.now()
    
    # Log transaction
    transaction = CreditTransaction(
        user_id=user_id,
        amount=amount,  # Positive for addition
        transaction_type=transaction_type,
        reference_id=reference_id,
        description=description
    )
    db.add(transaction)
    
    try:
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False


def get_credit_history(
    db: Session,
    user_id: UUID,
    limit: int = 50
) -> list:
    """
    Get recent credit transaction history for a user.
    
    Args:
        db: Database session
        user_id: User UUID
        limit: Maximum number of transactions to return
        
    Returns:
        List of CreditTransaction objects
    """
    return (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(limit)
        .all()
    )


def get_user_stats(db: Session, user_id: UUID) -> dict:
    """
    Get user statistics including credit balance and usage.
    
    Returns:
        Dictionary with user stats:
        - credits_balance: Current balance
        - total_purchased: Total credits purchased
        - total_used: Total credits used
        - total_searches: Number of searches performed
    """
    from app.db.models import SearchQuery
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {}
    
    # Calculate total purchased credits
    total_purchased = (
        db.query(func.sum(CreditTransaction.amount))
        .filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.transaction_type.in_(['purchase', 'bonus', 'refund']),
            CreditTransaction.amount > 0
        )
        .scalar() or 0
    )
    
    # Calculate total used credits
    total_used = (
        db.query(func.sum(CreditTransaction.amount))
        .filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.transaction_type == 'usage',
            CreditTransaction.amount < 0
        )
        .scalar() or 0
    )
    
    # Get search count
    total_searches = (
        db.query(func.count(SearchQuery.id))
        .filter(SearchQuery.user_id == user_id)
        .scalar() or 0
    )
    
    return {
        'credits_balance': user.credits_balance,
        'total_purchased': int(total_purchased),
        'total_used': abs(int(total_used)),
        'total_searches': total_searches,
        'subscription_tier': user.subscription_tier,
        'is_active': user.is_active
    }


def check_sufficient_credits(db: Session, user_id: UUID, required_credits: int) -> bool:
    """
    Check if user has sufficient credits for an operation.
    
    Args:
        db: Database session
        user_id: User UUID
        required_credits: Number of credits needed
        
    Returns:
        True if user has sufficient credits, False otherwise
    """
    current_balance = get_user_credits(db, user_id)
    return current_balance >= required_credits


def update_user_last_login(db: Session, user_id: UUID) -> bool:
    """
    Update the last login timestamp for a user.
    
    Args:
        db: Database session
        user_id: User UUID
        
    Returns:
        True if successful, False if user not found
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return False
    
    user.last_login_at = datetime.now()
    user.updated_at = datetime.now()
    
    try:
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
