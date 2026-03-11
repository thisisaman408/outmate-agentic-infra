import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Path to .env
env_path = Path('e:/copilot_feature/Outmate_repo/Backend/.env')
load_dotenv(env_path, override=True)

try:
    from pydantic import ValidationError
    from app.core.settings import Settings
    
    try:
        s = Settings()
        print("SUCCESS: Settings loaded correctly.")
    except ValidationError as e:
        print("\n=== VALIDATION ERRORS FOUND ===")
        for error in e.errors():
            # Error format depending on Pydantic version
            loc = " -> ".join(str(x) for x in error.get("loc", ["unknown"]))
            msg = error.get("msg", "No message")
            print(f"Field: {loc}")
            print(f"Error: {msg}")
            print("-" * 30)
    except Exception as e:
        print(f"Unexpected error during Settings init: {type(e).__name__}: {e}")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Global Error: {type(e).__name__}: {e}")
