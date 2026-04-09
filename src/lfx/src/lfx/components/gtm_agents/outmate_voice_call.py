"""OutMate Voice Call tool — triggers AI voice calls via the OutMate Voice Agent API."""

import json
from typing import cast

import requests
from langchain.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.inputs.inputs import MessageTextInput, MultilineInput, SecretStrInput
from lfx.schema.data import Data


class OutMateVoiceCallComponent(LCToolComponent):
    display_name = "OutMate Voice Call"
    description = (
        "Triggers an AI-powered outbound voice call via the OutMate Voice Agent. "
        "Pass prospect data (name, phone, company, context) and the voice agent "
        "will make the call with full context awareness."
    )
    icon = "PhoneCall"
    name = "OutMateVoiceCall"

    inputs = [
        MessageTextInput(
            name="voice_agent_url",
            display_name="Voice Agent URL",
            info="URL of the OutMate Voice Agent server",
            value="http://localhost:8000",
            required=True,
        ),
        MessageTextInput(
            name="prospect_name",
            display_name="Prospect Name",
            info="Full name of the prospect to call",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="prospect_phone",
            display_name="Phone Number",
            info="Phone number with country code (e.g., +14155551234)",
            required=True,
            tool_mode=True,
        ),
        MessageTextInput(
            name="prospect_company",
            display_name="Company",
            info="Prospect's company name",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="prospect_role",
            display_name="Role",
            info="Prospect's job title",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="prospect_industry",
            display_name="Industry",
            info="Prospect's industry",
            required=False,
            tool_mode=True,
        ),
        MultilineInput(
            name="call_context",
            display_name="Call Context",
            info="Enriched context for the call — pain points, signals, company intel, talking points",
            required=False,
            tool_mode=True,
        ),
        MessageTextInput(
            name="call_objective",
            display_name="Call Objective",
            info="Objective: intro_demo, discovery, nurture, follow_up, or closing",
            value="intro_demo",
            tool_mode=True,
        ),
        MessageTextInput(
            name="client_id",
            display_name="Client Profile ID",
            info="Client profile to use from the voice agent",
            value="client_1",
            advanced=True,
        ),
    ]

    def _call_api(
        self,
        name: str,
        phone: str,
        company: str = "",
        role: str = "",
        industry: str = "",
        context: str = "",
        call_objective: str = "intro_demo",
    ) -> list[Data]:
        url = f"{self.voice_agent_url.rstrip('/')}/make-call-direct"

        # Parse context — try JSON first, fall back to plain text
        context_data: dict | str
        try:
            context_data = json.loads(context) if context.strip().startswith("{") else context
        except (json.JSONDecodeError, AttributeError):
            context_data = context

        payload = {
            "name": name,
            "phone": phone,
            "company": company,
            "role": role,
            "industry": industry,
            "context": context_data,
            "call_objective": call_objective,
            "client_id": getattr(self, "client_id", "client_1") or "client_1",
        }

        try:
            resp = requests.post(url, json=payload, timeout=30)
        except requests.ConnectionError:
            return [Data(
                text=f"Voice agent not reachable at {url}. Is it running?",
                data={"error": "connection_refused", "url": url},
            )]
        except requests.Timeout:
            return [Data(
                text=f"Voice agent timed out at {url}.",
                data={"error": "timeout", "url": url},
            )]

        if resp.status_code >= 400:
            error_body = resp.text
            return [Data(
                text=f"Voice agent error ({resp.status_code}): {error_body}",
                data={"error": error_body, "status_code": resp.status_code},
            )]

        body = resp.json()
        text = (
            f"Call initiated to {body.get('lead', name)} at {body.get('company', company)}.\n"
            f"Call ID: {body.get('call_id', 'N/A')}\n"
            f"Status: {body.get('status', 'unknown')}"
        )
        return [Data(text=text, data=body)]

    def run_model(self) -> list[Data]:
        data = self._call_api(
            name=self.prospect_name or "",
            phone=self.prospect_phone or "",
            company=self.prospect_company or "",
            role=self.prospect_role or "",
            industry=self.prospect_industry or "",
            context=self.call_context or "",
            call_objective=self.call_objective or "intro_demo",
        )
        self.status = data
        return data

    def build_tool(self) -> StructuredTool:
        voice_url = self.voice_agent_url or "http://localhost:8000"
        client_id = getattr(self, "client_id", "client_1") or "client_1"

        def _make_call(
            name: str,
            phone: str,
            company: str = "",
            role: str = "",
            industry: str = "",
            context: str = "",
            call_objective: str = "intro_demo",
            voice_agent_url: str = "",
        ) -> list[Data]:
            """Trigger an AI voice call to a prospect via the OutMate Voice Agent."""
            url = f"{(voice_agent_url or voice_url).rstrip('/')}/make-call-direct"

            context_data: dict | str
            try:
                context_data = json.loads(context) if context.strip().startswith("{") else context
            except (json.JSONDecodeError, AttributeError):
                context_data = context

            payload = {
                "name": name,
                "phone": phone,
                "company": company,
                "role": role,
                "industry": industry,
                "context": context_data,
                "call_objective": call_objective,
                "client_id": client_id,
            }

            try:
                resp = requests.post(url, json=payload, timeout=30)
                if resp.status_code >= 400:
                    return [Data(text=f"Call failed ({resp.status_code}): {resp.text}", data={"error": resp.text})]
                body = resp.json()
                return [Data(
                    text=f"Call initiated to {name} at {company}. Call ID: {body.get('call_id', 'N/A')}",
                    data=body,
                )]
            except Exception as e:
                return [Data(text=f"Failed to trigger call: {e}", data={"error": str(e)})]

        return cast(
            "StructuredTool",
            StructuredTool.from_function(
                name="outmate_voice_call",
                description=(
                    "Trigger an AI-powered outbound voice call to a prospect. "
                    "Requires name and phone number. Optionally pass company, role, "
                    "industry, context (pain points, intel), and call_objective "
                    "(intro_demo/discovery/nurture/follow_up/closing)."
                ),
                func=_make_call,
            ),
        )
