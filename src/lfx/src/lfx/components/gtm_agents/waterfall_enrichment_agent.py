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

# FULL_SYSTEM_PROMPT — uncomment and use as DEFAULT_SYSTEM_PROMPT when you have a bigger model
# DEFAULT_SYSTEM_PROMPT = """You are an expert data enrichment engine that maximizes lead coverage by cascading across multiple data providers.
# Your job is to take raw lead data and enrich it to maximum completeness — trying multiple sources in priority order until every field is filled.
#
# ## CRITICAL RULES
# 1. NEVER skip a data source — always try the next provider if the previous one returned incomplete data.
# 2. ALWAYS verify emails at the end of the pipeline.
# 3. Track which source provided each data point — this is your enrichment audit trail.
# 4. If a lead has only a name and company domain, that's enough to start. Work with whatever you have.
#
# ## WATERFALL ENRICHMENT PIPELINE
#
# For EACH lead in the input, execute this cascade:
#
# ### Step 1: Company Enrichment
# - Try apollo_org_enrichment with the company domain
# - If missing data, try pdl_company_enrichment for additional fields
# - Collect: company name, industry, employee count, revenue signals, funding, location
#
# ### Step 2: Person Discovery & Enrichment
# - Try apollo_people_enrichment with the person's email or name + company
# - If no email found, try pdl_person_enrichment
# - If STILL no email, try hunter_email_finder with first_name + last_name + domain
# - If Hunter found an email pattern from domain search, construct the email manually
# - Collect: full name, title, seniority, department, LinkedIn URL, phone
#
# ### Step 3: Email Verification
# - For every email found, call neverbounce_email_verify (or hunter_email_verifier)
# - Mark emails as: verified, catch-all, invalid, or unknown
# - Only verified and catch-all emails should be flagged as usable
#
# ### Step 4: Social Profile Scraping (if Apify tools are connected)
# If any Apify actor tools are available (tool names starting with "apify_actor_"), use them for deep social data:
#
# **LinkedIn Profile Scraping:**
# - If you have an Apify LinkedIn profile scraper tool, call it with:
#   `{"profileUrls": ["https://www.linkedin.com/in/USERNAME"]}` or `{"urls": ["https://www.linkedin.com/in/USERNAME"]}`
# - This returns: full work history, education, skills, headline, about section, connections count
# - Use the LinkedIn URL from earlier enrichment steps (Apollo/PDL often return it)
#
# **LinkedIn Posts Scraping:**
# - If you have an Apify LinkedIn posts scraper tool, call it with:
#   `{"targetUrls": ["https://www.linkedin.com/in/USERNAME"]}` or `{"urls": ["https://www.linkedin.com/in/USERNAME"]}`
# - This returns: recent posts, engagement metrics, content topics
# - Extract: what they post about (pain points, interests), engagement level, thought leadership topics
#
# **Instagram Profile Scraping:**
# - If you have an Apify Instagram scraper tool, call it with:
#   `{"usernames": ["USERNAME"]}` or `{"directUrls": ["https://www.instagram.com/USERNAME/"]}`
# - Returns: bio, follower count, recent posts, website link
#
# **IMPORTANT:** The Apify tool's input schema is auto-discovered — check the tool description for the exact field names.
# If no Apify tools are connected, fall back to web search.
#
# ### Step 5: Web Search Context (fallback or supplement)
# - Search for the person using duckduckgo_search to find LinkedIn posts, interviews, role changes
# - This provides conversation context for outbound personalization
#
# ## OUTPUT FORMAT
#
# For EACH lead, output a structured enrichment card:
#
# ### Lead: [Full Name]
# **Company:** [Company Name] | **Domain:** [domain.com]
# **Title:** [Job Title] | **Seniority:** [Level]
# **Email:** [email] | **Status:** [verified/catch-all/invalid]
# **Phone:** [phone number if found]
# **LinkedIn:** [URL if found]
#
# **Company Intel:**
# - Industry: [industry]
# - Employees: [count]
# - Revenue: [estimate if available]
# - Funding: [stage + amount]
# - Location: [HQ location]
#
# **Enrichment Sources:** [list which tools provided which data]
# **Coverage Score:** [percentage of fields filled, e.g., 85%]
#
# ---
#
# ## ENRICHMENT SUMMARY
# At the end, provide:
# - Total leads processed: X
# - Average coverage score: X%
# - Emails found: X/Y (Z% hit rate)
# - Verified emails: X
# - Source breakdown: Apollo provided X%, PDL provided Y%, Hunter provided Z%
#
# Be relentless — the goal is maximum coverage. Every empty field is a missed opportunity."""

DEFAULT_SYSTEM_PROMPT = """You are a lead enrichment engine. For each lead, cascade through tools to maximize data coverage.
STRICT: Do NOT search more than once per lead. Focus on enrichment tools, not search.

PIPELINE per lead:
1. Company: apollo_org_enrichment with domain, then pdl_company_enrichment if gaps remain
2. Person: apollo_people_enrichment with email/name+domain, then pdl_person_enrichment for gaps
3. Email: hunter_email_finder with first_name+last_name+domain if no email yet
4. Verify: neverbounce_email_verify on every email found
5. Context: duckduckgo_search for recent news/LinkedIn activity

OUTPUT per lead: Name, Title, Email (verified/unverified), Company, Industry, Employees, Funding, LinkedIn, Phone.
End with summary: total leads, emails found, verified count, coverage %.
Start enriching immediately."""


class WaterfallEnrichmentAgentComponent(LCToolsAgentComponent):
    display_name = "Waterfall Enrichment Engine"
    description = (
        "Cascading multi-source enrichment engine — tries Apollo, PDL, Hunter, and NeverBounce in sequence "
        "to maximize data coverage on every lead. Like Clay, but built into your pipeline."
    )
    icon = "Layers"
    name = "WaterfallEnrichmentAgent"

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
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key",
            info="Apollo.io key — enables people search and company enrichment. Get it at app.apollo.io → Settings → API Keys.",
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
        MultilineInput(
            name="leads_data",
            display_name="Leads to Enrich",
            info=(
                "Raw lead data to enrich. Can be CSV-style, JSON, or plain text. "
                "Minimum needed: name + company domain. Example:\n"
                "Max Freeman, ramp.com, VP of Sales\n"
                "Sarah Chen, stripe.com, Head of Engineering"
            ),
            required=True,
            tool_mode=True,
        ),
        DropdownInput(
            name="enrichment_depth",
            display_name="Enrichment Depth",
            info="How deep should the enrichment go?",
            options=[
                "Essential (company + email only)",
                "Standard (company + person + email + verify)",
                "Deep (all sources + context research)",
            ],
            value="Standard (company + person + email + verify)",
        ),
        DropdownInput(
            name="output_format",
            display_name="Output Format",
            info="How should enriched data be formatted?",
            options=["Structured Cards", "CSV-Ready Table", "JSON"],
            value="Structured Cards",
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the enrichment behavior.",
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
        Output(display_name="Enriched Leads", name="response", method="message_response"),
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
        self.max_iterations = 12

        leads_data = self.leads_data or ""
        depth = getattr(self, "enrichment_depth", "Standard (company + person + email + verify)") or "Standard (company + person + email + verify)"
        output_fmt = getattr(self, "output_format", "Structured Cards") or "Structured Cards"

        # Pipeline mode: if leads_data is empty, use chat input
        if not leads_data.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                leads_data = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                leads_data = self.input_value

        self.input_value = Message(
            text=f"Enrich the following leads using the waterfall pipeline.\n\n"
            f"## Leads\n{leads_data}\n\n"
            f"Enrichment Depth: {depth}\n"
            f"Output Format: {output_fmt}"
        )

        self.system_prompt = (
            f"{self.system_prompt}\n\n"
            f"## Configuration\n"
            f"- Enrichment Depth: {depth}\n"
            f"- Output Format: {output_fmt}\n"
        )

        # Auto-create tools from API keys provided on this component
        auto_tools = build_tools_from_keys(
            apollo_api_key=getattr(self, "apollo_api_key", "") or "",
            pdl_api_key=getattr(self, "pdl_api_key", "") or "",
            hunter_api_key=getattr(self, "hunter_api_key", "") or "",
            neverbounce_api_key=getattr(self, "neverbounce_api_key", "") or "",
            include_duckduckgo=True,
            include_apollo_org=True,
            include_apollo_people=True,
            include_pdl_company=True,
            include_pdl_person=True,
            include_hunter_finder=True,
            include_hunter_domain=True,
        )
        # Merge auto-tools into self.tools so AgentExecutor also sees them
        if auto_tools:
            self.tools = list(self.tools or []) + auto_tools

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
