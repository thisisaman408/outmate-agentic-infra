import logging
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_model = None

def get_embedding_model():
    """
    Returns the SentenceTransformer model as a singleton.
    """
    global _model
    if _model is None:
        logger.info("Loading embedding model (all-MiniLM-L6-v2)...")
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model
