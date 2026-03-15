from lfx.components.duckduckgo.duck_duck_go_search_tool import DuckDuckGoSearchToolComponent
from lfx.components.gtm_agents.icp_scoring_agent import ICPScoringAgentComponent
from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph


def icp_scoring_graph():
    # Free search tool — no API key needed
    ddg_search = DuckDuckGoSearchToolComponent()

    # The agent
    scoring_agent = ICPScoringAgentComponent()
    scoring_agent.set(
        tools=[ddg_search.build_tool],
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
        leads_input=(
            "1. Sarah Chen, VP Sales at Ramp (fintech, NYC)\n"
            "2. Mike Johnson, Head of Growth at Lattice (HR SaaS, SF)\n"
            "3. Anna Mueller, CRO at Personio (HR tech, Munich)\n"
            "4. David Park, Marketing Manager at a local bakery (Portland)"
        ),
        score_threshold="70",
    )

    # Chat I/O — wire Chat Input → Agent input, Agent output → Chat Output
    chat_input = ChatInput()
    scoring_agent.set(input_value=chat_input.message_response)
    chat_output = ChatOutput()
    chat_output.set(input_value=scoring_agent.message_response)

    return Graph(
        start=chat_input,
        end=chat_output,
        flow_name="ICP Scoring Agent",
        description=(
            "GTM Agent: Scores a list of leads against your Ideal Customer Profile using web search "
            "to verify real data. Ranks by fit, flags mismatches, and recommends actions. "
            "No API keys needed for search (uses DuckDuckGo). Just pick a model and hit run."
        ),
    )
