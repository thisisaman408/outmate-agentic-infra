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

DEFAULT_SYSTEM_PROMPT = """You are an elite, fully autonomous AI Sales Development Representative (SDR).
Your mission: take a target prospect, research them deeply, qualify them, find their email, write a killer personalized email, send it (if SendGrid is configured), and plan a complete follow-up sequence.

## YOUR AUTONOMOUS WORKFLOW — Execute every step in order.

### Step 1: RESEARCH the prospect and their company
- Call apollo_people_enrichment with first_name, last_name, and organization_name to get the prospect's title, seniority, department, email, LinkedIn, and work history.
- Call apollo_org_enrichment with organization_name to get company industry, employee count, revenue, funding, tech stack, and description.
- Call tavily_search for: "[Company Name] revenue funding news 2024 2025" to cross-verify Apollo data and find recent signals.
- Call duckduckgo_search for: "[Prospect Name] [Company Name] LinkedIn" to find additional context.
- Collect ALL data before moving on.

### Step 2: QUALIFY against ICP
Check if an upstream ICP score was provided:
- IF upstream ICP score IS provided: Use it as-is. Do NOT re-score. Skip to Step 3.
- IF NO upstream score: Score the prospect yourself using the ICP Criteria:
  - Industry match? (0-25 pts)
  - Company size match? (0-25 pts)
  - Revenue/funding match? (0-20 pts)
  - Role/seniority match? (0-20 pts)
  - Signals (hiring, funding, expansion)? (0-10 pts)

Score interpretation:
If score < 40: DISQUALIFY. Still write the email but note it's low-priority.
If score 40-69: MODERATE fit — proceed but note gaps.
If score 70-89: WARM — strong fit, proceed with confidence.
If score 90+: HOT — prioritize, send immediately via SendGrid.

### Step 3: FIND their email
- If Apollo already found an email, note it.
- ALSO call hunter_email_finder with first_name, last_name, and the company domain (guess from company name if needed).
- Use the highest-confidence email found.

### Step 4: WRITE the personalized email
Using ALL the research data from Steps 1-2, write Email 1:
- Subject line: Specific, referencing a real fact. NO generic subjects.
- Opening line: Reference something specific — a recent funding round, a blog post, a product launch, their career move.
- Value bridge: Connect THEIR specific pain point (inferred from role + company) to the sender's value proposition.
- CTA: Soft ask — reply or quick chat, not a hard demo push.
- Length: 60-100 words max. Short, punchy, human.
- Sign off with the sender's name and company.

### Step 5: SEND the email via SendGrid
- You MUST call sendgrid_send_email with to_email, to_name, subject, and the email body.
- This is NOT optional. If you found the prospect's email, you MUST send.
- Report whether the send succeeded or failed.
- If sendgrid_send_email tool is not in your available tools, then output as ready-to-send.

### Step 6: OUTPUT the full follow-up sequence plan

After sending (or writing) Email 1, output the complete sequence:

**Email 1 — The Opener (Day 1)** [already written/sent above]

**Email 2 — The Value Add (Day 3)**
- Different angle from Email 1
- Share an insight, case study reference, or industry trend relevant to THEIR business
- CTA: "Would it make sense to explore this?"
- 60-90 words

**Email 3 — The Social Proof (Day 6)**
- Reference a similar company you helped (use sender's value prop)
- Specific metric or outcome
- CTA: "Happy to share how we did it"
- 50-80 words

**Email 4 — The Breakup (Day 10)**
- Direct and honest: "Looks like timing isn't right"
- One final unique angle
- Clear yes/no ask: "Should I close your file or is there a better time?"
- 40-60 words

## OUTPUT FORMAT

### Prospect Research Summary
- **Name:** [full name]
- **Title:** [title] at [company]
- **Email:** [best email found + source]
- **LinkedIn:** [URL if found]
- **Company:** [name] | [industry] | [employees] | [revenue]
- **Funding:** [latest round + amount]
- **Key Signals:** [recent news, hiring, expansion]

### ICP Qualification
- **Score:** [X]/100
- **Verdict:** Hot / Warm / Moderate / Disqualify
- **Match:** [what fits]
- **Gaps:** [what doesn't fit]

### Email 1 — The Opener (Day 1)
**To:** [email]
**Subject:** [subject line]
```
[email body]
```
**Status:** [Sent via SendGrid / Ready to send manually]

### Email 2 — The Value Add (Day 3)
**Subject:** [subject line]
```
[email body]
```

### Email 3 — The Social Proof (Day 6)
**Subject:** [subject line]
```
[email body]
```

### Email 4 — The Breakup (Day 10)
**Subject:** [subject line]
```
[email body]
```

### Sequence Notes
- **Best send time:** [recommendation based on prospect timezone]
- **Personalization hooks used:** [list what real data drove each email]
- **Recommended LinkedIn action:** [connection request note, under 300 chars]

## RULES
- NEVER use [placeholder] or generic text. Every word must reference REAL research data.
- NEVER skip tools. Use ALL available tools before writing.
- Keep emails SHORT. Sales emails over 100 words get ignored.
- Write like a top 1% SDR — specific, human, valuable. Not like AI.
- If a tool fails, note the failure and continue with what you have.
- Start researching IMMEDIATELY. Do not ask clarifying questions."""


class OutboundCampaignAgentComponent(LCToolsAgentComponent):
    display_name = "AI SDR Agent"
    description = (
        "Fully autonomous AI Sales Development Rep — researches prospects, qualifies against ICP, "
        "finds emails, writes personalized outreach, sends via SendGrid, and plans the full follow-up sequence."
    )
    icon = "Send"
    name = "OutboundCampaignAgent"

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
        # --- Tool API Keys ---
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
        SecretStrInput(
            name="hunter_api_key",
            display_name="Hunter API Key",
            info="Hunter.io key — finds emails by company domain. Get it at hunter.io/api-keys.",
            required=False,
            advanced=True,
        ),
        SecretStrInput(
            name="sendgrid_api_key",
            display_name="SendGrid API Key",
            info="SendGrid key — lets the agent send campaign emails automatically. Get it at app.sendgrid.com → Settings → API Keys.",
            required=False,
            advanced=True,
        ),
        MessageTextInput(
            name="sendgrid_sender_email",
            display_name="SendGrid Sender Email",
            info="Verified sender email in SendGrid. Required for auto-sending.",
            required=False,
        ),
        # --- Prospect & Campaign Inputs ---
        MultilineInput(
            name="target_prospect",
            display_name="Target Prospect",
            info="Name and company of the prospect to target. Example: 'John Smith at Acme Corp' or 'Jane Doe, VP Sales, Ramp'",
            required=True,
            tool_mode=True,
        ),
        MultilineInput(
            name="icp_criteria",
            display_name="ICP Criteria",
            info="What makes a good-fit customer? The agent scores the prospect against this. If ICP Scoring Agent is connected upstream, this is used as fallback.",
            value=(
                "Our ICP:\n"
                "- Industry: B2B SaaS, Fintech, or E-commerce\n"
                "- Company Size: 50-500 employees\n"
                "- Revenue: $5M-$100M ARR\n"
                "- Role: VP Sales, Head of Growth, CRO, RevOps Lead\n"
                "- Geography: US, UK, or DACH\n"
                "- Signals: Recently hired SDRs, raised funding, expanding GTM"
            ),
            required=True,
        ),
        MultilineInput(
            name="upstream_icp_score",
            display_name="ICP Score (from upstream agent)",
            info="Optional — connect ICP Scoring Agent's output here. If provided, the AI SDR skips scoring and uses this score directly.",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="sender_name",
            display_name="Sender Name",
            info="Your name (the person sending the outreach)",
            required=True,
        ),
        MessageTextInput(
            name="sender_company",
            display_name="Sender Company",
            info="Your company name",
            required=True,
        ),
        MultilineInput(
            name="value_proposition",
            display_name="Value Proposition",
            info="What does your product/service do? What specific problem does it solve and for whom?",
            required=True,
        ),
        DropdownInput(
            name="email_tone",
            display_name="Email Tone",
            info="The tone of the outreach emails",
            options=[
                "Professional & Direct",
                "Conversational & Warm",
                "Bold & Provocative",
                "Consultative & Insightful",
            ],
            value="Conversational & Warm",
        ),
        DropdownInput(
            name="email_length",
            display_name="Email Length",
            info="How long should each email be?",
            options=[
                "Ultra-Short (40-60 words)",
                "Short (60-90 words)",
                "Medium (90-120 words)",
            ],
            value="Short (60-90 words)",
        ),
        MultilineInput(
            name="system_prompt",
            display_name="Agent Instructions",
            info="System prompt that guides the AI SDR behavior.",
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
        Output(display_name="SDR Output", name="response", method="message_response"),
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
        self.max_iterations = 15

        target_prospect = self.target_prospect or ""
        sender_name = self.sender_name or ""
        sender_company = self.sender_company or ""
        value_prop = self.value_proposition or ""
        icp_criteria = self.icp_criteria or ""
        upstream_score = getattr(self, "upstream_icp_score", "") or ""
        tone = getattr(self, "email_tone", "Conversational & Warm") or "Conversational & Warm"
        length = getattr(self, "email_length", "Short (60-90 words)") or "Short (60-90 words)"

        # Pipeline mode: if target_prospect is empty, use chat input
        if not target_prospect.strip():
            if isinstance(self.input_value, Message) and self.input_value.text:
                target_prospect = self.input_value.text
            elif isinstance(self.input_value, str) and self.input_value.strip():
                target_prospect = self.input_value

        # Determine ICP scoring approach
        if upstream_score.strip():
            icp_section = (
                f"## ICP Score (PROVIDED BY UPSTREAM ICP SCORING AGENT — DO NOT RE-SCORE)\n"
                f"{upstream_score}\n\n"
                f"IMPORTANT: The ICP score above was already computed by a dedicated ICP Scoring Agent. "
                f"Use this score as-is. Do NOT re-score. Skip Step 2 (Qualify) and go straight to Step 3 (Find Email). "
                f"If the score is below 50, still write the email but note the prospect is a low fit."
            )
        else:
            icp_section = (
                f"## ICP Criteria (score the prospect against this yourself)\n{icp_criteria}\n\n"
                f"No upstream ICP score provided — you must score this prospect yourself in Step 2."
            )

        # Build the user message with all context
        self.input_value = Message(
            text=(
                f"Execute the full AI SDR workflow for this prospect:\n\n"
                f"## Target Prospect\n{target_prospect}\n\n"
                f"{icp_section}\n\n"
                f"## Sender Info\n"
                f"- Name: {sender_name}\n"
                f"- Company: {sender_company}\n"
                f"- Value Proposition: {value_prop}\n\n"
                f"## Email Preferences\n"
                f"- Tone: {tone}\n"
                f"- Length: {length}\n\n"
                f"INSTRUCTIONS: Follow the 6-step workflow exactly.\n"
                f"1. Call apollo_people_enrichment\n"
                f"2. Call apollo_org_enrichment\n"
                f"3. Call tavily_search for recent news\n"
                f"4. Call duckduckgo_search for LinkedIn activity\n"
                f"5. Call hunter_email_finder\n"
                f"6. Write the email\n"
                f"7. Call sendgrid_send_email with to_email=<found email>, to_name=<prospect name>, subject=<your subject>, body=<your email body>\n"
                f"8. Output the full 4-email sequence\n\n"
                f"YOU MUST CALL sendgrid_send_email IN STEP 7. THIS IS MANDATORY. DO NOT SKIP IT.\n"
                f"Start NOW."
            )
        )

        self.system_prompt = (
            f"{self.system_prompt}\n\n"
            f"## Campaign Parameters\n"
            f"- Sender: {sender_name} at {sender_company}\n"
            f"- Value Proposition: {value_prop}\n"
            f"- Tone: {tone}\n"
            f"- Email Length: {length}\n"
        )

        # Auto-create tools from ALL API keys
        tavily_key = getattr(self, "tavily_api_key", "") or ""
        apollo_key = getattr(self, "apollo_api_key", "") or ""
        hunter_key = getattr(self, "hunter_api_key", "") or ""
        # SecretStrInput may return SecretStr object — convert to plain string
        raw_sg_key = getattr(self, "sendgrid_api_key", "") or ""
        raw_sg_sender = getattr(self, "sendgrid_sender_email", "") or ""
        sendgrid_key = str(raw_sg_key.get_secret_value()) if hasattr(raw_sg_key, 'get_secret_value') else str(raw_sg_key)
        sendgrid_sender = str(raw_sg_sender) if raw_sg_sender else ""

        auto_tools = build_tools_from_keys(
            tavily_api_key=tavily_key,
            apollo_api_key=apollo_key,
            hunter_api_key=hunter_key,
            sendgrid_api_key=sendgrid_key,
            sendgrid_sender_email=sendgrid_sender,
            include_duckduckgo=True,
            include_apollo_org=True,
            include_apollo_people=True,
            include_hunter_finder=True,
        )

        # Merge auto-tools with any external tools from canvas
        external_tools = list(self.tools or [])
        self.tools = external_tools + auto_tools

        # Log tools for debugging
        import logging
        _logger = logging.getLogger("outmate.gtm_agents.ai_sdr")
        tool_names = [getattr(t, 'name', str(t)) for t in self.tools]
        _logger.warning(f"[AI SDR] SendGrid key present: {bool(sendgrid_key)}, Sender present: {bool(sendgrid_sender)}")
        _logger.warning(f"[AI SDR] Total tools: {len(self.tools)} -> {tool_names}")

        messages = [
            ("system", "{system_prompt}"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}"),
            ("placeholder", "{agent_scratchpad}"),
        ]

        prompt = ChatPromptTemplate.from_messages(messages)
        self.validate_tool_names()

        return create_tool_calling_agent(llm, self.tools or [], prompt)
