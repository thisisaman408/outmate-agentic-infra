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


DEFAULT_SYSTEM_PROMPT = """You are a CRM data-entry assistant. Your job is to take prospect/deal data, enrich it using the available tools, then output a CRM-ready JSON record formatted for the target CRM.

TOOL USAGE RULES:
- apollo_people_enrichment: Use first_name, last_name, and organization_name (NOT domain). Fill in missing fields like title, email, seniority, department.
- apollo_org_enrichment: Use organization_name (NOT domain). Get company industry, size, revenue, website, LinkedIn.
- tavily_search / duckduckgo_search: Search for recent company news or prospect activity to add as notes.
- Only call tools for data that is MISSING from the prospect data provided. Do not re-fetch data the user already gave you.

WORKFLOW — Follow this exact sequence:
Step 1: Parse the prospect data provided by the user. Identify which fields are present and which are missing.
Step 2: If name and company are known but email/title/department are missing, call apollo_people_enrichment.
Step 3: If company data (industry, size, revenue) is missing, call apollo_org_enrichment.
Step 4: Optionally call a search tool for recent company news (to include as a note in the CRM).
Step 5: STOP calling tools. Format the output below.

CRM FIELD MAPPING — Format the output for the target CRM:

For HubSpot:
- Contacts: firstname, lastname, email, phone, jobtitle, company, lifecyclestage, hs_lead_status
- Companies: name, domain, industry, numberofemployees, annualrevenue, city, state, country
- Deals: dealname, amount, dealstage, pipeline, closedate

For Salesforce:
- Contact: FirstName, LastName, Email, Phone, Title, Department, AccountId
- Lead: FirstName, LastName, Email, Company, Title, LeadSource, Status
- Account: Name, Website, Industry, NumberOfEmployees, AnnualRevenue, BillingCity
- Opportunity: Name, Amount, StageName, CloseDate, AccountId

For Zoho:
- Contacts: First_Name, Last_Name, Email, Phone, Title, Department, Account_Name
- Leads: First_Name, Last_Name, Email, Company, Designation, Lead_Source, Lead_Status
- Accounts: Account_Name, Website, Industry, Employees, Annual_Revenue
- Deals: Deal_Name, Amount, Stage, Closing_Date, Account_Name

MANDATORY OUTPUT FORMAT:

## CRM Auto-Fill: [Prospect Name]

### Action: [Create Contact / Update Contact / Create Deal / Log Activity / Add Note]
### CRM Provider: [HubSpot / Salesforce / Zoho]

### CRM-Ready JSON
```json
{
  "field_name": "value",
  ...
}
```

### Field Source Summary
| Field | Value | Source |
|-------|-------|--------|
| [field] | [value] | [Provided / Apollo / Tavily / Inferred] |

### Enrichment Notes
- [Any additional context from search tools, recent news, etc.]

### Next Steps
- [What action to take in the CRM with this data]

CRITICAL: Always output valid JSON that matches the target CRM's field names exactly. Never leave required fields empty — if data is unavailable, note it explicitly."""


class CRMAutoFillAgentComponent(LCToolsAgentComponent):
    display_name = "CRM Auto-Fill Agent"
    description = (
        "Takes prospect/deal data, enriches it with Apollo and web search, "
        "then outputs CRM-ready JSON formatted for HubSpot, Salesforce, or Zoho."
    )
    icon = "database"
    name = "CRMAutoFillAgent"

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
            name="tavily_api_key",
            display_name="Tavily API Key",
            info="Tavily key — AI-powered web search for company research. Get it at tavily.com.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="apollo_api_key",
            display_name="Apollo API Key",
            info="Apollo.io key — enables people search and company enrichment. Get it at app.apollo.io → Settings → API Keys.",
            required=False,
            advanced=True,
        ),
        DropdownInput(
            name="crm_provider",
            display_name="CRM Provider",
            info="Target CRM system to format the output for.",
            options=["HubSpot", "Salesforce", "Zoho"],
            value="HubSpot",
            required=True,
        ),
        SecretStrInput(
            name="crm_api_key",
            display_name="CRM API Key / Access Token",
            info="Your CRM's API key or access token — HubSpot Private App token, Salesforce access token, or Zoho OAuth token.",
            required=True,
            advanced=True,
        ),
        MultilineInput(
            name="prospect_data",
            display_name="Prospect Data",
            info=(
                "Prospect information to fill into the CRM: name, email, company, role, phone, etc. "
                "Can be plain text, structured text, or JSON. The agent will parse and enrich it."
            ),
            required=True,
            tool_mode=True,
        ),
        DropdownInput(
            name="crm_action",
            display_name="CRM Action",
            info="What action to prepare the data for in the CRM.",
            options=["Create Contact", "Update Contact", "Create Deal", "Log Activity", "Add Note"],
            value="Create Contact",
            required=True,
        ),
        MultilineInput(
            name="additional_context",
            display_name="Additional Context (Optional)",
            info="Any extra info: deal stage, lead source, custom fields, previous interactions, etc.",
            required=False,
            advanced=True,
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the agent's CRM data formatting behavior.",
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
        Output(display_name="CRM-Ready Data", name="response", method="message_response"),
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
        self.max_iterations = 10

        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""

        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            include_duckduckgo=not bool(tavily_key),
            include_apollo_org=True,
            include_apollo_people=True,
        )

        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        prospect_data = self.prospect_data or ""
        crm_provider = getattr(self, "crm_provider", "HubSpot") or "HubSpot"
        crm_action = getattr(self, "crm_action", "Create Contact") or "Create Contact"
        additional_context = getattr(self, "additional_context", "") or ""

        context_line = f"\n- Additional Context: {additional_context}" if additional_context.strip() else ""

        self.system_prompt = (
            f"{self.system_prompt}\n\n"
            f"## CRM Parameters\n"
            f"- Target CRM: {crm_provider}\n"
            f"- Action: {crm_action}\n"
            f"- Format all field names for {crm_provider}'s API exactly.{context_line}\n\n"
            f"IMPORTANT: Output the JSON using the EXACT field names that {crm_provider} expects. "
            f"For example, HubSpot uses lowercase (firstname, lastname, email), "
            f"Salesforce uses PascalCase (FirstName, LastName, Email), "
            f"and Zoho uses Title_Case with underscores (First_Name, Last_Name, Email)."
        )

        if prospect_data.strip():
            self.input_value = Message(
                text=f"Prepare CRM-ready data for the following prospect. "
                f"Action: {crm_action} in {crm_provider}.\n\n"
                f"Prospect Data:\n{prospect_data}{context_line}\n\n"
                f"Use available tools to enrich any missing fields (email, title, company details), "
                f"then output the CRM-ready JSON formatted for {crm_provider}."
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
