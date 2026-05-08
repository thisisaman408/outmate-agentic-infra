print("[IMPORT] api/v1/__init__.py: top", flush=True)
from outmate.api.v1.api_key import router as api_key_router
print("[IMPORT] api/v1/__init__.py: after api_key", flush=True)
from outmate.api.v1.auth_bridge import router as auth_bridge_router
print("[IMPORT] api/v1/__init__.py: after auth_bridge", flush=True)
from outmate.api.v1.chat import router as chat_router
from outmate.api.v1.deployments import router as deployment_router
from outmate.api.v1.endpoints import router as endpoints_router
from outmate.api.v1.files import router as files_router
print("[IMPORT] api/v1/__init__.py: after files (before flow_schedules)", flush=True)
from outmate.api.v1.flow_schedules import router as flow_schedules_router
print("[IMPORT] api/v1/__init__.py: after flow_schedules", flush=True)
from outmate.api.v1.flow_version import router as flow_version_router
from outmate.api.v1.flows import router as flows_router
from outmate.api.v1.folders import router as folders_router
print("[IMPORT] api/v1/__init__.py: before integrations", flush=True)
from outmate.api.v1.integrations import router as integrations_router
print("[IMPORT] api/v1/__init__.py: after integrations", flush=True)
from outmate.api.v1.knowledge_bases import router as knowledge_bases_router
from outmate.api.v1.login import router as login_router
from outmate.api.v1.mcp import router as mcp_router
from outmate.api.v1.mcp_projects import router as mcp_projects_router
from outmate.api.v1.model_options import router as model_options_router
from outmate.api.v1.models import router as models_router
from outmate.api.v1.monitor import router as monitor_router
from outmate.api.v1.openai_responses import router as openai_responses_router
from outmate.api.v1.projects import router as projects_router
from outmate.api.v1.starter_projects import router as starter_projects_router
from outmate.api.v1.store import router as store_router
from outmate.api.v1.traces import router as traces_router
from outmate.api.v1.users import router as users_router
from outmate.api.v1.validate import router as validate_router
from outmate.api.v1.variable import router as variables_router
from outmate.api.v1.voice_mode import router as voice_mode_router

__all__ = [
    "api_key_router",
    "auth_bridge_router",
    "chat_router",
    "deployment_router",
    "endpoints_router",
    "files_router",
    "flow_schedules_router",
    "flow_version_router",
    "flows_router",
    "folders_router",
    "integrations_router",
    "knowledge_bases_router",
    "login_router",
    "mcp_projects_router",
    "mcp_router",
    "model_options_router",
    "models_router",
    "monitor_router",
    "openai_responses_router",
    "projects_router",
    "starter_projects_router",
    "store_router",
    "traces_router",
    "users_router",
    "validate_router",
    "variables_router",
    "voice_mode_router",
]
