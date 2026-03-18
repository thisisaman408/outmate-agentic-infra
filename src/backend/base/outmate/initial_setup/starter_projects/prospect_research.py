from lfx.components.duckduckgo.duck_duck_go_search_tool import DuckDuckGoSearchToolComponent
from lfx.components.gtm_agents.prospect_research_agent import ProspectResearchAgentComponent
from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph


def prospect_research_graph():
    # Free search tool — no API key needed
    ddg_search = DuckDuckGoSearchToolComponent()

    # The agent
    research_agent = ProspectResearchAgentComponent()
    research_agent.set(
        tools=[ddg_search.build_tool],
        prospect_name="Jane Smith",
        company_name="Acme Corp",
        prospect_role="VP of Sales",
    )

    # Chat I/O — wire Chat Input → Agent input, Agent output → Chat Output
    chat_input = ChatInput()
    research_agent.set(input_value=chat_input.message_response)
    chat_output = ChatOutput()
    chat_output.set(input_value=research_agent.message_response)

    return Graph(
        start=chat_input,
        end=chat_output,
        flow_name="Prospect Research Agent",
        description=(
            "GTM Agent: Researches a prospect using web search and builds a comprehensive brief — "
            "role context, pain points, company overview, tech stack, and conversation starters. "
            "No API keys needed for search (uses DuckDuckGo). Just pick a model and hit run."
        ),
    )
