import os
import sys
import asyncio
from sqlalchemy.orm import Session

# Add the Backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.services.copilot.knowledge_service import KnowledgeService

def index_all_docs():
    """
    Finds and indexes all relevant product documentation files.
    """
    db = SessionLocal()
    knowledge_service = KnowledgeService(db)

    # List of files to index
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    docs_to_index = [
        os.path.join(repo_root, "Outmate_repo", "COPILOT_README.md"),
        os.path.join(repo_root, "Outmate_repo", "copilot_chatbot.md"),
        os.path.join(repo_root, "Outmate_repo", "Backend", "AI_AGENTS_DOCUMENTATION.md"),
        # Add more as needed
    ]

    print(">>> Starting product documentation indexing...")

    for file_path in docs_to_index:
        if os.path.exists(file_path):
            print(f"Indexing: {file_path}")
            try:
                knowledge_service.index_markdown_file(file_path)
            except Exception as e:
                print(f"Error indexing {file_path}: {e}")
        else:
            print(f"Skipping (not found): {file_path}")

    print(">>> Indexing complete.")
    db.close()

if __name__ == "__main__":
    index_all_docs()
