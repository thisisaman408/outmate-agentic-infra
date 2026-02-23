try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    print("langchain_community import success")
    from app.main import app
    print("FastAPI app import success")
except Exception as e:
    print(f"Import failure: {e}")
