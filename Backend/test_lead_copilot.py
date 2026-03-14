"""Quick validation tests for Lead Copilot feature."""
import os
os.environ["MOCK_LLM"] = "1"

from app.schemas.copilot import (
    LeadActionType, LeadActionRequest, LeadContextResponse,
    LeadActionResponse, LeadSuggestionsResponse,
    AnnotatedEmailTag, AnnotatedEmailSegment, AnnotatedEmailDraft,
)
from app.services.copilot.lead_copilot_service import LeadCopilotService
from app.services.copilot.prompts import (
    ANNOTATED_EMAIL_SYSTEM_PROMPT, LEAD_RESEARCH_SYSTEM_PROMPT,
    OBJECTION_HANDLER_SYSTEM_PROMPT, LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT,
    LEAD_SUGGESTIONS_SYSTEM_PROMPT,
)
from app.api.routes.copilot import COPILOT_CREDIT_COSTS

passed = 0
failed = 0

def check(name, condition):
    global passed, failed
    if condition:
        print(f"  PASS: {name}")
        passed += 1
    else:
        print(f"  FAIL: {name}")
        failed += 1

# ── Schema Tests ──────────────────────────────────────────────
print("\n=== Schema Tests ===")

check("LeadActionType.draft_email", LeadActionType.draft_email == "draft_email")
check("LeadActionType.meeting_prep", LeadActionType.meeting_prep == "meeting_prep")
check("LeadActionType.research", LeadActionType.research == "research")
check("LeadActionType.find_similar", LeadActionType.find_similar == "find_similar")
check("LeadActionType.objection_handler", LeadActionType.objection_handler == "objection_handler")
check("LeadActionType.custom", LeadActionType.custom == "custom")

# Valid request
req = LeadActionRequest(prospect_id="123", action_type=LeadActionType.draft_email, prompt="Write a follow-up email")
check("Valid request creation", req.prospect_id == "123" and req.prompt == "Write a follow-up email")

# HTML sanitization
req2 = LeadActionRequest(prospect_id="1", action_type=LeadActionType.custom, prompt="<script>alert(1)</script>Hello")
check("HTML sanitization strips tags", "<script>" not in req2.prompt and "Hello" in req2.prompt)

# Prompt length limit
try:
    LeadActionRequest(prospect_id="1", action_type=LeadActionType.custom, prompt="x" * 1001)
    check("Prompt length validation", False)
except Exception:
    check("Prompt length validation", True)

# Optional prompt (should default to None)
req3 = LeadActionRequest(prospect_id="1", action_type=LeadActionType.draft_email)
check("Optional prompt defaults to None", req3.prompt is None)

# AnnotatedEmailTag enum
check("AnnotatedEmailTag.personalization", AnnotatedEmailTag.personalization == "PERSONALIZATION")
check("AnnotatedEmailTag.cta", AnnotatedEmailTag.cta == "CTA")

# Response models can be instantiated
resp = LeadActionResponse(action_type="draft_email", result={"subject": "Test"}, credits_used=2)
check("LeadActionResponse creation", resp.credits_used == 2)

# ── Prompts Tests ─────────────────────────────────────────────
print("\n=== Prompts Tests ===")

check("ANNOTATED_EMAIL prompt exists", len(ANNOTATED_EMAIL_SYSTEM_PROMPT) > 100)
check("ANNOTATED_EMAIL mentions JSON", "JSON" in ANNOTATED_EMAIL_SYSTEM_PROMPT or "json" in ANNOTATED_EMAIL_SYSTEM_PROMPT)
check("LEAD_RESEARCH prompt exists", len(LEAD_RESEARCH_SYSTEM_PROMPT) > 100)
check("OBJECTION_HANDLER prompt exists", len(OBJECTION_HANDLER_SYSTEM_PROMPT) > 100)
check("LEAD_CUSTOM_COMMAND prompt exists", len(LEAD_CUSTOM_COMMAND_SYSTEM_PROMPT) > 100)
check("LEAD_SUGGESTIONS prompt exists", len(LEAD_SUGGESTIONS_SYSTEM_PROMPT) > 100)

# ── Credit Costs Tests ────────────────────────────────────────
print("\n=== Credit Costs Tests ===")

check("lead_draft_email cost", COPILOT_CREDIT_COSTS.get("lead_draft_email") == 1)
check("lead_meeting_prep cost", COPILOT_CREDIT_COSTS.get("lead_meeting_prep") == 2)
check("lead_research cost", COPILOT_CREDIT_COSTS.get("lead_research") == 2)
check("lead_find_similar cost", COPILOT_CREDIT_COSTS.get("lead_find_similar") == 1)
check("lead_objection_handler cost", COPILOT_CREDIT_COSTS.get("lead_objection_handler") == 1)
check("lead_custom cost", COPILOT_CREDIT_COSTS.get("lead_custom") == 1)
check("lead_suggestions cost", COPILOT_CREDIT_COSTS.get("lead_suggestions") == 1)

# ── Service Tests (Mock Mode) ────────────────────────────────
print("\n=== Service Mock Tests ===")

from unittest.mock import MagicMock
mock_db = MagicMock()

svc = LeadCopilotService(mock_db)
check("Service instantiation", svc is not None)
check("Service has get_lead_context", hasattr(svc, "get_lead_context"))
check("Service has execute_action", hasattr(svc, "execute_action"))
check("Service has get_suggestions", hasattr(svc, "get_suggestions"))

# ── Route Registration Tests ──────────────────────────────────
print("\n=== Route Registration Tests ===")

from app.main import app
routes = {r.path for r in app.routes if hasattr(r, "path")}
check("/api/copilot/lead-context/{prospect_id} registered", "/api/copilot/lead-context/{prospect_id}" in routes)
check("/api/copilot/lead-action registered", "/api/copilot/lead-action" in routes)
check("/api/copilot/lead-suggestions/{prospect_id} registered", "/api/copilot/lead-suggestions/{prospect_id}" in routes)

# ── Summary ───────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed, {passed+failed} total")
if failed == 0:
    print("ALL TESTS PASSED!")
else:
    print("SOME TESTS FAILED!")
    exit(1)
