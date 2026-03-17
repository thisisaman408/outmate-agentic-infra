"""
GTM Agents Service — OpenRouter implementation.
Powering the last 5 agents with surgical precision using Claude 3.5 Haiku and Perplexity Sonar Pro.
"""
import logging
import json
from typing import Any, Dict, List, Optional

import httpx

from app.core.settings import settings

logger = logging.getLogger(__name__)

_OPENROUTER_URL = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
_HEADERS = {
    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "https://outmate.ai",
    "X-Title": "Outmate GTM Agents",
}

_MODEL_HAIKU = "anthropic/claude-3.5-haiku"
_MODEL_PERPLEXITY = "perplexity/sonar-pro"
_TIMEOUT = 120.0


async def _call_openrouter(model: str, system_prompt: str, user_message: str, temperature: float = 0.4) -> str:
    """Call OpenRouter with a specific model and return clean text."""
    # Append strict formatting rules to the system prompt
    formatting_rule = (
        "\n\nSTRICT FORMATTING RULE: Do NOT use markdown symbols like #, *, **, or [1]. "
        "Do NOT use tables or the | symbol. Do NOT include citations. "
        "Use plain text with capitalized headers and double line breaks for structure."
    )
    final_system_prompt = system_prompt + formatting_rule
    
    payload = {
        "model": model,
        "max_tokens": 4000,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": final_system_prompt},
            {"role": "user", "content": user_message},
        ],
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        try:
            resp = await client.post(_OPENROUTER_URL, headers=_HEADERS, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            
            # Post-processing cleanup for citations and markdown
            import re
            # Remove citations like [1], [2], [3...]
            content = re.sub(r'\[\d+\]', '', content)
            # Remove markdown bold/italic
            content = content.replace('**', '').replace('*', '')
            # Remove table structures and pipe symbols
            content = re.sub(r'\|[-:| ]+\|', '', content) # Removes |---| and variants
            content = content.replace('|', '')
            # Remove markdown headers
            content = re.sub(r'^#+\s*', '', content, flags=re.MULTILINE)
            
            return content.strip()
        except Exception as e:
            logger.error("OpenRouter call failed for model %s: %s", model, e)
            raise


class GTMAgentsService:
    """
    Orchestrator for the specialised GTM agents.
    Uses Perplexity Sonar Pro for research-heavy tasks and Claude 3.5 Haiku for logical/creative ones.
    """
    
    def __init__(self):
        # Diagnostic: Print configured status
        print(f">>> GTMAgentsService: OpenRouter API key configured: {bool(settings.OPENROUTER_API_KEY)}", flush=True)

    async def run_crossfire(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Competitive Intelligence Agent — uses Perplexity for real-time data."""
        competitor_domain = inputs.get("competitor_domain", "")
        target_region = inputs.get("target_region")
        notes = inputs.get("notes")

        logger.info("Running Crossfire (Perplexity) for competitor=%s", competitor_domain)

        system_prompt = (
            "You are a professional B2B competitive intelligence agent. "
            "You use real-time web research to identify competitor weaknesses and stealable accounts. "
            "Identify real signals like pricing changes, product complaints, or leadership churn. "
        )

        context = f"Competitor: {competitor_domain}. Region: {target_region or 'Global'}. Notes: {notes or 'None'}."
        user_message = (
            f"Research {competitor_domain} and provide a Crossfire Intelligence Report. "
            "Include: 1. Competitor Profile, 2. Stealable Account Segments (with signals), "
            "3. Hard-hitting Objection Handles, 4. Battle Card Differentiators, 5. Poaching Sequences."
        )

        result = await _call_openrouter(_MODEL_PERPLEXITY, system_prompt, user_message)
        return {"result": result}

    async def run_compliance_oracle(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Compliance Agent — uses Claude 3.5 Haiku for legal logic."""
        message_template = inputs.get("message_template", "")
        jurisdictions = inputs.get("jurisdictions") or "US, EU, UK"

        logger.info("Running Compliance Oracle (Claude Haiku) for jurisdictions=%s", jurisdictions)

        system_prompt = (
            "You are a global outbound compliance expert. Audit messages for GDPR, CAN-SPAM, CASL, etc. "
            "Be precise but maintain sales effectiveness."
        )

        user_message = (
            f"Audit the following for {jurisdictions}:\n\n{message_template}\n\n"
            "Provide: 1. Risk Assessment, 2. Jurisdiction Analysis, 3. Required Changes, 4. Compliant Rewrite."
        )

        result = await _call_openrouter(_MODEL_HAIKU, system_prompt, user_message, temperature=0.2)
        return {"result": result}

    async def run_virality_engine(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Virality Agent — uses Claude 3.5 Haiku for creative growth loops."""
        seed_customers = inputs.get("seed_customers", "")
        channels = inputs.get("channels") or "email, linkedin"

        logger.info("Running Virality Engine (Claude Haiku) for seeds=%s", seed_customers)

        system_prompt = (
            "You are a B2B viral growth engineer. Design self-propagating referral loops and cascade campaigns. "
            "Use psychological triggers to turn champions into propagators."
        )

        user_message = (
            f"Design a viral growth plan for seed customers: {seed_customers} via {channels}. "
            "Include: 1. Champion Profiling, 2. Viral Loop Design, 3. Referral Hooks, 4. Cascade Sequence."
        )

        result = await _call_openrouter(_MODEL_HAIKU, system_prompt, user_message)
        return {"result": result}

    async def run_talent_radar(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Talent Churn Agent — uses Perplexity for real-time hiring/personnel signals."""
        accounts = inputs.get("accounts", "")
        lookback = inputs.get("lookback_days", 90)

        logger.info("Running Talent Radar (Perplexity) for accounts=%s", accounts)

        system_prompt = (
            "You are an executive talent analyst. Identify churn risks by monitoring real-time signals: "
            "new leadership hires, job postings, and title changes at specific accounts."
        )

        user_message = (
            f"Monitor {accounts} for the last {lookback} days. "
            "Provide: 1. Churn Risk Assessment, 2. Leading Indicator Signals found, "
            "3. Early Warning Triggers, 4. Retention Playbook."
        )

        result = await _call_openrouter(_MODEL_PERPLEXITY, system_prompt, user_message)
        return {"result": result}

    async def run_regime_shifter(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Macro Adaptation Agent — uses Perplexity for macro-economic/geopolitical research."""
        geo_focus = inputs.get("geo_focus", "")
        scenario = inputs.get("scenario")

        logger.info("Running Regime Shifter (Perplexity) for geo=%s", geo_focus)

        system_prompt = (
            "You are a macro-economic GTM strategist. Adapt ICP and messaging to market shifts like "
            "regulation changes, economic events, or geopolitical scenarios."
        )

        user_message = (
            f"Analyse the impact of {scenario or 'current market conditions'} on {geo_focus}. "
            "Provide: 1. Impact Analysis, 2. ICP Adjustments, 3. Messaging Pivots, 4. Phased GTM Plan."
        )

        result = await _call_openrouter(_MODEL_PERPLEXITY, system_prompt, user_message)
        return {"result": result}


gtm_agents_service = GTMAgentsService()
