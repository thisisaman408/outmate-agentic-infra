"""
Credential encryption using Fernet (AES-128-CBC under the hood).

Generate a key once via:  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
Store it in .env as CREDENTIAL_ENCRYPTION_KEY=...

If the env var is missing, falls back to a derived key from JWT_SECRET (dev-only).
"""

import json
import hashlib
import base64
import logging
import os

logger = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    from cryptography.fernet import Fernet

    key = os.getenv("CREDENTIAL_ENCRYPTION_KEY")
    if not key:
        # Fallback: derive a Fernet key from JWT_SECRET for development
        jwt_secret = os.getenv("JWT_SECRET", "")
        if not jwt_secret:
            raise RuntimeError("Neither CREDENTIAL_ENCRYPTION_KEY nor JWT_SECRET is set")
        derived = hashlib.sha256(jwt_secret.encode()).digest()
        key = base64.urlsafe_b64encode(derived).decode()
        logger.warning(
            "CREDENTIAL_ENCRYPTION_KEY not set — deriving from JWT_SECRET (not recommended for production)"
        )

    _fernet = Fernet(key)
    return _fernet


def encrypt_credentials(creds: dict) -> str:
    """Encrypt a credentials dict to a Fernet token string."""
    f = _get_fernet()
    return f.encrypt(json.dumps(creds).encode()).decode()


def decrypt_credentials(encrypted: str) -> dict:
    """Decrypt a Fernet token string back to a credentials dict."""
    f = _get_fernet()
    return json.loads(f.decrypt(encrypted.encode()).decode())
