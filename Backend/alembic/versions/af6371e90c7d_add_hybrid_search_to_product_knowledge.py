"""add_hybrid_search_to_product_knowledge

Revision ID: af6371e90c7d
Revises: f20cae4ac68f
Create Date: 2026-03-19 21:16:21.745529

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'af6371e90c7d'
down_revision: Union[str, Sequence[str], None] = 'f20cae4ac68f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add tsvector column
    op.add_column('product_knowledge', sa.Column('content_tsvector', postgresql.TSVECTOR(), nullable=True))
    
    # Create GIN index for full-text search
    op.execute("CREATE INDEX ix_product_knowledge_content_tsvector ON product_knowledge USING gin(content_tsvector)")
    
    # Create HNSW index for vector search (requires pgvector extension)
    op.execute("CREATE INDEX ix_product_knowledge_embedding_hnsw ON product_knowledge USING hnsw (embedding vector_cosine_ops)")


def downgrade() -> None:
    # Drop indices
    op.drop_index('ix_product_knowledge_content_tsvector', table_name='product_knowledge')
    op.execute("DROP INDEX ix_product_knowledge_embedding_hnsw")
    
    # Drop column
    op.drop_column('product_knowledge', 'content_tsvector')
