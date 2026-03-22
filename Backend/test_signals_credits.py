"""Validation tests for Signal Credit Management."""
import os
from unittest.mock import MagicMock
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.api.routes.events_routes import SIGNALS_CREDIT_COSTS, _check_credits, _deduct
from app.main import app

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

# ── Credit Cost Tests ──────────────────────────────────────────
print("\n=== Credit Cost Tests ===")
check("enroll cost is 2", SIGNALS_CREDIT_COSTS.get("enroll") == 2)
check("update cost is 2", SIGNALS_CREDIT_COSTS.get("update") == 2)
check("fetch_api cost is 2", SIGNALS_CREDIT_COSTS.get("fetch_api") == 2)
check("delete cost is 0", SIGNALS_CREDIT_COSTS.get("delete") == 0)

# ── Helper Tests ───────────────────────────────────────────────
print("\n=== Helper Logic Tests ===")

mock_db = MagicMock(spec=Session)

# Mock get_user_credits and deduct_credits if they were imported correctly
# Since they are imported into events_routes, we'd need to mock them there
import app.api.routes.events_routes as er
er.get_user_credits = MagicMock(return_value=10)
er.deduct_credits = MagicMock()

try:
    _check_credits(mock_db, "user-123", 2)
    check("Check credits (sufficient)", True)
except HTTPException:
    check("Check credits (sufficient)", False)

er.get_user_credits.return_value = 1
try:
    _check_credits(mock_db, "user-123", 2)
    check("Check credits (insufficient) raises 402", False)
except HTTPException as exc:
    check("Check credits (insufficient) raises 402", exc.status_code == 402)

# Test _deduct
er.deduct_credits.reset_mock()
_deduct(mock_db, "user-123", 2, "Test deduction")
check("Deduct credits calls utility", er.deduct_credits.called)

_deduct(mock_db, "user-123", 0, "Free action")
check("Deduct 0 credits skips utility", er.deduct_credits.call_count == 1) # Only called once before

# ── Route Registration Tests ──────────────────────────────────
print("\n=== Route Registration Tests ===")
routes = {r.path for r in app.routes if hasattr(r, "path")}
check("/api/v1/events/businesses/events registered", "/api/v1/events/businesses/events" in routes)
check("/api/v1/events/prospects/events registered", "/api/v1/events/prospects/events" in routes)
check("/api/v1/events/businesses/enrollments registered", "/api/v1/events/businesses/enrollments" in routes)
check("/api/v1/events/prospects/enrollments registered", "/api/v1/events/prospects/enrollments" in routes)

# ── Summary ───────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed, {passed+failed} total")
if failed == 0:
    print("ALL SIGNAL CREDIT TESTS PASSED!")
else:
    print("SOME SIGNAL CREDIT TESTS FAILED!")
    exit(1)
