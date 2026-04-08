from lfx.components.apify.apify_actor import ApifyActorsComponent
from lfx.components.googlesheets.google_sheets import GoogleSheetsComponent
from lfx.components.gtm_agents.team_finder_agent import TeamFinderAgentComponent
from lfx.components.gtm_agents.prospect_research_agent import ProspectResearchAgentComponent
from lfx.components.input_output import ChatInput, ChatOutput
from lfx.graph import Graph


def team_discovery_pipeline_graph():
    # ════════════════════════════════════════════
    # STAGE 1 — Team Finder Agent
    # Takes a company name/domain from chat input.
    # Uses Apollo, Hunter, PDL, Apify LinkedIn, and
    # web search to discover all employees with
    # names, titles, emails, LinkedIn URLs.
    # Outputs a structured employee list + CSV.
    # ════════════════════════════════════════════
    team_finder = TeamFinderAgentComponent()
    team_finder.set(
        discovery_depth="Standard (bulk search + leadership + enrichment + socials)",
        max_results=50,
        # API keys are left empty — user fills them in the UI
        # apollo_api_key, hunter_api_key, apify_api_key, pdl_api_key, tavily_api_key
    )

    # ════════════════════════════════════════════
    # STAGE 2 — Prospect Research Agent
    # Takes the Team Finder output and deep-researches
    # the top leadership contacts: finds LinkedIn posts,
    # X/Twitter handles, GitHub profiles via web search.
    # Enriches with role context and conversation starters.
    # ════════════════════════════════════════════
    social_enricher = ProspectResearchAgentComponent()
    social_enricher.set(
        system_prompt=(
            "You are a social media intelligence analyst. You receive a list of employees "
            "from the Team Finder Agent. Your job is to find their social media profiles.\n\n"
            "## WORKFLOW\n"
            "For EACH person in the list (focus on leadership first — founders, VPs, directors):\n\n"
            "### Step 1: Find X/Twitter handle\n"
            "- Search: \"[Person Name] [Company] Twitter\" or \"[Person Name] [Company] X\"\n"
            "- Search: \"[Person Name] site:twitter.com\" or \"[Person Name] site:x.com\"\n"
            "- Extract the @handle if found.\n\n"
            "### Step 2: Find GitHub profile\n"
            "- Search: \"[Person Name] [Company] GitHub\" (for engineering/tech roles only)\n"
            "- Search: \"[Person Name] site:github.com\"\n\n"
            "### Step 3: Find other social profiles\n"
            "- Search: \"[Person Name] [Company] Instagram\" or \"[Person Name] Medium blog\"\n\n"
            "### Step 4: Verify LinkedIn URL\n"
            "- If LinkedIn URL is already provided, confirm it's correct.\n"
            "- If missing, search: \"[Person Name] [Company] LinkedIn\"\n\n"
            "## OUTPUT FORMAT\n"
            "Output a JSON array of arrays (for Google Sheets) with this header:\n"
            "```json\n"
            "[\n"
            '  ["Name","Title","Email","Email Confidence","LinkedIn","Twitter/X","Instagram","GitHub",'
            '"Other Socials","Department","Seniority","Location","Phone","Company","Source"],\n'
            '  ["Vidit Paliwal","Co-founder","vidit@bigsteptech.com","Verified",'
            '"https://linkedin.com/in/viditpaliwal","@viditpaliwal","","https://github.com/vidit",'
            '"","Executive","Founder","Gurugram, India","","BigStep Technologies","Apollo + Apify"]\n'
            "]\n"
            "```\n\n"
            "CRITICAL RULES:\n"
            "- Output ONLY the JSON array. No markdown, no explanations before or after.\n"
            "- First row MUST be the header.\n"
            "- Include EVERY employee from the input list.\n"
            "- If a social profile is not found, use empty string \"\".\n"
            "- Use the web search tools to find X/Twitter handles — don't guess.\n"
            "- Focus search effort on top 10-15 leadership contacts.\n"
            "- For remaining employees, carry over the data as-is from input."
        ),
    )

    # ════════════════════════════════════════════
    # STAGE 3 — Apify LinkedIn Profile Scraper
    # Takes LinkedIn URLs from Stage 2 output and
    # scrapes deep profile data (work history, education,
    # skills, etc.) using Apify. This runs as a
    # standalone component, not through the LLM.
    # User configures the actor ID in the node.
    # ════════════════════════════════════════════
    apify_linkedin = ApifyActorsComponent()
    apify_linkedin.set(
        actor_id="harvestapi/linkedin-company-employees",
        run_input='{"companies":["https://www.linkedin.com/company/REPLACE_ME"],"maxItems":50,"profileScraperMode":"Full + email search ($12 per 1k)"}',
        dataset_fields="fullName, title, linkedinUrl, location, email",
        flatten_dataset=True,
    )

    # ════════════════════════════════════════════
    # STAGE 4 — Google Sheets Output
    # Takes the JSON array from Stage 2 and writes
    # it directly to a Google Sheet. The JSON array
    # of arrays format is natively supported by the
    # Google Sheets component.
    # ════════════════════════════════════════════
    google_sheets = GoogleSheetsComponent()
    google_sheets.set(
        operation="append",
        sheet_range="Sheet1",
        value_input_option="USER_ENTERED",
        # User fills: api_key (service account path), spreadsheet_id
    )

    # ════════════════════════════════════════════
    # WIRING — The Pipeline
    #
    # ChatInput → Team Finder Agent (discovers employees)
    #          → Social Enricher (finds X/Twitter/GitHub via web search)
    #          → Google Sheets (saves structured data)
    #          → ChatOutput (displays results)
    #
    # Apify LinkedIn node is standalone — user can
    # run it separately or connect it manually for
    # deep LinkedIn profile scraping.
    # ════════════════════════════════════════════
    chat_input = ChatInput()

    # Stage 1: Chat message → Team Finder
    team_finder.set(input_value=chat_input.message_response)

    # Stage 2: Employee list → Social Enricher
    social_enricher.set(input_value=team_finder.message_response)

    # Stage 3: Enriched data → Google Sheets
    google_sheets.set(input_value=social_enricher.message_response)

    # Output: Show results in chat
    chat_output = ChatOutput()
    chat_output.set(input_value=social_enricher.message_response)

    return Graph(
        start=chat_input,
        end=chat_output,
        flow_name="Team Discovery Pipeline",
        description=(
            "Full employee discovery pipeline: Find all employees at a company → "
            "Enrich with social profiles (X/Twitter, GitHub, Instagram) → "
            "Save to Google Sheets. Uses Apollo, Hunter, PDL, Apify LinkedIn, "
            "and web search. Just type a company name and run."
        ),
    )
