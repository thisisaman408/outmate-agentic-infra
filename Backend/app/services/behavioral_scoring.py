"""
Behavioral Scoring & Role Prediction Engine
============================================

Multi-parameter visitor behavior analysis that predicts the likely job role
(persona) of an anonymous visitor based on aggregated page journey signals.

Signal dimensions scored:
  1. Page Topic Taxonomy   — classify each URL into a functional category
  2. Dwell Time Weighting  — deeper engagement amplifies the topic signal
  3. Scroll Depth          — how far down the page the visitor scrolled (px.js v2.1+)
  4. CTA Click Tracking    — clicks on pricing/demo/contact buttons (px.js v2.1+)
  5. Visit Frequency       — repeat visitors get higher engagement scores
  6. Session Depth         — more pages per session = higher buying intent
  7. Form Interaction      — form fills indicate active evaluation
  8. Referrer Signals      — LinkedIn referrer vs organic vs direct
  9. Time-of-Day Patterns  — business-hours visits vs night browsing
  10. Query-param signals  — UTM campaign/content signals

Output:
  - predicted_persona:  "engineering" | "sales" | "executive" | "marketing" |
                        "hr" | "product" | "finance" | "unknown"
  - engagement_score:   0-100 (how engaged is this visitor overall)
  - buying_stage:       "awareness" | "consideration" | "decision"
  - persona_confidence: 0.0-1.0 (how confident the prediction is)
"""

import math
import re
import logging
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ── Page Topic Taxonomy ──────────────────────────────────────────────────────
# Maps URL path keywords to functional categories.  The engine scans each
# visited URL and tallies weighted scores per persona.

PAGE_TOPICS: Dict[str, Dict[str, float]] = {
    # ─── Engineering / Technical ──────────────────────────────────────
    "docs":         {"engineering": 1.0},
    "documentation": {"engineering": 1.0},
    "api":          {"engineering": 1.0},
    "developer":    {"engineering": 0.9},
    "developers":   {"engineering": 0.9},
    "sdk":          {"engineering": 0.9},
    "reference":    {"engineering": 0.8},
    "changelog":    {"engineering": 0.7},
    "github":       {"engineering": 0.9},
    "integrations": {"engineering": 0.7, "product": 0.3},
    "integration":  {"engineering": 0.7, "product": 0.3},
    "webhooks":     {"engineering": 0.8},
    "playground":   {"engineering": 0.8},
    "sandbox":      {"engineering": 0.8},
    "status":       {"engineering": 0.6},
    "debug":        {"engineering": 0.9},
    "tutorials":    {"engineering": 0.7},
    "quickstart":   {"engineering": 0.8},
    "getting-started": {"engineering": 0.7, "product": 0.3},

    # ─── Sales / Pricing / Buying ─────────────────────────────────────
    "pricing":      {"sales": 0.6, "executive": 0.4},
    "plans":        {"sales": 0.6, "executive": 0.4},
    "enterprise":   {"sales": 0.5, "executive": 0.5},
    "demo":         {"sales": 0.7, "executive": 0.3},
    "request-demo": {"sales": 0.7, "executive": 0.3},
    "book-demo":    {"sales": 0.7, "executive": 0.3},
    "contact-sales": {"sales": 0.8, "executive": 0.2},
    "quote":        {"sales": 0.6, "finance": 0.2, "executive": 0.2},
    "roi":          {"executive": 0.6, "finance": 0.4},
    "comparison":   {"sales": 0.5, "product": 0.3, "executive": 0.2},
    "compare":      {"sales": 0.5, "product": 0.3, "executive": 0.2},
    "vs":           {"sales": 0.5, "product": 0.3, "executive": 0.2},
    "trial":        {"sales": 0.5, "engineering": 0.3, "product": 0.2},
    "free-trial":   {"sales": 0.5, "engineering": 0.3, "product": 0.2},
    "signup":       {"sales": 0.4, "engineering": 0.3, "product": 0.3},

    # ─── Executive / Leadership ───────────────────────────────────────
    "about":        {"executive": 0.5, "hr": 0.3, "marketing": 0.2},
    "leadership":   {"executive": 0.6, "hr": 0.4},
    "investors":    {"executive": 0.7, "finance": 0.3},
    "press":        {"marketing": 0.6, "executive": 0.4},
    "newsroom":     {"marketing": 0.6, "executive": 0.4},
    "case-studies": {"executive": 0.4, "sales": 0.3, "marketing": 0.3},
    "case-study":   {"executive": 0.4, "sales": 0.3, "marketing": 0.3},
    "customers":    {"executive": 0.4, "sales": 0.3, "marketing": 0.3},
    "testimonials": {"executive": 0.3, "sales": 0.4, "marketing": 0.3},
    "whitepaper":   {"executive": 0.5, "marketing": 0.3, "product": 0.2},

    # ─── Marketing ────────────────────────────────────────────────────
    "blog":         {"marketing": 0.6, "product": 0.2, "executive": 0.2},
    "resources":    {"marketing": 0.5, "sales": 0.3, "engineering": 0.2},
    "webinar":      {"marketing": 0.5, "sales": 0.3, "executive": 0.2},
    "webinars":     {"marketing": 0.5, "sales": 0.3, "executive": 0.2},
    "events":       {"marketing": 0.6, "executive": 0.2, "sales": 0.2},
    "ebook":        {"marketing": 0.5, "executive": 0.3, "sales": 0.2},
    "newsletter":   {"marketing": 0.7, "sales": 0.2, "executive": 0.1},
    "podcast":      {"marketing": 0.6, "executive": 0.3, "product": 0.1},

    # ─── Product / Features ───────────────────────────────────────────
    "features":     {"product": 0.5, "sales": 0.3, "engineering": 0.2},
    "product":      {"product": 0.6, "sales": 0.2, "engineering": 0.2},
    "solutions":    {"product": 0.4, "sales": 0.3, "executive": 0.3},
    "use-cases":    {"product": 0.5, "sales": 0.3, "executive": 0.2},
    "platform":     {"product": 0.5, "engineering": 0.3, "executive": 0.2},
    "security":     {"engineering": 0.4, "executive": 0.3, "product": 0.3},
    "compliance":   {"executive": 0.3, "finance": 0.3, "product": 0.2, "engineering": 0.2},
    "gdpr":         {"executive": 0.3, "finance": 0.3, "engineering": 0.2, "product": 0.2},
    "soc2":         {"engineering": 0.4, "executive": 0.3, "finance": 0.3},

    # ─── HR / Careers ─────────────────────────────────────────────────
    "careers":      {"hr": 0.8, "executive": 0.2},
    "jobs":         {"hr": 0.9, "executive": 0.1},
    "hiring":       {"hr": 0.8, "executive": 0.2},
    "culture":      {"hr": 0.7, "marketing": 0.3},
    "team":         {"hr": 0.5, "executive": 0.3, "marketing": 0.2},
    "benefits":     {"hr": 0.8, "executive": 0.2},

    # ─── Finance / Billing ────────────────────────────────────────────
    "billing":      {"finance": 0.7, "executive": 0.3},
    "invoice":      {"finance": 0.8, "executive": 0.2},
    "payment":      {"finance": 0.6, "sales": 0.2, "executive": 0.2},
    "subscription": {"finance": 0.5, "sales": 0.3, "executive": 0.2},

    # ─── Support / Help ──────────────────────────────────────────────
    "support":      {"engineering": 0.4, "product": 0.3, "sales": 0.3},
    "help":         {"engineering": 0.4, "product": 0.4, "sales": 0.2},
    "faq":          {"product": 0.4, "sales": 0.3, "engineering": 0.3},
    "contact":      {"sales": 0.5, "executive": 0.3, "product": 0.2},

    # ─── Legal / Privacy ─────────────────────────────────────────────
    "privacy":      {"executive": 0.3, "finance": 0.3, "engineering": 0.2, "product": 0.2},
    "terms":        {"finance": 0.4, "executive": 0.4, "engineering": 0.2},
    "legal":        {"finance": 0.5, "executive": 0.5},

    # ─── Extended Engineering ──────────────────────────────────────
    "openapi":      {"engineering": 1.0},
    "graphql":      {"engineering": 1.0},
    "grpc":         {"engineering": 0.9},
    "oauth":        {"engineering": 0.8},
    "saml":         {"engineering": 0.7, "executive": 0.3},
    "sso":          {"engineering": 0.6, "executive": 0.4},
    "cli":          {"engineering": 1.0},
    "docker":       {"engineering": 1.0},
    "kubernetes":   {"engineering": 1.0},
    "terraform":    {"engineering": 1.0},
    "cicd":         {"engineering": 0.9},
    "deploy":       {"engineering": 0.7, "product": 0.3},
    "infrastructure": {"engineering": 0.8, "executive": 0.2},
    "migration":    {"engineering": 0.7, "executive": 0.3},

    # ─── Extended Sales ────────────────────────────────────────────
    "proposal":     {"sales": 0.7, "executive": 0.3},
    "procurement":  {"finance": 0.5, "executive": 0.3, "sales": 0.2},
    "purchase":     {"finance": 0.4, "sales": 0.3, "executive": 0.3},
    "crm":          {"sales": 0.5, "marketing": 0.3, "executive": 0.2},
    "salesforce":   {"sales": 0.6, "marketing": 0.2, "engineering": 0.2},
    "hubspot":      {"marketing": 0.5, "sales": 0.3, "engineering": 0.2},

    # ─── Extended Marketing ───────────────────────────────────────
    "campaign":     {"marketing": 0.7, "sales": 0.2, "executive": 0.1},
    "seo":          {"marketing": 0.8, "engineering": 0.2},
    "analytics":    {"marketing": 0.5, "product": 0.3, "engineering": 0.2},
    "conversion":   {"marketing": 0.5, "product": 0.3, "sales": 0.2},
    "funnel":       {"marketing": 0.5, "sales": 0.3, "product": 0.2},
    "leads":        {"sales": 0.5, "marketing": 0.3, "executive": 0.2},
    "outreach":     {"sales": 0.6, "marketing": 0.4},

    # ─── Extended Product ─────────────────────────────────────────
    "roadmap":      {"product": 0.8, "executive": 0.2},
    "feedback":     {"product": 0.6, "engineering": 0.2, "sales": 0.2},
    "onboarding":   {"product": 0.5, "hr": 0.3, "sales": 0.2},
    "workflow":     {"product": 0.5, "engineering": 0.3, "sales": 0.2},
    "automation":   {"product": 0.4, "engineering": 0.4, "marketing": 0.2},
    "dashboard":    {"product": 0.4, "engineering": 0.3, "executive": 0.3},

    # ─── Extended Executive ───────────────────────────────────────
    "strategy":     {"executive": 0.7, "product": 0.2, "sales": 0.1},
    "partnership":  {"executive": 0.5, "sales": 0.3, "marketing": 0.2},
    "acquisition":  {"executive": 0.6, "finance": 0.4},
    "board":        {"executive": 0.7, "finance": 0.3},
}

# DM job title → persona mapping (used for smart DM selection)
TITLE_TO_PERSONA: Dict[str, str] = {
    # Engineering
    "cto": "engineering", "chief technology officer": "engineering",
    "vp engineering": "engineering", "vp of engineering": "engineering",
    "head of engineering": "engineering", "director of engineering": "engineering",
    "software engineer": "engineering", "developer": "engineering",
    "devops": "engineering", "architect": "engineering",
    "tech lead": "engineering", "engineering manager": "engineering",

    # Sales
    "cro": "sales", "chief revenue officer": "sales",
    "vp sales": "sales", "vp of sales": "sales",
    "head of sales": "sales", "sales director": "sales",
    "account executive": "sales", "sales manager": "sales",
    "business development": "sales", "bd manager": "sales",

    # Executive
    "ceo": "executive", "chief executive officer": "executive",
    "founder": "executive", "co-founder": "executive",
    "president": "executive", "managing director": "executive",
    "partner": "executive", "general manager": "executive",
    "owner": "executive", "chairman": "executive",
    "coo": "executive", "chief operating officer": "executive",

    # Marketing
    "cmo": "marketing", "chief marketing officer": "marketing",
    "vp marketing": "marketing", "vp of marketing": "marketing",
    "head of marketing": "marketing", "marketing director": "marketing",
    "growth": "marketing", "head of growth": "marketing",
    "demand gen": "marketing", "content": "marketing",

    # HR
    "chro": "hr", "chief human resources officer": "hr",
    "vp hr": "hr", "vp of hr": "hr", "vp people": "hr",
    "head of hr": "hr", "hr director": "hr",
    "head of people": "hr", "talent acquisition": "hr",
    "recruiter": "hr", "people operations": "hr",

    # Product
    "cpo": "product", "chief product officer": "product",
    "vp product": "product", "vp of product": "product",
    "head of product": "product", "product manager": "product",
    "product director": "product", "product lead": "product",

    # Finance
    "cfo": "finance", "chief financial officer": "finance",
    "vp finance": "finance", "vp of finance": "finance",
    "controller": "finance", "head of finance": "finance",
    "finance director": "finance", "treasurer": "finance",
}

# Referrer → persona affinity
REFERRER_SIGNALS: Dict[str, Dict[str, float]] = {
    "linkedin.com":   {"executive": 0.3, "sales": 0.3, "hr": 0.2, "marketing": 0.2},
    "github.com":     {"engineering": 0.9, "product": 0.1},
    "stackoverflow.com": {"engineering": 0.9, "product": 0.1},
    "producthunt.com": {"product": 0.5, "executive": 0.3, "engineering": 0.2},
    "twitter.com":    {"marketing": 0.4, "executive": 0.3, "product": 0.3},
    "x.com":          {"marketing": 0.4, "executive": 0.3, "product": 0.3},
    "reddit.com":     {"engineering": 0.4, "product": 0.3, "marketing": 0.3},
    "google.com":     {},  # organic — no persona bias
    "bing.com":       {},
    "facebook.com":   {"marketing": 0.5, "hr": 0.3, "executive": 0.2},
    "youtube.com":    {"marketing": 0.4, "engineering": 0.3, "product": 0.3},
    "g2.com":         {"sales": 0.4, "product": 0.3, "executive": 0.3},
    "capterra.com":   {"sales": 0.4, "product": 0.3, "executive": 0.3},
    "trustradius.com": {"sales": 0.4, "product": 0.3, "executive": 0.3},
}


# ── Core Functions ───────────────────────────────────────────────────────────

def classify_page_topic(url: str) -> Dict[str, float]:
    """
    Classify a URL into persona-weighted topic scores by analysing path segments.
    Returns {persona: weight} — higher weight = stronger signal.
    """
    try:
        path = urlparse(url).path.lower().strip("/")
    except Exception:
        return {}

    scores: Dict[str, float] = {}
    segments = re.split(r"[/\-_.]", path)

    for segment in segments:
        seg = segment.strip()
        if not seg or len(seg) < 2:
            continue
        # Exact match first
        if seg in PAGE_TOPICS:
            for persona, weight in PAGE_TOPICS[seg].items():
                scores[persona] = scores.get(persona, 0.0) + weight
        else:
            # Fuzzy substring match (e.g. "api-docs" matches "api" and "docs")
            for keyword, weights in PAGE_TOPICS.items():
                if keyword in seg or seg in keyword:
                    for persona, weight in weights.items():
                        scores[persona] = scores.get(persona, 0.0) + (weight * 0.6)

    return scores


def classify_referrer(referrer: str) -> Dict[str, float]:
    """Extract persona signal from the referrer domain."""
    if not referrer:
        return {}
    try:
        domain = urlparse(referrer).netloc.lower()
    except Exception:
        return {}

    for ref_domain, signals in REFERRER_SIGNALS.items():
        if ref_domain in domain:
            return dict(signals)
    return {}


def classify_utm(url: str) -> Dict[str, float]:
    """
    Extract persona signals from UTM query parameters.
    utm_content / utm_campaign often hint at the target audience.
    """
    try:
        qs = parse_qs(urlparse(url).query)
    except Exception:
        return {}
    signals: Dict[str, float] = {}
    combined = " ".join(
        v for key in ("utm_content", "utm_campaign", "utm_term", "utm_source")
        for v in qs.get(key, [])
    ).lower()
    if not combined:
        return {}
    UTM_PERSONA_PATTERNS = [
        (r"engineer|devops|developer|api|sdk|tech", "engineering", 0.6),
        (r"sales|revenue|pipeline|crm|deals", "sales", 0.6),
        (r"marketing|demand.gen|growth|seo|content", "marketing", 0.6),
        (r"ceo|cto|cfo|exec|leader|founder", "executive", 0.7),
        (r"product|pm|feature|roadmap", "product", 0.6),
        (r"hr|people|recruit|talent|hiring", "hr", 0.6),
        (r"finance|billing|budget|roi|cost", "finance", 0.6),
    ]
    for pattern, persona, weight in UTM_PERSONA_PATTERNS:
        if re.search(pattern, combined):
            signals[persona] = signals.get(persona, 0.0) + weight
    return signals


def classify_page_meta(title: str, h1: str) -> Dict[str, float]:
    """
    Extract persona signals from the page <title> and <h1> text captured by pixel.js.
    These carry much richer context than URL paths alone because pages often have
    descriptive headings ("Enterprise Security & Compliance Overview") that are
    invisible in the URL slug.
    """
    text = f"{title or ''} {h1 or ''}".lower()
    if not text.strip():
        return {}
    META_PATTERNS = [
        (r"pricing|plans|cost|subscription|per seat", {"sales": 0.5, "executive": 0.3, "finance": 0.2}),
        (r"api|sdk|developer|webhook|openapi|graphql|rest", {"engineering": 0.8}),
        (r"enterprise|security|compliance|soc2|gdpr|hipaa|iso", {"executive": 0.4, "engineering": 0.3, "finance": 0.3}),
        (r"integration|workflow|automation|no.?code|zapier", {"engineering": 0.4, "product": 0.4, "marketing": 0.2}),
        (r"roi|revenue|growth|pipeline|win rate|churn", {"executive": 0.5, "sales": 0.3, "finance": 0.2}),
        (r"careers|hiring|jobs|join us|open roles|talent", {"hr": 0.9}),
        (r"analytics|dashboard|report|insights|metrics", {"product": 0.4, "marketing": 0.3, "executive": 0.3}),
        (r"marketing|campaign|seo|ads|demand gen", {"marketing": 0.8}),
        (r"product|feature|roadmap|changelog|release", {"product": 0.6, "engineering": 0.2, "executive": 0.2}),
        (r"customer story|case study|testimonial|success", {"sales": 0.4, "executive": 0.3, "marketing": 0.3}),
        (r"demo|book a call|schedule|request a demo", {"sales": 0.6, "executive": 0.4}),
        (r"finance|billing|invoice|budget|payment", {"finance": 0.7, "executive": 0.3}),
    ]
    scores: Dict[str, float] = {}
    for pattern, boosts in META_PATTERNS:
        if re.search(pattern, text):
            for persona, w in boosts.items():
                scores[persona] = scores.get(persona, 0.0) + w
    return scores


def compute_visit_velocity(visit_history: List[Dict[str, Any]]) -> float:
    """
    Pages-per-hour in the most-recent browsing window (up to 10 visits).
    High velocity (e.g. 8 pages in 20 minutes) is a strong buying-mode signal.
    Returns a float capped at 20.0 pages/hour; 0.0 when data is insufficient.
    """
    if len(visit_history) < 2:
        return 0.0
    recent = visit_history[:10]
    try:
        dates = [
            datetime.fromisoformat(str(v.get("created_at", "")).replace("Z", "+00:00"))
            for v in recent if v.get("created_at")
        ]
        if len(dates) < 2:
            return 0.0
        span_hours = max((max(dates) - min(dates)).total_seconds() / 3600, 0.01)
        return min(len(dates) / span_hours, 20.0)
    except Exception:
        return 0.0


def apply_engagement_decay(score: int, days_since_last_visit: int) -> int:
    """
    Exponential decay with a 14-day half-life.
    A visitor who was highly engaged 4 weeks ago but hasn't returned is less
    actionable than one who visited yesterday — their score is penalised accordingly.
    Minimum returned score is 1 (never zeroes out completely).
    """
    if days_since_last_visit <= 1:
        return score
    decay = math.pow(0.5, days_since_last_visit / 14.0)
    return max(int(round(score * decay)), 1)


def is_business_hours(dt: Optional[datetime]) -> bool:
    """Return True if the datetime falls within Mon-Fri 8am-7pm UTC."""
    if not dt:
        return False
    try:
        utc = dt.astimezone(timezone.utc)
        return utc.weekday() < 5 and 8 <= utc.hour < 19
    except Exception:
        return False


def compute_engagement_score(
    total_visits: int,
    unique_pages: int,
    total_dwell_ms: int,
    has_form_fill: bool,
    has_email: bool,
    days_since_first_visit: int,
    referrer_from_professional: bool = False,
    avg_scroll_depth: float = 0.0,
    total_cta_clicks: int = 0,
    business_hours_visits: int = 0,
    velocity_pages_per_hour: float = 0.0,
) -> int:
    """
    Compute a 0-100 engagement score from aggregated visitor metrics.

    Weights:
      Visit frequency:      up to 20 points
      Page depth:           up to 15 points
      Dwell time:           up to 15 points
      Form interaction:     up to 15 points
      Recency/freshness:    up to 10 points
      Referrer quality:     up to  8 points
      Scroll depth:         up to  7 points  (pixel v2.1+)
      CTA clicks:           up to  5 points  (pixel v2.1+)
      Visit velocity:       up to  5 points  (browsing intensity)
    """
    score = 0.0

    # 1. Visit frequency (diminishing returns above 10)
    if total_visits >= 10:
        score += 20
    elif total_visits >= 5:
        score += 16
    elif total_visits >= 3:
        score += 12
    elif total_visits >= 2:
        score += 8
    else:
        score += 4

    # 2. Unique pages visited (depth of exploration)
    if unique_pages >= 8:
        score += 15
    elif unique_pages >= 5:
        score += 11
    elif unique_pages >= 3:
        score += 7
    elif unique_pages >= 2:
        score += 4
    else:
        score += 2

    # 3. Total dwell time (indicates genuine interest)
    total_dwell_sec = total_dwell_ms / 1000
    if total_dwell_sec >= 300:    # 5+ minutes total
        score += 15
    elif total_dwell_sec >= 120:  # 2+ minutes
        score += 11
    elif total_dwell_sec >= 30:   # 30+ seconds
        score += 7
    elif total_dwell_sec > 0:
        score += 3

    # 4. Form interaction (strongest buying signal)
    if has_email:
        score += 15  # email captured = max signal
    elif has_form_fill:
        score += 10

    # 5. Recency (fresh visitors are more actionable)
    if days_since_first_visit <= 1:
        score += 10
    elif days_since_first_visit <= 7:
        score += 7
    elif days_since_first_visit <= 30:
        score += 4
    else:
        score += 1

    # 6. Professional referrer
    if referrer_from_professional:
        score += 10

    # 7. Scroll depth — how far they actually read (pixel v2.1+)
    if avg_scroll_depth >= 80:
        score += 8
    elif avg_scroll_depth >= 50:
        score += 5
    elif avg_scroll_depth >= 25:
        score += 2

    # 8. CTA clicks — highest-intent signal next to form fill (pixel v2.1+)
    if total_cta_clicks >= 3:
        score += 7
    elif total_cta_clicks >= 1:
        score += 4

    # 9. Business-hours visits — strong signal of work context
    if total_visits > 0:
        bh_ratio = business_hours_visits / total_visits
        if bh_ratio >= 0.8:
            score += 5
        elif bh_ratio >= 0.5:
            score += 3

    # 10. Visit velocity — high pages/hour signals active research mode
    if velocity_pages_per_hour >= 12:
        score += 5
    elif velocity_pages_per_hour >= 6:
        score += 3
    elif velocity_pages_per_hour >= 2:
        score += 1

    return min(int(score), 100)


def predict_buying_stage(
    engagement_score: int,
    visited_pricing: bool,
    visited_demo: bool,
    has_form_fill: bool,
    total_visits: int,
) -> str:
    """
    Map visitor behaviour to a B2B buying funnel stage.
      - 'decision':      visited pricing/demo + form fill or high engagement
      - 'consideration':  multiple visits, moderate engagement
      - 'awareness':      first-time or low engagement
    """
    if (visited_pricing or visited_demo) and (has_form_fill or engagement_score >= 60):
        return "decision"
    if total_visits >= 3 or engagement_score >= 40:
        return "consideration"
    return "awareness"


def predict_persona(
    visit_history: List[Dict[str, Any]],
    referrer: str = "",
) -> Dict[str, Any]:
    """
    Aggregate all visits for a single visitor_id and predict their role.

    Each visit dict is expected to have:
      - url: str
      - dwell_time: int|None       (ms)
      - scroll_depth: int|None     (0-100 %, pixel v2.1+)
      - cta_clicks: int|None       (pixel v2.1+)
      - referrer: str|None
      - has_form_fill: bool
      - email: str|None
      - created_at: str|None

    Returns:
      {
        "predicted_persona": str,
        "persona_scores": {persona: float},
        "persona_confidence": float,
        "engagement_score": int,
        "buying_stage": str,
        "signals_breakdown": {...}
      }
    """
    persona_scores: Dict[str, float] = {}
    total_dwell_ms = 0
    unique_pages: set = set()
    visited_pricing = False
    visited_demo = False
    has_form_fill = False
    has_email = False
    first_visit_time: Optional[datetime] = None
    referrer_from_professional = False
    scroll_depths: List[float] = []
    total_cta_clicks = 0
    business_hours_visits = 0

    last_visit_time: Optional[datetime] = None

    # Recent visits (first 10) get a recency boost multiplier
    for idx, visit in enumerate(visit_history):
        recency_mult = 1.5 if idx < 5 else (1.2 if idx < 10 else 1.0)

        url = visit.get("url", "")
        dwell = visit.get("dwell_time") or 0
        ref = visit.get("referrer") or referrer or ""
        email = visit.get("email")
        scroll = visit.get("scroll_depth")
        cta = visit.get("cta_clicks") or 0

        # Track unique pages
        try:
            page = urlparse(url).path
            unique_pages.add(page)
        except Exception:
            pass

        # Accumulate dwell
        if isinstance(dwell, (int, float)) and dwell > 0:
            total_dwell_ms += int(dwell)

        # Dwell-time weighting multiplier
        if dwell and dwell > 60000:
            dwell_mult = 2.0
        elif dwell and dwell > 15000:
            dwell_mult = 1.5
        elif dwell and dwell > 5000:
            dwell_mult = 1.2
        else:
            dwell_mult = 1.0

        # Page topic classification (URL path)
        topic_scores = classify_page_topic(url)
        for persona, weight in topic_scores.items():
            persona_scores[persona] = persona_scores.get(persona, 0.0) + (weight * dwell_mult * recency_mult)

        # Page meta signals (title + h1 captured by pixel.js)
        page_title = visit.get("page_title") or ""
        page_h1 = visit.get("page_h1") or ""
        if page_title or page_h1:
            meta_scores = classify_page_meta(page_title, page_h1)
            for persona, weight in meta_scores.items():
                # Meta signals are worth ~70% of URL signals (supplementary)
                persona_scores[persona] = persona_scores.get(persona, 0.0) + (weight * 0.7 * recency_mult)

        # UTM / query-param persona signals
        utm_scores = classify_utm(url)
        for persona, weight in utm_scores.items():
            persona_scores[persona] = persona_scores.get(persona, 0.0) + (weight * recency_mult)

        # Scroll depth signal — high scroll = genuine reading → amplify topic score
        if isinstance(scroll, (int, float)) and 0 < scroll <= 100:
            scroll_depths.append(float(scroll))
            if scroll >= 75:
                for persona in list(topic_scores):
                    persona_scores[persona] = persona_scores.get(persona, 0.0) + (topic_scores[persona] * 0.4)

        # CTA clicks
        if isinstance(cta, int) and cta > 0:
            total_cta_clicks += cta
            # CTA on pricing/demo pages is a direct decision signal
            path_lower = url.lower()
            if any(kw in path_lower for kw in ("pricing", "demo", "contact")):
                persona_scores["executive"] = persona_scores.get("executive", 0.0) + (0.5 * recency_mult)
                persona_scores["sales"] = persona_scores.get("sales", 0.0) + (0.3 * recency_mult)

        # Check for pricing/demo visits
        path_lower = url.lower()
        if any(kw in path_lower for kw in ("pricing", "plans", "price")):
            visited_pricing = True
        if any(kw in path_lower for kw in ("demo", "request-demo", "book-demo", "contact-sales")):
            visited_demo = True

        # Form fills
        if visit.get("has_form_fill"):
            has_form_fill = True
        if email and email not in ("", "null", "undefined"):
            has_email = True

        # Referrer signals
        ref_scores = classify_referrer(ref)
        for persona, weight in ref_scores.items():
            persona_scores[persona] = persona_scores.get(persona, 0.0) + (weight * recency_mult)
        if ref_scores:
            referrer_from_professional = True

        # Track timestamps
        created = visit.get("created_at")
        if created:
            try:
                ts = datetime.fromisoformat(str(created).replace("Z", "+00:00"))
                if first_visit_time is None or ts < first_visit_time:
                    first_visit_time = ts
                if last_visit_time is None or ts > last_visit_time:
                    last_visit_time = ts
                if is_business_hours(ts):
                    business_hours_visits += 1
            except Exception:
                pass

    # Days since first / last visit
    now_utc = datetime.now(timezone.utc)
    days_since = 0
    days_since_last = 0
    if first_visit_time:
        days_since = max(0, (now_utc - first_visit_time).days)
    if last_visit_time:
        days_since_last = max(0, (now_utc - last_visit_time).days)

    total_visits = len(visit_history)
    unique_page_count = len(unique_pages)
    avg_scroll = sum(scroll_depths) / len(scroll_depths) if scroll_depths else 0.0

    # Visit velocity — pages browsed per hour in the recent window
    velocity = compute_visit_velocity(visit_history)

    # Compute engagement score
    raw_engagement = compute_engagement_score(
        total_visits=total_visits,
        unique_pages=unique_page_count,
        total_dwell_ms=total_dwell_ms,
        has_form_fill=has_form_fill,
        has_email=has_email,
        days_since_first_visit=days_since,
        referrer_from_professional=referrer_from_professional,
        avg_scroll_depth=avg_scroll,
        total_cta_clicks=total_cta_clicks,
        business_hours_visits=business_hours_visits,
        velocity_pages_per_hour=velocity,
    )

    # Apply time-decay: stale visitors score lower, fresh activity is prioritised
    engagement = apply_engagement_decay(raw_engagement, days_since_last)

    # Predict buying stage
    buying_stage = predict_buying_stage(
        engagement_score=engagement,
        visited_pricing=visited_pricing,
        visited_demo=visited_demo,
        has_form_fill=has_form_fill,
        total_visits=total_visits,
    )

    # Determine winning persona
    if persona_scores:
        top_persona = max(persona_scores, key=persona_scores.get)
        top_score = persona_scores[top_persona]
        total_score = sum(persona_scores.values())
        confidence = round(top_score / total_score, 2) if total_score > 0 else 0.0
    else:
        top_persona = "unknown"
        confidence = 0.0

    # Minimum confidence threshold
    if confidence < 0.25 or not persona_scores:
        top_persona = "unknown"
        confidence = 0.0

    result = {
        "predicted_persona": top_persona,
        "persona_scores": {k: round(v, 2) for k, v in sorted(persona_scores.items(), key=lambda x: -x[1])},
        "persona_confidence": confidence,
        "engagement_score": engagement,
        "buying_stage": buying_stage,
        "signals_breakdown": {
            "total_visits": total_visits,
            "unique_pages": unique_page_count,
            "total_dwell_ms": total_dwell_ms,
            "visited_pricing": visited_pricing,
            "visited_demo": visited_demo,
            "has_form_fill": has_form_fill,
            "has_email": has_email,
            "days_since_first": days_since,
            "days_since_last": days_since_last,
            "referrer_professional": referrer_from_professional,
            "avg_scroll_depth": round(avg_scroll, 1),
            "total_cta_clicks": total_cta_clicks,
            "business_hours_visits": business_hours_visits,
            "velocity_pages_per_hour": round(velocity, 1),
            "raw_engagement": raw_engagement,
        },
    }

    logger.info(
        "[BehavioralScoring] persona=%s (conf=%.2f) engagement=%d (raw=%d decay=%dd) "
        "stage=%s visits=%d scroll=%.0f%% cta=%d vel=%.1fph",
        top_persona, confidence, engagement, raw_engagement, days_since_last,
        buying_stage, total_visits, avg_scroll, total_cta_clicks, velocity,
    )

    return result


def select_best_decision_maker(
    decision_makers: List[Dict[str, Any]],
    predicted_persona: str,
) -> Optional[Dict[str, Any]]:
    """
    Given a list of decision makers and a predicted persona, select the DM
    whose job title best matches the visitor's predicted role.

    Falls back to the first DM (usually CEO/Founder) if no match.
    """
    if not decision_makers:
        return None

    if predicted_persona in ("unknown", ""):
        return decision_makers[0]

    # Score each DM by title → persona match
    scored: List[tuple] = []
    for dm in decision_makers:
        title = (dm.get("job_title") or dm.get("title") or "").lower().strip()
        dm_persona = None

        # Check exact title mapping
        for title_pattern, persona in TITLE_TO_PERSONA.items():
            if title_pattern in title:
                dm_persona = persona
                break

        # Score: 2 for exact persona match, 1 for partial match, 0 for no match
        if dm_persona == predicted_persona:
            scored.append((2, dm))
        elif dm_persona and dm_persona in ("executive",):
            # Executives are a reasonable fallback for any persona
            scored.append((1, dm))
        else:
            scored.append((0, dm))

    # Sort by match score descending, return best
    scored.sort(key=lambda x: -x[0])
    return scored[0][1]
