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
    IntInput,
    MessageTextInput,
    ModelInput,
    MultilineInput,
    SecretStrInput,
)
from lfx.io import Output
from lfx.schema.data import Data
from lfx.schema.message import Message


DEFAULT_SYSTEM_PROMPT = """You are an elite company intelligence agent. Your mission: build the most complete employee directory possible for a target company — with professional emails, phone numbers, social profiles, and activity data. You operate in 6 phases and you NEVER stop after just one tool call.

## PHASE 1: COMPANY INTELLIGENCE
1. **apollo_org_enrichment** — Get company domain, LinkedIn URL, industry, employee count, funding, and company phone.
2. **Web search** for "[Company] founders CEO CTO leadership team crunchbase" — discover leadership names.
3. **Web search** for "[Company] team page about us" — find the company website team/about page.
4. If **firecrawl_scrape** is available, scrape the /about or /team page directly.

## PHASE 2: BULK EMPLOYEE DISCOVERY (use ALL available tools)

1. **apollo_people_search** — Call MULTIPLE TIMES with different seniority filters:
   - First: person_seniorities="owner,founder,c_suite,vp,director" (leadership)
   - Second: person_seniorities="manager,senior" (mid-level)
   - Third: no seniority filter (everyone else)
   - If total > per_page, paginate with page=2, page=3, etc.
   - **Apollo returns phone numbers** — capture them from the results.

2. **hunter_domain_search** — Search the company domain for all known emails, names, titles.

3. **pdl_people_search** — Search by company name/domain. Returns names, titles, work emails, LinkedIn, **and phone numbers**.

4. **apify_linkedin_company_employees** — Scrape the LinkedIn company page. Use the LinkedIn URL found in Phase 1. This uses "Full + email search" mode giving you:
   - Full name, headline, current & past work experience
   - Education, skills, certifications
   - Location, LinkedIn profile URL
   - Contact email (when discoverable)

## PHASE 3: SOCIAL PROFILE DISCOVERY (use Apify)

After you have employee names from Phase 2:

1. **apify_find_social_profiles** — Pass ALL discovered employee names (comma-separated). This finds their profiles across X/Twitter, Instagram, GitHub, Facebook, LinkedIn, YouTube, Medium, and more. No cookies needed.
   - Example: apify_find_social_profiles(names="Vidit Paliwal,Niranjan Mangal,Shivani Sharma")
   - Call in batches of 10-15 names if you have many employees.

2. **apify_get_twitter_tweets** — For KEY employees (founders, CEO, VP of Sales, etc.), get their recent tweets to understand their interests and communication style. Provide the Twitter username found in Phase 3.1.
   - Only do this for the top 5-10 most important contacts.

## PHASE 4: ENRICH & VERIFY (CRITICAL for emails and phones)

For EVERY employee missing an email or phone number, try enrichment:

1. **pdl_person_enrichment** — Best source for phone numbers + work emails. Call for EVERY leadership contact and any contact missing email/phone. PDL returns work emails, personal emails, phone numbers, and mobile numbers.
2. **apollo_people_enrichment** — Secondary enrichment. Returns emails, phone numbers, LinkedIn.
3. **hunter_email_finder** — For contacts still missing email, find it by first name + last name + domain.
4. **neverbounce_email_verify** — Verify top emails.

**PHONE NUMBER PRIORITY:** PDL is the best source for phone numbers. ALWAYS call pdl_person_enrichment for leadership contacts even if you already have their email — you may still be missing their phone number.

## PHASE 5: MERGE & DEDUPLICATE
- Same person from multiple sources = merge data (prefer verified emails, Apollo LinkedIn URLs).
- Remove duplicates by name similarity.
- Match social profiles from Phase 3 to the correct person.
- **Merge phone numbers** — if Apollo returned a phone and PDL returned a different one, keep both.

## PHASE 6: OUTPUT — TWO FORMATS

### Format A: Chat Display (Markdown Table)
Display a clean markdown summary grouped by seniority. Include email, phone, and LinkedIn for every contact.

### Format B: Google Sheets CSV (CRITICAL — ALWAYS include this)
At the END of your response, output the COMPLETE data as a CSV block that can be directly copy-pasted into Google Sheets.

**ALWAYS output this CSV block wrapped in a code fence:**

```csv
Name,Title,Email,Email Confidence,LinkedIn,Twitter/X,Instagram,GitHub,Other Socials,Department,Seniority,Location,Phone,Company,Source,Recent Activity
"Vidit Paliwal","CEO & Co-Founder","vidit@bigsteptech.com","Verified","https://linkedin.com/in/vidit","@viditpaliwal","","https://github.com/vidit","","Executive","C-Suite","Gurugram, India","+91-9876543210","BigStep Technologies","Apollo + Hunter + PDL","Tweeted about AI trends 3 days ago"
```

**CSV RULES:**
- First row MUST be the header: Name,Title,Email,Email Confidence,LinkedIn,Twitter/X,Instagram,GitHub,Other Socials,Department,Seniority,Location,Phone,Company,Source,Recent Activity
- Wrap ALL values in double quotes
- If a field is empty, use empty quotes ""
- Escape any quotes inside values with double quotes
- One employee per row
- Include EVERY employee found — do not truncate
- The "Phone" column should contain the professional/mobile phone number when available
- The "Source" column lists which tools found this person (e.g., "Apollo + Hunter")
- The "Recent Activity" column summarizes any tweets or LinkedIn posts found
- The "Other Socials" column lists any platforms not in the main columns (e.g., "Medium: url, YouTube: url")

## CRITICAL RULES:
1. **NEVER stop after one tool call.** Use at least 3 different data sources.
2. **Leadership FIRST.** Find founders/CEO/CTO before listing juniors.
3. **PAGINATION.** If a search tool says there are more results, paginate.
4. **SOCIAL PROFILES ARE MANDATORY.** Always call apify_find_social_profiles for discovered employees.
5. **CSV OUTPUT IS MANDATORY.** Always end with the Google Sheets CSV block.
6. **Employee scraper uses Full + email mode.** Pass profileScraperMode="Full + email search ($12 per 1k)" for maximum data.
7. **NEVER FABRICATE data.** If unknown, leave empty.
8. **Group by seniority** in the markdown display.
9. **Track sources** for every data point.
10. **EMAILS AND PHONES ARE TOP PRIORITY.** Every contact should have an email if possible. Use hunter_email_finder as a fallback for any contact missing email. Use pdl_person_enrichment for phone numbers.
11. **ENRICH LEADERSHIP INDIVIDUALLY.** For every founder, C-suite, VP, and director — call pdl_person_enrichment to get their phone number and verified email, even if you already found them in bulk search."""


class TeamFinderAgentComponent(LCToolsAgentComponent):
    display_name = "Team Finder Agent"
    description = (
        "Discovers employees at any company with full social profiles — LinkedIn, X/Twitter, Instagram, "
        "GitHub, and more. Uses Apify, Apollo, Hunter, PDL, and web search. Outputs both a chat-friendly "
        "directory and a Google Sheets-ready CSV. More API keys = more complete results."
    )
    icon = "Users"
    name = "TeamFinderAgent"

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
        # --- Data source API keys ---
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key",
            info="Apollo.io key — enables people search and company enrichment. Get it at app.apollo.io → Settings → API Keys.",
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
            name="pdl_api_key",
            display_name="PDL API Key",
            info="People Data Labs key — enriches contacts with phone numbers and emails from 2.8B+ profiles. Get it at dashboard.peopledatalabs.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="brightdata_api_key",
            display_name="BrightData API Token",
            info="BrightData — PREFERRED LinkedIn scraper for profiles and posts. Get it at brightdata.com → Account Settings → API tokens.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="apify_api_key",
            display_name="Apify API Key (Fallback)",
            info="Apify — fallback for LinkedIn employees, social profiles. Only used if BrightData not set.",
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
            name="firecrawl_api_key",
            display_name="Firecrawl API Key",
            info="Firecrawl key — scrapes web pages (team pages, about pages). Get it at firecrawl.dev.",
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
        # --- Search inputs ---
        MessageTextInput(
            name="company_name",
            display_name="Company Name",
            info="Name of the company (e.g., 'Klenty', 'BigStep Technologies').",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="company_domain",
            display_name="Company Domain",
            info="Company website domain (e.g., 'klenty.com'). Optional if company name is provided.",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="company_linkedin_url",
            display_name="Company LinkedIn URL",
            info="LinkedIn company page URL. Enables Apify LinkedIn scraping for maximum employee coverage.",
            required=False,
            tool_mode=True,
        ),
        # --- Filters ---
        MessageTextInput(
            name="filter_department",
            display_name="Filter: Department",
            info="Only find employees in this department (e.g., 'sales', 'engineering', 'marketing').",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="filter_seniority",
            display_name="Filter: Seniority",
            info="Only find employees at this seniority level (e.g., 'senior', 'director', 'vp', 'c_suite').",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="filter_title",
            display_name="Filter: Job Title",
            info="Only find employees with this title keyword (e.g., 'CTO', 'sales head').",
            required=False,
            tool_mode=True,
        ),
        DropdownInput(
            name="discovery_depth",
            display_name="Discovery Depth",
            info="How deep should the discovery go?",
            options=[
                "Quick (bulk search only — fastest)",
                "Standard (bulk search + leadership + enrichment + socials)",
                "Deep (all 6 phases — maximum coverage with social profiles and tweets)",
            ],
            value="Standard (bulk search + leadership + enrichment + socials)",
        ),
        IntInput(
            name="max_results",
            display_name="Max Results",
            info="Maximum number of employees to return (default: 50).",
            value=50,
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's discovery behavior.",
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
        Output(display_name="Team Directory", name="response", method="message_response"),
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

        apollo_key = getattr(self, "apollo_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""
        brightdata_key = getattr(self, "brightdata_api_key", "") or ""
        apify_key = getattr(self, "apify_api_key", "") or ""
        pdl_key = getattr(self, "pdl_api_key", "") or ""
        tavily_key = getattr(self, "tavily_api_key", "") or ""
        firecrawl_key = getattr(self, "firecrawl_api_key", "") or ""
        neverbounce_key = getattr(self, "neverbounce_api_key", "") or ""

        depth = getattr(self, "discovery_depth", "Standard") or "Standard"
        is_quick = "Quick" in depth
        is_deep = "Deep" in depth

        if is_quick:
            self.max_iterations = 12
        elif is_deep:
            self.max_iterations = 40
        else:
            self.max_iterations = 30

        use_brightdata = bool(brightdata_key)

        # Build tools
        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            pdl_api_key=pdl_key,
            hunter_api_key=hunter_key,
            neverbounce_api_key=neverbounce_key if not is_quick else "",
            firecrawl_api_key=firecrawl_key,
            apify_api_key=apify_key,
            brightdata_api_token=brightdata_key,
            include_duckduckgo=True,
            include_apollo_people_search=True,
            include_apollo_people=not is_quick,
            include_apollo_org=True,
            include_pdl_people_search=True,
            include_pdl_person=not is_quick,
            include_pdl_company=True,
            include_hunter_domain=True,
            include_hunter_finder=not is_quick,
            # BrightData LinkedIn (preferred)
            include_brightdata_linkedin_profile=use_brightdata and not is_quick,
            include_brightdata_linkedin_posts=use_brightdata and is_deep,
            # Apify fallbacks
            include_apify_linkedin_employees=bool(apify_key),
            include_apify_social_finder=bool(apify_key) and not is_quick,
            include_apify_twitter_tweets=bool(apify_key) and is_deep,
        )

        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        # Inputs
        company_name = getattr(self, "company_name", "") or ""
        company_domain = getattr(self, "company_domain", "") or ""
        company_linkedin = getattr(self, "company_linkedin_url", "") or ""
        filter_dept = getattr(self, "filter_department", "") or ""
        filter_seniority = getattr(self, "filter_seniority", "") or ""
        filter_title = getattr(self, "filter_title", "") or ""
        max_results = getattr(self, "max_results", 50) or 50

        # Available sources
        available = []
        if apollo_key:
            available.append("Apollo (org + people search + enrichment)")
        if hunter_key:
            available.append("Hunter (domain search + email finder)")
        if pdl_key:
            available.append("PDL (people search + enrichment)")
        if apify_key:
            available.append("Apify (LinkedIn employees + social profile finder + X/Twitter tweets)")
        available.append("DuckDuckGo (web search)")
        if tavily_key:
            available.append("Tavily (AI web search)")
        if firecrawl_key:
            available.append("Firecrawl (page scraping)")
        if neverbounce_key and not is_quick:
            available.append("NeverBounce (email verification)")
        sources_str = "\n".join(f"  - {s}" for s in available)

        # Depth instructions
        if is_quick:
            depth_inst = (
                "QUICK MODE: Phase 2 only. Call apollo_people_search once + hunter_domain_search once. "
                "Skip social profiles, enrichment, and tweets. Still output the CSV block."
            )
        elif is_deep:
            depth_inst = (
                "DEEP MODE: ALL 6 phases. Full pagination, social profiles for ALL employees, "
                "tweets for top 5-10 leadership contacts. Maximum coverage. Full CSV output."
            )
        else:
            depth_inst = (
                "STANDARD MODE: Phases 1-5. Leadership discovery, bulk search with multiple passes, "
                "social profiles for all employees, enrichment for leadership. Skip tweets. Full CSV output."
            )

        if company_name.strip() or company_domain.strip():
            filters = []
            if filter_dept.strip():
                filters.append(f"  - Department: {filter_dept}")
            if filter_seniority.strip():
                filters.append(f"  - Seniority: {filter_seniority}")
            if filter_title.strip():
                filters.append(f"  - Title: {filter_title}")
            filter_str = "\n".join(filters) if filters else "  - None (find ALL employees)"

            linkedin_line = f"\n- Company LinkedIn: {company_linkedin}" if company_linkedin.strip() else ""

            self.input_value = Message(
                text=(
                    f"Build a complete team directory with social profiles for this company:\n"
                    f"- Company: {company_name}\n"
                    f"- Domain: {company_domain}{linkedin_line}\n"
                    f"- Max results: {max_results}\n\n"
                    f"**Depth:** {depth}\n{depth_inst}\n\n"
                    f"**Filters:**\n{filter_str}\n\n"
                    f"**Available Sources:**\n{sources_str}\n\n"
                    f"**EXECUTION PLAN:**\n"
                    f"1. apollo_org_enrichment → get domain + LinkedIn URL + company phone\n"
                    f"2. Web search → find leadership names\n"
                    f"3. apollo_people_search × 3 → leadership, mid-level, all (captures phone numbers)\n"
                    f"4. hunter_domain_search → all emails at domain\n"
                    f"5. pdl_people_search → additional coverage + phone numbers\n"
                    f"6. apify_linkedin_company_employees → LinkedIn scrape with Full + email mode\n"
                    f"7. Merge & deduplicate all results\n"
                    f"8. pdl_person_enrichment → call for EACH leadership contact to get phone numbers + verified emails\n"
                    f"9. hunter_email_finder → for any remaining contacts missing email\n"
                    f"10. apify_find_social_profiles → pass ALL employee names to find X/Twitter, Instagram, GitHub, etc.\n"
                    f"11. apify_get_twitter_tweets → get recent tweets for top 5 leadership (Deep mode only)\n"
                    f"12. Output: markdown table grouped by seniority + CSV block for Google Sheets\n\n"
                    f"CRITICAL REMINDERS:\n"
                    f"- Use apify_linkedin_company_employees with profileScraperMode='Full + email search ($12 per 1k)'\n"
                    f"- ALWAYS call pdl_person_enrichment for leadership contacts to get phone numbers\n"
                    f"- ALWAYS call hunter_email_finder for contacts missing email\n"
                    f"- ALWAYS call apify_find_social_profiles with ALL discovered employee names\n"
                    f"- ALWAYS end your response with the CSV code block for Google Sheets\n"
                    f"- EVERY contact should have Email + Phone + LinkedIn if possible\n"
                    f"- CSV header: Name,Title,Email,Email Confidence,LinkedIn,Twitter/X,Instagram,GitHub,Other Socials,Department,Seniority,Location,Phone,Company,Source,Recent Activity"
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
