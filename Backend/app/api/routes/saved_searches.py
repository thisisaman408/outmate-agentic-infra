from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from app.db.deps import get_db
from app.db.models.saved_search import SavedSearch
from app.db.models.user import User
from app.api.deps.auth import get_current_user

router = APIRouter()

# --- Schemas ---

class SavedSearchCreate(BaseModel):
    name: str
    description: Optional[str] = None
    search_type: str
    filters: Dict[str, Any]
    nlp_query: Optional[str] = None

# --- Routes ---

@router.post("/", response_model=Dict[str, Any])
async def create_saved_search(
    body: SavedSearchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a new search filter set."""
    saved_search = SavedSearch(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        search_type=body.search_type,
        filters=body.filters,
        nlp_query=body.nlp_query
    )
    db.add(saved_search)
    db.commit()
    db.refresh(saved_search)
    return {"id": str(saved_search.id), "name": saved_search.name}

@router.get("/", response_model=List[Dict[str, Any]])
async def list_saved_searches(
    search_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all saved searches for the current user."""
    query = db.query(SavedSearch).filter(SavedSearch.user_id == current_user.id)
    if search_type:
        query = query.filter(SavedSearch.search_type == search_type)
    
    searches = query.order_by(SavedSearch.created_at.desc()).all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "description": s.description,
            "search_type": s.search_type,
            "filters": s.filters,
            "nlp_query": s.nlp_query,
            "created_at": s.created_at.isoformat() if s.created_at else None
        }
        for s in searches
    ]

@router.get("/{search_id}", response_model=Dict[str, Any])
async def get_saved_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific saved search."""
    search = db.query(SavedSearch).filter(
        SavedSearch.id == search_id,
        SavedSearch.user_id == current_user.id
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
        
    return {
        "id": str(search.id),
        "name": search.name,
        "description": search.description,
        "search_type": search.search_type,
        "filters": search.filters,
        "nlp_query": search.nlp_query,
        "created_at": search.created_at.isoformat() if search.created_at else None
    }

@router.delete("/{search_id}")
async def delete_saved_search(
    search_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a saved search."""
    search = db.query(SavedSearch).filter(
        SavedSearch.id == search_id,
        SavedSearch.user_id == current_user.id
    ).first()
    
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
        
    db.delete(search)
    db.commit()
    return {"detail": "Deleted successfully"}
