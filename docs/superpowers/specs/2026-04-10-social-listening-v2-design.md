# Social Listening v2 — Production-Ready Design

## Goal

Transform the Social Listening feature from a basic MVP into a production-grade social monitoring product matching competitor quality (reference: Leadmate/trigify-grade product).

## Architecture

### Create Search Wizard (3-step)

**Step 1 — Source & Name**
- Search name input
- Source selector (radio cards):
  - Monitor posts on LinkedIn (default, uses CrustData LinkedIn Posts API)
  - Monitor profile activity (CrustData person activity)
  - Monitor comments & reactions (CrustData engagement)
  - Monitor posts on X (Apify Twitter actor — requires key)
  - Monitor Reddit threads (Apify Reddit actor — requires key)
  - Monitor G2 reviews (Serper → G2 search)
- Each source shows availability badge (green if API key configured, grey if not)

**Step 2 — Query Builder**
- Boolean query with AND/OR/NOT keyword groups
- Field filters: Job Title, Company, Industry, Seniority
- Time frame: Last hour / Today / Last week / Last month
- Language & Country selectors
- Toggle options: Hide replies, Must contain links, Exclude sponsored
- Live preview panel (right side) showing sample matching signals from a dry-run

**Step 3 — Frequency & Actions**
- Run frequency: Hourly / Daily / Weekly / Manual
- Credit cost display per signal
- Auto-action toggles:
  - Enrich contact automatically (uses waterfall: CrustData → Explorium → BetterContact)
  - Send AI outreach email (drafts via LLM, queues for review)
  - Push to CRM (HubSpot stub, shows preview)
- Complete button

### Signal Taxonomy Extension

Add to `signal_events` table:
- `funnel_stage` — enum: awareness, consideration, expansion, in_market
- `gtm_category` — enum: product_led, sales_led, community_led, partner, event, system, competitor
- `trigger_type` — enum: history_based, relationship_based, behavioral, technographic, symptoms_signs, in_market, firmographic
- `signal_strength` — enum: high, medium, low

These get populated by an LLM classifier at ingestion time (fast inline call via OpenRouter).

### Search Criteria Schema (Backend)

Extend `watcher.criteria` JSON to include:
```json
{
  "keywords": ["ai agents", "agentic workflows"],
  "boolean_query": {
    "must": ["ai agents"],
    "should": ["automation", "workflows"],
    "must_not": ["hiring", "job opening"]
  },
  "source": "linkedin_posts",
  "filters": {
    "job_titles": ["CTO", "VP Engineering"],
    "seniority": ["c_level", "vp", "director"],
    "industries": [],
    "companies": [],
    "languages": ["en"],
    "countries": []
  },
  "time_frame": "week",
  "hide_replies": true,
  "must_contain_links": false,
  "exclude_sponsored": true,
  "auto_enrich": true,
  "auto_outreach": false,
  "auto_crm_push": false,
  "schedule": "daily",
  "max_leads": 10
}
```

### Data Sources (priority order)

1. **CrustData LinkedIn Posts** — primary. Already configured. Searches LinkedIn posts/activity by keyword + filters.
2. **Explorium** — company firmographics enrichment, funding signals, technographics.
3. **Serper** — Google search for G2 reviews, news mentions, blog posts.
4. **Tavily** — deep web research for prospect context.
5. **Apify** (when configured) — Twitter/X scraping, Reddit monitoring, LinkedIn profile scraping.
6. **BrightData** (when configured) — fallback LinkedIn scraping, large-scale data collection.

### Signal Card Enhancements

- Show funnel stage badge (Awareness/Consideration/etc.)
- Show signal strength indicator (high/medium/low color)
- Show trigger type tag
- Expandable outreach draft with copy button
- "View on LinkedIn/X/Reddit" direct link
- Bulk actions: select multiple → enrich all / export CSV

### File Structure

```
Frontend/
  app/(dashboard)/social-agent/
    page.tsx                    # Main page (already exists, enhance)
    _components/
      create-search-wizard.tsx  # 3-step wizard
      signal-card.tsx           # Enhanced signal card
      query-builder.tsx         # Boolean query builder
      source-selector.tsx       # Source radio cards
      search-sidebar.tsx        # Extracted sidebar

Backend/
  app/api/routes/social_listening.py  # Extend with preview endpoint
  app/services/social_listening/
    service.py                         # Extend with multi-source dispatch
    sources/
      linkedin_crustdata.py            # CrustData LinkedIn posts source
      linkedin_apify.py               # Apify LinkedIn fallback
      twitter_apify.py                 # Twitter/X source
      reddit_apify.py                  # Reddit source
      g2_serper.py                     # G2 reviews via Google search
    classifier.py                      # LLM-based signal taxonomy classifier
    enrichment_cascade.py              # Auto-enrich waterfall
```

## Non-Goals (v2)

- Real-time streaming updates (use polling for now)
- Custom signal type creation by users
- Slack/email notifications for new signals
- Multi-user collaboration on searches

## Success Criteria

1. User can create a search via the 3-step wizard
2. Running a search returns real signals from CrustData LinkedIn
3. Signals display with proper taxonomy (funnel stage, strength, trigger type)
4. Auto-enrich toggle actually enriches contacts
5. Outreach drafts are generated and shown in expanded card
6. Query builder supports AND/OR/NOT boolean logic
