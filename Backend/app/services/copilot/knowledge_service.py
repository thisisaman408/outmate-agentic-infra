import os
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.embeddings import get_embedding_model
from app.db.models.product_knowledge import ProductKnowledge
from langchain.text_splitter import MarkdownHeaderTextSplitter

logger = logging.getLogger(__name__)

class KnowledgeService:
    def __init__(self, db: Session):
        self.db = db
        self.model = get_embedding_model()
        
    def index_markdown_file(self, file_path: str):
        """
        Reads a markdown file, chunks it, generates embeddings, and stores in DB.
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found for indexing: {file_path}")
            return

        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()

        # Chunking strategy: split by headers to keep context intact
        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ]
        markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        chunks = markdown_splitter.split_text(text)

        # Clear existing knowledge for this file before re-indexing
        self.db.query(ProductKnowledge).filter(ProductKnowledge.source_file == os.path.basename(file_path)).delete()

        for chunk in chunks:
            embedding = self.model.encode(chunk.page_content).tolist()
            
            # Use SQL to_tsvector for full-text search
            knowledge_item = ProductKnowledge(
                content=chunk.page_content,
                embedding=embedding,
                doc_metadata=chunk.metadata,
                source_file=os.path.basename(file_path),
                content_tsvector=func.to_tsvector('english', chunk.page_content)
            )
            self.db.add(knowledge_item)
        
        self.db.commit()
        logger.info(f"Successfully indexed {len(chunks)} chunks from {file_path}")

    def retrieve_relevant_context(self, query: str, limit: int = 4) -> List[str]:
        """
        Hybrid search: Semantic (Vector) + Keyword (Full-Text).
        """
        query_embedding = self.model.encode(query).tolist()
        
        # 1. Vector Search (Top N)
        vector_results = (
            self.db.query(ProductKnowledge)
            .order_by(ProductKnowledge.embedding.cosine_distance(query_embedding))
            .limit(limit)
            .all()
        )
        
        # 2. Full-Text Search (Top N)
        # Using plainto_tsquery for natural language keywords
        ft_results = (
            self.db.query(ProductKnowledge)
            .filter(ProductKnowledge.content_tsvector.op('@@')(func.plainto_tsquery('english', query)))
            .limit(limit)
            .all()
        )
        
        # 3. Combine and Deduplicate
        seen_ids = set()
        combined_content = []
        
        # Prioritize Vector matches, followed by Keyword matches
        for r in vector_results + ft_results:
            if r.id not in seen_ids:
                combined_content.append(r.content)
                seen_ids.add(r.id)
                
        return combined_content[:limit]
