/**
 * Helpers for navigating the user from the Outmate dashboard (`:3000`) to
 * the agentic canvas (`:7860`) without prompting them to log in twice.
 *
 * The flow:
 *   1. Browser hits `${API_BASE}/api/v1/auth/agentic-bridge?next=…` while
 *      carrying the user's main-stack JWT cookie.
 *   2. Main backend validates the session, mints a short-lived
 *      `outmate_bridge` JWT, and 302s the browser to the agentic stack's
 *      `/api/v1/auth/bridge` endpoint with `?token=…&next=…`.
 *   3. Agentic stack validates the bridge JWT, sets its native
 *      `access_token_lf` cookie for the same user UUID (auto-provisioning
 *      the agentic User row on first hit), and 302s to `next`.
 *
 * Always go through this helper rather than building a `:7860` URL by hand
 * — direct hits won't carry an `access_token_lf` cookie once AUTO_LOGIN is
 * disabled in production.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

// Match the key `Frontend/lib/auth.ts` uses to stash the JWT.
const AUTH_KEY = "outmate_auth_token";

/**
 * Read the current main-stack JWT out of localStorage. Returns null on the
 * server (`typeof window === "undefined"`) and when the user is logged out.
 */
function readMainJwt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_KEY);
}

/**
 * Build the URL that, when followed in the browser, lands the user on the
 * agentic canvas at `next` already authenticated.
 *
 * Top-level navigations can't carry an `Authorization: Bearer` header, so
 * we attach the user's main-stack JWT to the URL via `?auth=<jwt>`. The
 * server-side bridge accepts it from there as well as from the standard
 * Authorization header. The token only lives in the URL for the ~1 redirect
 * hop to the agentic stack — it is NOT persisted by either backend.
 *
 * @param next  Path on the agentic side (defaults to `/all`). Must start
 *              with `/`; the agentic backend rejects non-relative paths to
 *              prevent this becoming an open-redirect.
 */
export function agenticBridgeUrl(next: string = "/all"): string {
  const safe = next.startsWith("/") ? next : "/all";
  const params = new URLSearchParams({ next: safe });
  const jwt = readMainJwt();
  if (jwt) params.set("auth", jwt);
  return `${API_BASE}/api/v1/auth/agentic-bridge?${params.toString()}`;
}

/**
 * Convenience: navigate the current tab to a flow on the agentic side.
 */
export function openAgenticFlow(flowId: string): void {
  if (typeof window === "undefined") return;
  window.location.href = agenticBridgeUrl(`/flow/${flowId}`);
}

/**
 * Convenience: open the agentic canvas's flow list ("/all") in the current tab.
 */
export function openAgenticHome(): void {
  if (typeof window === "undefined") return;
  window.location.href = agenticBridgeUrl("/all");
}
