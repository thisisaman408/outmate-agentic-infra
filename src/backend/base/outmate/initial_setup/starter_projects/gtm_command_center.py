from lfx.components.apollo.apollo_org_enrichment import ApolloOrgEnrichmentComponent
from lfx.components.apollo.apollo_people_enrichment import ApolloPeopleEnrichmentComponent
from lfx.components.duckduckgo.duck_duck_go_search_tool import DuckDuckGoSearchToolComponent
from lfx.components.gtm_agents.hyper_personalisation_agent import HyperPersonalisationAgentComponent
from lfx.components.gtm_agents.icp_scoring_agent import ICPScoringAgentComponent
from lfx.components.gtm_agents.prospect_research_agent import ProspectResearchAgentComponent
from lfx.components.hunter.hunter_domain_search import HunterDomainSearchComponent
from lfx.components.hunter.hunter_email_finder import HunterEmailFinderComponent
from lfx.components.hunter.hunter_email_verifier import HunterEmailVerifierComponent
from lfx.components.neverbounce.neverbounce_verify import NeverBounceVerifyComponent
from lfx.components.peopledatalabs.pdl_company_enrichment import PDLCompanyEnrichmentComponent
from lfx.components.peopledatalabs.pdl_person_enrichment import PDLPersonEnrichmentComponent
from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph


def gtm_command_center_graph():
    # ── Shared search tool (free, no API key) ──
    ddg_search = DuckDuckGoSearchToolComponent()

    # ── Company enrichment tools (Stage 1: ICP Scoring) ──
    apollo_org = ApolloOrgEnrichmentComponent()
    pdl_company = PDLCompanyEnrichmentComponent()
    hunter_domain = HunterDomainSearchComponent()

    # ── Person enrichment tools (Stage 2: Prospect Research) ──
    pdl_person = PDLPersonEnrichmentComponent()
    apollo_people = ApolloPeopleEnrichmentComponent()

    # ── Email tools (Stage 3: Hyper-Personalisation) ──
    hunter_finder = HunterEmailFinderComponent()
    hunter_verifier = HunterEmailVerifierComponent()
    neverbounce = NeverBounceVerifyComponent()

    # ════════════════════════════════════════════
    # STAGE 1 — ICP Scoring Agent
    # Enriches each lead with company data, then
    # scores against ICP (0-100) and routes.
    # ════════════════════════════════════════════
    icp_agent = ICPScoringAgentComponent()
    icp_agent.set(
        tools=[
            ddg_search.build_tool,
            apollo_org.build_tool,
            pdl_company.build_tool,
            hunter_domain.build_tool,
        ],
        icp_definition=(
            "Our ICP:\n"
            "- Industry: B2B SaaS, Fintech, or E-commerce\n"
            "- Company Size: 50-500 employees\n"
            "- Revenue: $5M-$100M ARR\n"
            "- Role: VP of Sales, Head of Growth, CRO, or RevOps Lead\n"
            "- Geography: US, UK, or DACH region\n"
            "- Tech Stack: Uses a CRM (Salesforce/HubSpot), has outbound tooling\n"
            "- Signals: Recently hired SDRs, raised funding in last 12 months"
        ),
        leads_input="",  # Pipeline mode: leads come from chat input
        score_threshold="70",
    )

    # ════════════════════════════════════════════
    # STAGE 2 — Prospect Research Agent
    # Takes the scored leads, deep-researches the
    # hot leads (70+): role context, pain points,
    # news, tech stack, conversation starters.
    # ════════════════════════════════════════════
    research_agent = ProspectResearchAgentComponent()
    research_agent.set(
        tools=[
            ddg_search.build_tool,
            pdl_person.build_tool,
            apollo_people.build_tool,
        ],
        # Pipeline mode: prospect_name and company_name left empty
        # so the agent reads hot leads from ICP Scoring output
    )

    # ════════════════════════════════════════════
    # STAGE 3 — Hyper-Personalisation Agent
    # Takes the research briefs and writes hyper-
    # personalized cold emails with verified emails.
    # ════════════════════════════════════════════
    email_agent = HyperPersonalisationAgentComponent()
    email_agent.set(
        tools=[
            ddg_search.build_tool,
            hunter_finder.build_tool,
            hunter_verifier.build_tool,
            neverbounce.build_tool,
        ],
        sender_name="Aman Kumar",
        sender_company="Outmate",
        value_proposition=(
            "Outmate is an AI-native GTM platform that automates prospect research, "
            "lead scoring, and email personalization — so sales teams close more deals "
            "with less manual work."
        ),
        email_tone="Conversational & Warm",
        email_length="Short (50-80 words)",
        email_type="Cold Outreach (First Touch)",
        cta_instruction="Would you be open to a quick 15-minute chat this week?",
    )

    # ════════════════════════════════════════════
    # WIRING — The Pipeline
    # ChatInput → ICP Scoring → Prospect Research
    #          → Hyper-Personalisation → ChatOutput
    # ════════════════════════════════════════════
    chat_input = ChatInput()

    # Stage 1: Chat message → ICP Scoring (leads from chat)
    icp_agent.set(input_value=chat_input.message_response)

    # Stage 2: Scored leads → Prospect Research
    research_agent.set(input_value=icp_agent.message_response)

    # Stage 3: Research briefs → Hyper-Personalisation
    email_agent.set(input_value=research_agent.message_response)

    # Output
    chat_output = ChatOutput()
    chat_output.set(input_value=email_agent.message_response)

    return Graph(
        start=chat_input,
        end=chat_output,
        flow_name="GTM Command Center",
        description=(
            "Full GTM pipeline: Score leads against your ICP → Deep-research hot prospects → "
            "Write hyper-personalized cold emails with verified contacts. All 3 GTM agents "
            "working together with 9 enrichment tools. Paste your leads in the chat and hit run."
        ),
    )
