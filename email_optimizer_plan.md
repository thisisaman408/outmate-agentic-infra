# Email Optimizer — Deep Enrichment Implementation Plan

## Goal

Transform the existing Campaign Optimizer into a full **Email Optimizer** that generates hyper-personalized, human-sounding outreach emails by enriching the LLM with real-time data from YouTube, LinkedIn, Google (via Serper), Tavily web search, and Explorium — so leads feel they're communicating with a real person, not an AI agent.

---

## Current State

### What exists today
- **Campaign Optimizer** endpoint: `POST /api/copilot/campaign-optimizer`
- Scores emails on 6 categories, suggests subject lines + openers
- Only enrichment: Tavily news search (generic industry trends)
- No lead-specific data, no social signals, no rewritten output

### External APIs already integrated (but NOT wired to Campaign Optimizer)
| API | Exists In | Wired to Campaign Optimizer? |
|-----|-----------|------------------------------|
| **Explorium** (firmographics, funding, tech stack, headcount) | `enrichment.py`, `ai_agents_service.py` | No |
| **Tavily** (web search) | `enrichment.py` | Yes (generic news only) |
| **Serper** (Google search) | `ai_agents_service.py._call_serper()` | No |
| **Google News RSS** (news, YouTube via `site:youtube.com`) | `signal_fetcher_service.py` | No |
| **LinkedIn API** | Not integrated anywhere | N/A |
| **YouTube Data API** | Not integrated anywhere | N/A |

---

## Implementation Plan

### Phase 1: Lead Context Enrichment Pipeline (Backend)

**New file: `Backend/app/services/copilot/lead_enrichment.py`**

A dedicated module that gathers multi-source intelligence on a specific lead before email generation. Each source is independent, so all can run concurrently via `asyncio.gather()` with individual try/except (graceful fallback if any source fails).

#### 1.1 Google Search (Serper) — lead's recent activity
```
Query: "{lead_name} {lead_company} {lead_role} recent news interview podcast"
```
- Reuse `_call_serper()` pattern from `ai_agents_service.py`
- Extract: recent mentions, quotes, conference appearances, press coverage
- Already have `SERPER_API_KEY` in settings

#### 1.2 YouTube (Serper `site:youtube.com` search)
```
Query: "{lead_name} {lead_company} site:youtube.com"
```
- Use Serper with `site:youtube.com` filter (same approach as signal_fetcher_service.py)
- No YouTube Data API key needed — Serper handles it
- Extract: recent talks, interviews, webinar appearances, channel activity
- Fallback: Google News RSS `site:youtube.com` search (already exists in signal_fetcher_service.py)

#### 1.3 LinkedIn Activity (Tavily web search)
```
Query: "{lead_name} {lead_company} LinkedIn post OR article site:linkedin.com"
```
- Tavily can search public LinkedIn post pages that are indexed by Google
- No LinkedIn API or OAuth needed — this searches publicly available content
- Extract: recent posts, article topics, professional interests, engagement themes
- Limitation: Only gets publicly indexed posts (not all activity). This is a reasonable tradeoff vs. the complexity of LinkedIn API OAuth + rate limits.

#### 1.4 Company Enrichment (Explorium) — already built
```python
enrichment.enrich_company(lead_company, lead_domain)
```
- Firmographics, funding rounds, tech stack, headcount growth, investors
- Already implemented in `enrichment.py` — just needs to be wired in

#### 1.5 Recent Company News (Tavily) — already built
```python
enrichment.fetch_recent_news(lead_company)
```
- Already implemented — needs to use company name instead of generic audience

#### Lead Enrichment Output Format
```python
@dataclass
class LeadContext:
    # Lead identity
    name: str
    company: str
    role: str
    domain: Optional[str]

    # Enriched data (all Optional — graceful fallback)
    google_mentions: list[dict]       # title, snippet, url
    youtube_appearances: list[dict]   # title, snippet, url, channel
    linkedin_posts: list[dict]        # title, snippet, url
    company_data: dict                # Explorium firmographics
    recent_news: list[dict]           # Tavily company news

    def to_prompt_context(self) -> str:
        """Formats all enrichment into a structured text block for the LLM prompt."""
```

---

### Phase 2: Enhanced LLM Prompt & Output (Backend)

**File: `Backend/app/services/copilot/prompts.py`**

Add `EMAIL_OPTIMIZER_SYSTEM_PROMPT` alongside (not replacing) the existing campaign optimizer prompt.

#### Key prompt instructions:
```
You are a senior sales strategist writing personalized cold outreach emails.
You have access to real intelligence about the recipient. USE IT to write
emails that feel like they come from a human who actually researched this person.

PERSONALIZATION RULES:
- Reference specific things the lead has said, posted, or done recently
- Mention their company's recent milestones (funding, hiring, product launches)
- Connect YOUR value prop to THEIR specific situation
- Use their first name naturally (not just "Hi {name}")
- Mirror their communication style if LinkedIn posts are available

TONE RULES:
- Conversational, not corporate. Write like a smart colleague, not a marketer.
- No "I hope this email finds you well" or similar filler
- Keep the email 50–120 words (strictly enforced)
- One clear CTA — ask for a specific time/action, not "let me know your thoughts"

OUTPUT (JSON):
{
  "optimized_email": {
    "subject_line": "string",
    "body": "string (50-120 words)",
    "personalization_hooks_used": ["string — which lead data points were woven in"]
  },
  "follow_up_sequence": [
    {
      "delay_days": 3,
      "subject_line": "string",
      "body": "string (40-80 words)",
      "strategy": "string — what angle this follow-up takes"
    },
    { ... 2nd follow-up at day 7 ... },
    { ... 3rd follow-up at day 14 (breakup email) ... }
  ],
  "reply_probability": {
    "score": 0-100,
    "reasoning": "string — why this score",
    "boost_suggestions": ["string — specific changes that would increase the score"]
  },
  "analysis": {
    "overall_score": 0-100,
    "category_scores": {
      "subject_line": 0-100,
      "personalization": 0-100,
      "value_proposition": 0-100,
      "call_to_action": 0-100,
      "tone_and_length": 0-100,
      "spam_risk": 0-100
    },
    "weaknesses": ["string"],
    "improvements": ["string"]
  }
}
```

---

### Phase 3: Schema & Service Changes (Backend)

**File: `Backend/app/schemas/copilot.py`**

New/extended schemas (backward-compatible — all new fields are Optional):

```python
class EmailOptimizerRequest(BaseModel):
    # Existing fields
    subject_line: str
    email_body: str
    target_audience: Optional[str] = None
    campaign_id: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

    # NEW — lead context for deep personalization
    lead_name: Optional[str] = None
    lead_company: Optional[str] = None
    lead_role: Optional[str] = None
    lead_domain: Optional[str] = None      # company website domain
    lead_linkedin_url: Optional[str] = None  # for targeted LinkedIn search

class EmailOptimizerResponse(BaseModel):
    # Existing analysis fields (preserved for backward compat)
    id: str
    overall_score: int
    category_scores: Dict[str, int]
    weaknesses: List[str]
    improvements: List[str]
    suggested_subjects: List[str]
    suggested_openers: List[str]
    predicted_lift: str

    # NEW — optimizer output
    optimized_email: Optional[OptimizedEmail] = None
    follow_up_sequence: Optional[List[FollowUpEmail]] = None
    reply_probability: Optional[ReplyProbability] = None
    enrichment_sources_used: Optional[List[str]] = None

class OptimizedEmail(BaseModel):
    subject_line: str
    body: str
    personalization_hooks_used: List[str]

class FollowUpEmail(BaseModel):
    delay_days: int
    subject_line: str
    body: str
    strategy: str

class ReplyProbability(BaseModel):
    score: int  # 0-100
    reasoning: str
    boost_suggestions: List[str]
```

**File: `Backend/app/services/copilot/campaign_optimizer_service.py`**

Extend `analyze()` method:
1. If `lead_name` + `lead_company` provided → run `LeadEnrichmentService.enrich(lead)` concurrently
2. Inject enrichment context into the LLM prompt
3. Use `EMAIL_OPTIMIZER_SYSTEM_PROMPT` (new prompt) instead of `CAMPAIGN_OPTIMIZER_SYSTEM_PROMPT`
4. Parse extended JSON output
5. If lead context is NOT provided → fall back to existing behavior (score-only, no rewrite)

This keeps the existing endpoint working as-is for users who just want scoring, while unlocking the full optimizer when lead data is provided.

---

### Phase 4: API Route (Backend)

**Approach: Extend existing endpoint**
- `POST /api/copilot/campaign-optimizer` continues to work
- When `lead_name` + `lead_company` are provided in the request, it activates the enrichment pipeline and returns the extended response
- Credit cost: **2 credits** when enrichment is used (vs. 1 for score-only) — because of external API calls

---

### Phase 5: Frontend (Next.js)

**File: `Frontend/app/(dashboard)/copilot/campaign-optimizer/page.tsx`**

Extend the form and results display:

#### Form additions:
```
┌─────────────────────────────────────────┐
│  Subject Line *         [____________]  │
│  Email Body *           [____________]  │
│                         [            ]  │
│  ─── Lead Context (optional) ────────   │
│  Lead Name              [____________]  │
│  Lead Company           [____________]  │
│  Lead Role/Title        [____________]  │
│  Company Domain         [____________]  │
│  ─── Metrics (optional) ─────────────   │
│  Open Rate %            [____]          │
│  Reply Rate %           [____]          │
│                                         │
│  [  Optimize Email  ]                   │
└─────────────────────────────────────────┘
```

#### Results additions (below existing score/suggestions):

1. **Optimized Email card** — full rewritten email with subject line, body, copy buttons, and "Use This Email" action button
2. **Reply Probability gauge** — circular score (0–100) with color coding + reasoning text + boost suggestions list
3. **Follow-Up Sequence accordion** — 3 follow-up emails, each with delay badge ("Day 3", "Day 7", "Day 14"), subject, body, strategy note, and copy button
4. **Enrichment Sources badge row** — shows which data sources were used (Google, YouTube, LinkedIn, Explorium, Tavily) with green/gray indicators
5. **Personalization Hooks** — pills showing what lead data points were woven into the email ("Referenced their Series B", "Mentioned their PyCon talk", etc.)

---

## Feasibility Assessment

| Capability | Feasibility | Approach | API Key Needed |
|------------|-------------|----------|----------------|
| Google search for lead mentions | **High** | Serper (already integrated) | `SERPER_API_KEY` (exists) |
| YouTube appearances | **High** | Serper `site:youtube.com` (pattern exists) | Same `SERPER_API_KEY` |
| LinkedIn recent posts | **Medium** | Tavily `site:linkedin.com` search for public posts | `TAVILY_API_KEY` (exists) |
| Company firmographics | **High** | Explorium (already built in enrichment.py) | `EXPLORIUM_API_KEY` (exists) |
| Company news | **High** | Tavily (already built in enrichment.py) | `TAVILY_API_KEY` (exists) |
| Email rewrite (50-120 words) | **High** | Prompt engineering on OpenRouter/Claude | `OPENROUTER_API_KEY` (exists) |
| Follow-up sequence generation | **High** | Prompt engineering — single LLM call | Same key |
| Reply probability score | **High** | LLM estimation based on enrichment quality | Same key |
| LinkedIn API (full activity feed) | **Low** | Requires LinkedIn OAuth app approval (months), rate limits, ToS risk | New LinkedIn API key |
| YouTube Data API (full channel data) | **Medium** | Free tier exists but adds a new API dependency | New `YOUTUBE_API_KEY` |

### LinkedIn Limitation Note
True LinkedIn API access (reading someone's activity feed) requires a LinkedIn Developer app with Marketing or Compliance API access — this takes weeks to get approved and has strict usage policies. The **Tavily `site:linkedin.com` approach** gets ~70% of the value (public posts, articles, profile snippets) with zero new API keys. If deeper LinkedIn access is needed later, it can be added as a Phase 2 enhancement.

---

## Implementation Order

```
Phase 1: Lead Enrichment Pipeline
  ├─ lead_enrichment.py (new file)
  ├─ Wire Serper for Google + YouTube search
  ├─ Wire Tavily for LinkedIn public posts
  └─ Wire existing Explorium + Tavily company enrichment

Phase 2: Prompt + Schema Changes
  ├─ EMAIL_OPTIMIZER_SYSTEM_PROMPT in prompts.py
  ├─ New schemas (EmailOptimizerRequest/Response + sub-models)
  └─ Update CampaignOptimizerService.analyze()

Phase 3: API + Credits
  ├─ Extend campaign-optimizer route to handle lead context
  ├─ Conditional credit cost (1 for score-only, 2 for enriched)
  └─ Test with real LLM calls

Phase 4: Frontend
  ├─ Add lead context form fields
  ├─ Optimized email display with copy/use buttons
  ├─ Reply probability gauge
  ├─ Follow-up sequence accordion
  └─ Enrichment source indicators

Phase 5: Testing & Prompt Tuning
  ├─ End-to-end test with real lead data
  ├─ Tune prompt for natural, human-sounding output
  ├─ Verify all enrichment sources fail gracefully
  └─ Test backward compat (no lead data = existing behavior)
```

---

## Key Design Decisions

1. **No new API keys required** — everything works with existing Serper + Tavily + Explorium + OpenRouter keys
2. **Backward compatible** — existing campaign optimizer behavior is preserved; enrichment activates only when lead data is provided
3. **Graceful degradation** — each enrichment source is independent; if YouTube search returns nothing, the others still work
4. **Single LLM call** — all output (rewritten email, follow-ups, score, reply probability) comes from one prompt to minimize latency and cost
5. **Human-sounding output** — the prompt is specifically engineered to reference real lead data points, use conversational tone, and avoid AI-sounding patterns
6. **LinkedIn via Tavily, not LinkedIn API** — pragmatic choice that avoids API approval delays and gets most of the value from publicly indexed content