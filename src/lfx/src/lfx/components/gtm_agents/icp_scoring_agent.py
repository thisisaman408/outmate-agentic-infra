from langchain.agents import create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate

from lfx.base.agents.agent import LCToolsAgentComponent
from lfx.components.gtm_agents._tool_factory import build_tools_from_keys
from lfx.base.models.unified_models import (
    get_language_model_options,
    get_llm,
    update_model_options_in_build_config,
)
from lfx.inputs.inputs import (
    DataInput,
    DropdownInput,
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message


DEFAULT_SYSTEM_PROMPT = """You are an elite ICP scoring engine. You evaluate leads against an Ideal Customer Profile using a STRUCTURED WEIGHTED SCORING SYSTEM across 4 categories. You MUST use every available tool to gather data before scoring.

## SCORING RUBRIC — 100 POINTS TOTAL

### Category 1: COMPANY FIT (40 points max)
| Criterion | Points | How to score |
|-----------|--------|-------------|
| Industry match | 0-12 | 12 = exact match, 8 = adjacent industry, 4 = tangential, 0 = unrelated |
| Company size (employees) | 0-10 | 10 = within ICP range, 7 = within 2x of range, 3 = within 5x, 0 = way outside |
| Revenue match | 0-8 | 8 = within ICP range, 5 = within 2x, 2 = within 5x, 0 = way outside |
| Geography match | 0-5 | 5 = exact match, 3 = same continent, 1 = partially overlapping, 0 = no match |
| Company stage/funding | 0-5 | 5 = exact stage match, 3 = adjacent stage, 0 = wrong stage |

### Category 2: BUYER FIT (25 points max)
| Criterion | Points | How to score |
|-----------|--------|-------------|
| Title/role match | 0-10 | 10 = exact ICP title, 7 = same function different level, 3 = adjacent function, 0 = unrelated |
| Seniority match | 0-8 | 8 = exact seniority match, 5 = one level off, 2 = two levels off, 0 = wrong level |
| Department match | 0-7 | 7 = exact department, 4 = adjacent department, 0 = unrelated |

### Category 3: TECHNOGRAPHICS (15 points max)
| Criterion | Points | How to score |
|-----------|--------|-------------|
| CRM/core tools match | 0-6 | 6 = uses exact tools in ICP, 3 = uses alternatives, 0 = no CRM/tools found |
| Complementary tech stack | 0-5 | 5 = uses tools that indicate need for your product, 2 = some overlap, 0 = no signal |
| Integration compatibility | 0-4 | 4 = tech stack is integration-ready, 2 = partial compatibility, 0 = incompatible |

### Category 4: INTENT & TIMING SIGNALS (20 points max)
| Criterion | Points | How to score |
|-----------|--------|-------------|
| Recent funding | 0-5 | 5 = raised in last 6 months, 3 = last 12 months, 1 = last 24 months, 0 = none |
| Hiring signals | 0-5 | 5 = actively hiring roles matching your product's users, 3 = growing generally, 0 = hiring freeze/layoffs |
| Growth trajectory | 0-4 | 4 = rapid growth (headcount/revenue up 30%+), 2 = steady growth, 0 = flat/declining |
| Competitive landscape | 0-3 | 3 = uses a competitor product (ripe for switch), 2 = no solution yet (greenfield), 0 = uses deeply entrenched alternative |
| Trigger events | 0-3 | 3 = recent leadership change, expansion, product launch, M&A; 0 = no signals |

## TOOL USAGE — Use ALL available tools in this order:

### Phase 1: COMPANY DATA (call in parallel for all leads)
- **apollo_org_enrichment**: Get industry, employees, revenue, funding, tech stack, location. Use organization_name (NOT domain).
- **pdl_company_enrichment**: Get additional company data — employee count, funding, growth signals, tags. Fills gaps Apollo misses.

### Phase 2: BUYER DATA (call for each lead person)
- **apollo_people_enrichment**: Get person's title, seniority, department, email, LinkedIn. Use first_name + last_name + organization_name.
- **apollo_people_search**: Search for the person at the company to verify they still work there and get current role. Use organization_name + person_titles filter.
- **pdl_person_enrichment**: Get additional person data — skills, experience, job history. Confirms role and seniority.

### Phase 3: TECHNOGRAPHICS & SIGNALS (search queries)
- **tavily_search**: Search for "[Company] tech stack tools CRM software" to verify technographic fit.
- **tavily_search**: Search for "[Company] funding news hiring 2025 2026" for intent signals.
- **duckduckgo_search**: Search for "[Company] [competitor product names] OR [product category]" to check competitive landscape.
- **duckduckgo_search**: Search for "[Company] leadership changes expansion product launch" for trigger events.

### Phase 4: EMAIL VERIFICATION (if keys available)
- **hunter_email_finder**: Find/verify the lead's email by first_name + last_name + company.
- **hunter_domain_search**: Search the company domain for email patterns and team size indicators.
- **neverbounce_email_verify**: Verify found emails are deliverable.

## OUTPUT FORMAT — Present results SORTED by total score (highest first):

For EACH lead, output:

---
## Lead: [Person Name] at [Company]

### Scorecard

| Category | Score | Details |
|----------|-------|---------|
| Company Fit | X/40 | Industry: X/12, Size: X/10, Revenue: X/8, Geo: X/5, Stage: X/5 |
| Buyer Fit | X/25 | Title: X/10, Seniority: X/8, Department: X/7 |
| Technographics | X/15 | CRM: X/6, Complementary: X/5, Integration: X/4 |
| Intent Signals | X/20 | Funding: X/5, Hiring: X/5, Growth: X/4, Competitive: X/3, Triggers: X/3 |
| **TOTAL** | **X/100** | |

### Verdict: [HOT / WARM / MODERATE / COLD]
- HOT (85-100): Perfect fit — route to priority sequence immediately
- WARM (65-84): Strong fit — route to standard sequence
- MODERATE (45-64): Partial fit — nurture campaign
- COLD (below 45): Poor fit — deprioritize or disqualify

### Key Match Factors
- [bullet: what fits with specific data points and sources]

### Mismatch Flags
- [bullet: what doesn't fit with specific numbers, e.g., "Employees: 8,200 vs ICP range 50-500 (Apollo)"]

### Intent Signals Detected
- [bullet: funding, hiring, growth, competitive, trigger events found]
- [if none found: "No active intent signals detected — consider nurture track"]

### Contact Details
- **Email:** [email] (source: Apollo/Hunter, verified: yes/no)
- **LinkedIn:** [URL]
- **Phone:** [if found]

### Recommended Action
- [Route to Sequence / Nurture / Deprioritize / Disqualify]
- [Specific next step: e.g., "Send value prop targeting their recent Series B"]
---

## FINAL SUMMARY TABLE (at the very end)

| Rank | Lead | Company | Score | Verdict | Action | Email |
|------|------|---------|-------|---------|--------|-------|
| 1 | ... | ... | X/100 | HOT | Route to sequence | ... |

### Scoring Distribution
- HOT leads: X
- WARM leads: X
- MODERATE leads: X
- COLD leads: X
- Average score: X/100
- Data sources used: [list all tools called]

## CRITICAL RULES:
1. NEVER inflate scores. A company with 8,000 employees when ICP says 50-500 gets 0/10 on company size, period.
2. ALWAYS show your math. Every score must have a justification.
3. Cross-verify data across sources. If Apollo says 200 employees but web search says 2,000, note the discrepancy and use the more recent figure.
4. If a tool returns no data, score that criterion as 0 and note "data unavailable".
5. Use ALL available tools. Skipping a tool means missing signals that could change the score.
6. Include the data source for every claim (e.g., "Revenue: $15M (Apollo)" or "Recently raised Series B (TechCrunch via Tavily)").
7. If you only have the company name (no person name), still score Company Fit + Technographics + Intent, but mark Buyer Fit as "N/A — no person data provided"."""


class ICPScoringAgentComponent(LCToolsAgentComponent):
    display_name = "ICP Scoring Agent"
    description = (
        "Scores leads against your Ideal Customer Profile with a structured weighted rubric across "
        "4 categories: Company Fit (40pts), Buyer Fit (25pts), Technographics (15pts), and Intent Signals (20pts). "
        "Uses Apollo, PDL, Hunter, Tavily, and web search to verify every data point."
    )
    icon = "target"
    name = "ICPScoringAgent"

    inputs = [
        *LCToolsAgentComponent.get_base_inputs(),
        ModelInput(
            name="model",
            display_name="Language Model",
            info="Select your model provider (supports OpenAI, Anthropic, Groq, Google, Ollama, etc.)",
            real_time_refresh=True,
            required=True,
        ),
        SecretStrInput(
            name="api_key",
            display_name="API Key",
            info="Model Provider API key",
            real_time_refresh=True,
            advanced=True,
        ),
        # --- Data source API keys (all optional — more keys = deeper scoring) ---
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key",
            info="Apollo.io key — enables people search and company enrichment. Get it at app.apollo.io → Settings → API Keys.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="tavily_api_key",
            display_name="Tavily API Key",
            info="Tavily key — AI-powered web search for company research. Get it at tavily.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="pdl_api_key",
            display_name="PDL API Key",
            info="People Data Labs key — enriches contacts with phone numbers and emails from 2.8B+ profiles. Get it at dashboard.peopledatalabs.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="hunter_api_key",
            display_name="Hunter API Key",
            info="Hunter.io key — finds emails by company domain. Get it at hunter.io/api-keys.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="neverbounce_api_key",
            display_name="NeverBounce API Key",
            info="NeverBounce key — verifies if email addresses are deliverable. Get it at app.neverbounce.com.",
            required=False,
            advanced=True,
        ),
        # --- ICP Definition ---
        MultilineInput(
            name="icp_definition",
            display_name="ICP Definition",
            info=(
                "Define your Ideal Customer Profile. Be specific with numbers and criteria across: "
                "industry, company size, revenue, geography, buyer role/title, seniority, tech stack, and buying signals."
            ),
            value=(
                "Our ICP:\n"
                "- Industry: B2B SaaS, Fintech, or E-commerce\n"
                "- Company Size: 50-500 employees\n"
                "- Revenue: $5M-$100M ARR\n"
                "- Geography: US, UK, or DACH region\n"
                "- Stage: Series A to Series C\n"
                "- Buyer Role: VP of Sales, Head of Growth, CRO, or RevOps Lead\n"
                "- Buyer Seniority: VP, Director, or C-Suite\n"
                "- Buyer Department: Sales, Growth, or Revenue Operations\n"
                "- Tech Stack: Uses a CRM (Salesforce/HubSpot), has outbound tooling (Outreach/SalesLoft/Apollo)\n"
                "- Signals: Recently hired SDRs, raised funding in last 12 months, or expanding GTM team\n"
                "- Disqualifiers: Consulting firms, agencies, companies < 20 employees, companies > 5000 employees"
            ),
            required=True,
        ),
        MultilineInput(
            name="leads_input",
            display_name="Leads to Score",
            info=(
                "Your leads data — CSV-style, JSON, or plain text. Include name, company, and role if available. "
                "One lead per line.\n"
                "Example:\n"
                "John Smith, Klenty, VP of Sales\n"
                "Sarah Chen, Ramp, Head of Growth\n"
                "Or just company names: Klenty, Ramp, Stripe"
            ),
            required=True,
            tool_mode=True,
        ),
        # --- Scoring Configuration ---
        DropdownInput(
            name="scoring_depth",
            display_name="Scoring Depth",
            info="How deep should the scoring analysis go?",
            options=[
                "Quick (company data only — fastest)",
                "Standard (company + buyer + web search)",
                "Deep (all 4 categories with full verification — most accurate)",
            ],
            value="Deep (all 4 categories with full verification — most accurate)",
        ),
        MessageTextInput(
            name="hot_threshold",
            display_name="Hot Lead Threshold",
            info="Minimum total score (out of 100) to classify as HOT.",
            value="85",
            advanced=True,
        ),
        MessageTextInput(
            name="warm_threshold",
            display_name="Warm Lead Threshold",
            info="Minimum total score (out of 100) to classify as WARM.",
            value="65",
            advanced=True,
        ),
        MultilineInput(
            name="competitor_products",
            display_name="Competitor Products (Optional)",
            info=(
                "List competitor products to check if leads use them. "
                "Helps score the Competitive Landscape criterion.\n"
                "Example: Outreach, SalesLoft, Apollo.io, Instantly"
            ),
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the scoring behavior.",
            value=DEFAULT_SYSTEM_PROMPT,
            advanced=True,
        ),
        DataInput(
            name="chat_history",
            display_name="Chat Memory",
            is_list=True,
            advanced=True,
            info="Chat history for multi-turn conversations.",
        ),
    ]

    outputs = [
        Output(display_name="Scored Leads", name="response", method="message_response"),
    ]

    def _get_llm(self):
        return get_llm(
            model=self.model,
            user_id=self.user_id,
            api_key=getattr(self, "api_key", None),
        )

    def update_build_config(self, build_config: dict, field_value: str, field_name: str | None = None) -> dict:
        def get_tool_calling_model_options(user_id=None):
            return get_language_model_options(user_id=user_id, tool_calling=True)

        return update_model_options_in_build_config(
            component=self,
            build_config=build_config,
            cache_key_prefix="language_model_options_tool_calling",
            get_options_func=get_tool_calling_model_options,
            field_name=field_name,
            field_value=field_value,
        )

    def get_chat_history_data(self) -> list[Data] | None:
        return self.chat_history

    def create_agent_runnable(self):
        llm = self._get_llm()
        # Many tool calls: enrichment per lead + search queries + email checks
        self.max_iterations = 25

        apollo_key = getattr(self, "apollo_api_key", "") or ""
        tavily_key = getattr(self, "tavily_api_key", "") or ""
        pdl_key = getattr(self, "pdl_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""
        neverbounce_key = getattr(self, "neverbounce_api_key", "") or ""

        scoring_depth = getattr(self, "scoring_depth", "Deep (all 4 categories with full verification — most accurate)") or "Deep"

        # Determine which tools to enable based on scoring depth
        is_quick = "Quick" in scoring_depth
        is_standard = "Standard" in scoring_depth
        is_deep = "Deep" in scoring_depth

        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            pdl_api_key=pdl_key if (is_standard or is_deep) else "",
            hunter_api_key=hunter_key if is_deep else "",
            neverbounce_api_key=neverbounce_key if is_deep else "",
            include_duckduckgo=not bool(tavily_key),
            # Company data — always
            include_apollo_org=True,
            # Buyer data — standard and deep
            include_apollo_people=is_standard or is_deep,
            include_apollo_people_search=is_standard or is_deep,
            include_pdl_company=is_standard or is_deep,
            include_pdl_person=is_deep,
            # Email tools — deep only
            include_hunter_finder=is_deep,
            include_hunter_domain=is_deep,
        )

        # Merge external tools (from canvas) + auto-created tools
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        # Build available sources hint
        available_sources = []
        if apollo_key:
            available_sources.append("Apollo (org + people enrichment + people search)")
        if pdl_key and (is_standard or is_deep):
            available_sources.append("PDL (company + person enrichment)")
        if hunter_key and is_deep:
            available_sources.append("Hunter (email finder + domain search)")
        if tavily_key:
            available_sources.append("Tavily (AI web search)")
        else:
            available_sources.append("DuckDuckGo (web search)")
        if neverbounce_key and is_deep:
            available_sources.append("NeverBounce (email verification)")

        sources_str = ", ".join(available_sources) if available_sources else "DuckDuckGo only"

        icp_definition = self.icp_definition or ""
        leads_input = self.leads_input or ""
        hot_threshold = getattr(self, "hot_threshold", "85") or "85"
        warm_threshold = getattr(self, "warm_threshold", "65") or "65"
        competitor_products = getattr(self, "competitor_products", "") or ""

        # Pipeline mode: if leads_input is empty, use chat input as leads
        if not leads_input.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                leads_input = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                leads_input = self.input_value

        # Build competitor search hint
        competitor_line = ""
        if competitor_products.strip():
            competitor_line = (
                f"\n\n## Competitor Products to Check\n{competitor_products}\n"
                f"When searching, check if the lead company uses any of these. "
                f"A lead using a competitor = Competitive Landscape score of 3/3 (ripe for switch)."
            )

        # Depth instructions
        depth_instructions = ""
        if is_quick:
            depth_instructions = (
                "QUICK MODE: Only score Company Fit (40pts). "
                "Call apollo_org_enrichment for each company, then one web search for verification. "
                "Mark Buyer Fit, Technographics, and Intent Signals as 'N/A — Quick mode'. "
                "Score out of 40 points, then normalize to /100."
            )
        elif is_standard:
            depth_instructions = (
                "STANDARD MODE: Score Company Fit (40pts) + Buyer Fit (25pts) + basic Intent Signals. "
                "Call apollo_org_enrichment + apollo_people_enrichment for each lead. "
                "Call web search for tech stack and funding news. "
                "Mark Technographics as best-effort from available data."
            )
        else:
            depth_instructions = (
                "DEEP MODE: Score ALL 4 categories with full verification. "
                "Use every available tool. Cross-verify data across sources. "
                "Check tech stack, intent signals, competitive landscape, and trigger events."
            )

        self.input_value = Message(
            text=(
                f"Score the following leads against our ICP using the STRUCTURED WEIGHTED RUBRIC.\n"
                f"HOT threshold: {hot_threshold}/100 | WARM threshold: {warm_threshold}/100\n\n"
                f"## Scoring Depth\n{depth_instructions}\n\n"
                f"## ICP Definition\n{icp_definition}\n\n"
                f"## Leads to Score\n{leads_input}\n"
                f"{competitor_line}\n\n"
                f"## Available Data Sources\n{sources_str}\n\n"
                f"INSTRUCTIONS:\n"
                f"1. Phase 1: Call apollo_org_enrichment + pdl_company_enrichment for EACH company\n"
                f"2. Phase 2: Call apollo_people_enrichment + apollo_people_search for EACH person to get buyer data\n"
                f"3. Phase 3: Call web search for tech stack, funding news, hiring signals, competitive landscape\n"
                f"4. Phase 4: Call hunter_email_finder + neverbounce_email_verify for email discovery and verification\n"
                f"5. STOP calling tools. Score STRICTLY using the rubric. Show your math for every sub-score.\n"
                f"6. Output the scorecard table + summary table at the end.\n\n"
                f"CRITICAL: Be STRICT. Every point must be justified with real data from a tool. No guessing."
            )
        )

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
