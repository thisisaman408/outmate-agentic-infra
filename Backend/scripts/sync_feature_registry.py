import os
import json
import sys

def get_actual_routes(dashboard_dir):
    """
    Recursively finds all Next.js routes in the dashboard directory.
    Look for folders containing page.tsx.
    """
    routes = []
    for root, dirs, files in os.walk(dashboard_dir):
        if "page.tsx" in files:
            # Convert absolute path to route path
            # E.g., /.../Frontend/app/(dashboard)/copilot/daily-brief -> /copilot/daily-brief
            rel_path = os.path.relpath(root, dashboard_dir)
            if rel_path == ".":
                route = "/"
            else:
                # Remove (dashboard) and dynamic segments if needed, though for v1 we just want the path
                route = "/" + rel_path.replace("\\", "/")
            routes.append(route)
    return routes

def check_feature_registry():
    """
    Compares the actual routes with the ones in feature-registry.json.
    """
    # Current script is at Backend/scripts/sync_feature_registry.py
    # repo_root should be Outmate_repo/
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    registry_path = os.path.join(repo_root, "feature-registry.json")
    dashboard_dir = os.path.join(repo_root, "Frontend", "app", "(dashboard)")

    if not os.path.exists(registry_path):
        print(">>> ERROR: feature-registry.json not found!")
        sys.exit(1)

    if not os.path.exists(dashboard_dir):
        print(f">>> ERROR: Dashboard directory not found at {dashboard_dir}!")
        sys.exit(1)

    with open(registry_path, 'r', encoding='utf-8') as f:
        registry = json.load(f)
    
    registered_routes = {item["route"] for item in registry.get("features", [])}
    actual_routes = get_actual_routes(dashboard_dir)

    missing_routes = []
    for route in actual_routes:
        # Ignore dynamic routes for now or handle them specifically
        if "[" in route:
            continue
            
        # Check if the route starts with any registered route
        # This handles nested pages like /copilot/daily-brief if /copilot is registered
        if not any(route == r or route.startswith(r + "/") for r in registered_routes):
            missing_routes.append(route)

    if missing_routes:
        print(">>> ERROR: The following app routes are missing from feature-registry.json:")
        for route in missing_routes:
            print(f"  - {route}")
        print("\n>>> Please add them to Outmate_repo/feature-registry.json before deploying.")
        sys.exit(1)

    print(">>> Feature registry is in sync with the codebase.")
    sys.exit(0)

if __name__ == "__main__":
    check_feature_registry()
