from lfx.components.duckduckgo.duck_duck_go_search_tool import DuckDuckGoSearchToolComponent
from lfx.components.gtm_agents.hyper_personalisation_agent import HyperPersonalisationAgentComponent
from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph


def hyper_personalisation_graph():
    # Free search tool — no API key needed
    ddg_search = DuckDuckGoSearchToolComponent()

    # The agent
    email_agent = HyperPersonalisationAgentComponent()
    email_agent.set(
        tools=[ddg_search.build_tool],
        prospect_data=(
            "Name: Sarah Chen\n"
            "Role: VP of Sales at Ramp\n"
            "Company: Ramp — corporate card & spend management platform (fintech)\n"
            "Location: NYC\n"
            "Background: Previously at Stripe, scaled SDR team from 5 to 30\n"
            "Signal: Ramp just raised Series D, actively hiring outbound reps"
        ),
        sender_name="Alex Rivera",
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

    # Chat I/O — wire Chat Input → Agent input, Agent output → Chat Output
    chat_input = ChatInput()
    email_agent.set(input_value=chat_input.message_response)
    chat_output = ChatOutput()
    chat_output.set(input_value=email_agent.message_response)

    return Graph(
        start=chat_input,
        end=chat_output,
        flow_name="Hyper-Personalisation Agent",
        description=(
            "GTM Agent: Writes hyper-personalized cold emails using web search to find real prospect "
            "data — LinkedIn posts, company news, role changes. Includes subject line, email body, "
            "and personalization breakdown. No API keys needed for search. Just pick a model and hit run."
        ),
    )
