import time
import sys

modules = [
    "os", "dotenv", "fastapi", "sqlalchemy", "logging",
    "app.db.vector_setup", "app.db.base", "app.db.session",
    "app.db.deps", "app.db.models.user", "app.core.redis",
    "app.api.routes.leads", "app.api.routes.contactout_routes",
    "app.api.routes.crustdata_routes", "app.api.routes.explorium_routes",
    "app.api.routes.auth", "app.api.routes.signals",
    "app.api.routes.campaigns", "app.api.routes.chat",
    "app.api.routes.chat_history", "app.api.routes.bettercontact_routes",
    "app.api.routes.enrichment_routes", "app.api.routes.ai_agents",
    "app.api.routes.gtm_agents", "app.api.routes.visitors",
    "app.api.routes.diagnostics", "app.api.routes.copilot",
    "app.api.routes.events_routes", "app.core.logging",
    "app.core.config", "app.core.rate_limiting",
    "app.api.routes.prospects", "app.api.routes.companies",
    "app.api.deps.auth"
]

for mod in modules:
    start = time.time()
    try:
        __import__(mod)
        print(f"Import {mod:40} took {time.time() - start:.3f}s")
    except Exception as e:
        print(f"Import {mod:40} FAILED: {e}")
