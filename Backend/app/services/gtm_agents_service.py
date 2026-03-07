"""
GTM Agents Service — OpenRouter/Claude implementation.

Replaces the original CrewAI-based implementation to use the same
OpenRouter/Claude stack that powers the rest of the AI agents,
eliminating the dependency on OPENAI_API_KEY and the CrewAI overhead.
"""
import logging
from typing import Any, Dict, Optional

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

# Fast, high-quality model for all GTM agents
_MODEL = "anthropic/claude-3.5-haiku"
_MAX_TOKENS = 4000
_TIMEOUT = 120.0


async def _call_claude(system_prompt: str, user_message: str) -> str:
    """Call OpenRouter with a system + user message pair and return the text."""
    payload = {
        "model": _MODEL,
        "max_tokens": _MAX_TOKENS,
        "temperature": 0.4,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(_OPENROUTER_URL, headers=_HEADERS, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


class GTMAgentsService:
    """
    Orchestrator for the 5 GTM agents.
    All agents use OpenRouter/Claude — no OPENAI_API_KEY required.
    """

    # ------------------------------------------------------------------
    # Crossfire — Competitive Intelligence & Market Analysis
    # ------------------------------------------------------------------
    async def run_crossfire(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        competitor_domain: str = inputs.get("competitor_domain", "")
        target_region: Optional[str] = inputs.get("target_region")
        notes: Optional[str] = inputs.get("notes")

        logger.info("Running Crossfire agent for competitor=%s", competitor_domain)

        system_prompt = (
            "You are a world-class competitive intelligence analyst specialising in B2B SaaS GTM strategy. "
            "You produce actionable, specific battle cards and account-poaching strategies. "
            "Format your response with clear sections using markdown headers. "
            "Be specific — name real pain points, objection handles, and account segments."
        )

        context_lines = [f"**Competitor domain:** {competitor_domain}"]
        if target_region:
            context_lines.append(f"**Target region:** {target_region}")
        if notes:
            context_lines.append(f"**Additional context:** {notes}")
        context = "\n".join(context_lines)

        user_message = f"""{context}

Produce a comprehensive Crossfire Intelligence Report with the following sections:

## 1. Competitor Profile
Summarise the competitor's positioning, key strengths, weaknesses, and typical ICP.

## 2. Stealable Accounts
Identify 5-8 specific account segments or company profiles that are likely to be dissatisfied with this competitor. Explain the signals to look for.

## 3. Objection Handles
Provide 4-6 specific objection handles for prospects currently using this competitor.

## 4. Battle Card
Key differentiators to lead with in discovery calls. What makes us win against this competitor?

## 5. Poaching Sequences
Outline a 3-touch outreach sequence targeting this competitor's customers. Include subject lines and core message angles.

## 6. Timing Signals
What events or signals should trigger a competitive outreach play (e.g. pricing changes, product issues, leadership churn)?
"""
        result = await _call_claude(system_prompt, user_message)
        return {"result": result}

    # ------------------------------------------------------------------
    # Compliance Oracle — Global Outreach Compliance
    # ------------------------------------------------------------------
    async def run_compliance_oracle(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        message_template: str = inputs.get("message_template", "")
        jurisdictions: str = inputs.get("jurisdictions") or "US, EU, UK"

        logger.info("Running Compliance Oracle for jurisdictions=%s", jurisdictions)

        system_prompt = (
            "You are a senior compliance attorney and outbound sales expert who specialises in global outreach regulations: "
            "GDPR (EU), CAN-SPAM (US), CASL (Canada), UK PECR, PDPA (Singapore/Thailand), and APAC equivalents. "
            "You balance legal compliance with sales effectiveness — you never kill performance unnecessarily. "
            "Format your response with clear sections."
        )

        user_message = f"""**Jurisdictions to check:** {jurisdictions}

**Message/Sequence to audit:**
---
{message_template}
---

Produce a Compliance Report with the following sections:

## 1. Compliance Risk Assessment
Rate overall risk (Low / Medium / High) and explain the key issues found.

## 2. Jurisdiction-by-Jurisdiction Analysis
For each jurisdiction listed, note specific issues or confirmations of compliance.

## 3. Required Changes
List concrete changes required to make this message compliant in all listed jurisdictions.

## 4. Compliant Rewrite
Provide a fully rewritten version that is compliant across all jurisdictions while preserving maximum sales effectiveness.

## 5. Best Practices
3-5 best practices for ongoing compliant outreach in these markets.
"""
        result = await _call_claude(system_prompt, user_message)
        return {"result": result}

    # ------------------------------------------------------------------
    # Virality Engine — B2B Viral Growth
    # ------------------------------------------------------------------
    async def run_virality_engine(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        seed_customers: str = inputs.get("seed_customers", "")
        channels: str = inputs.get("channels") or "email, linkedin, in-product"

        logger.info("Running Virality Engine for seeds=%s", seed_customers)

        system_prompt = (
            "You are a B2B growth expert who has built viral loops and referral programs for top SaaS companies. "
            "You specialise in turning champions into propagators through clever referral mechanics, "
            "in-product hooks, and multi-channel cascade campaigns. "
            "Your strategies are specific, implementable, and grounded in human psychology."
        )

        user_message = f"""**Seed customers / champion personas:** {seed_customers}
**Target channels:** {channels}

Design a comprehensive Virality Engine plan with the following sections:

## 1. Champion Profile Analysis
Analyse the motivations, networks, and influence of the seed customers/personas listed.

## 2. Viral Loop Design
Describe 2-3 self-propagating viral loops tailored to this audience. Include trigger, action, reward, and propagation mechanism.

## 3. Referral Hook Strategy
Design 4-6 specific referral hooks for each channel ({channels}). Include copy angles, incentives, and timing.

## 4. Multi-Channel Cascade
Map out a step-by-step multi-channel campaign that activates the champion, gets a referral, and onboards the referred prospect. Include timing and messaging for each touchpoint.

## 5. Network Amplification
How do we identify and activate second-degree connections from these champions?

## 6. KPIs & Measurement
Key metrics to track virality coefficient (K-factor), referral conversion, and time-to-second-sale.
"""
        result = await _call_claude(system_prompt, user_message)
        return {"result": result}

    # ------------------------------------------------------------------
    # Talent Radar — Executive Churn Prediction
    # ------------------------------------------------------------------
    async def run_talent_radar(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        accounts: str = inputs.get("accounts", "")
        lookback_days: int = inputs.get("lookback_days", 90)

        logger.info("Running Talent Radar for accounts=%s lookback=%d", accounts, lookback_days)

        system_prompt = (
            "You are a customer success and churn prediction expert with deep expertise in reading "
            "executive hiring signals, LinkedIn activity patterns, and intent data to predict "
            "account churn 60-90 days before it happens. "
            "You translate signals into specific retention plays and early-warning playbooks."
        )

        user_message = f"""**Key accounts to monitor:** {accounts}
**Lookback window:** {lookback_days} days

Produce a Talent Radar Signal Report with the following sections:

## 1. Churn Risk Assessment
For each account listed, assess likely churn risk (High / Medium / Low) based on typical signals for that type of company.

## 2. Leading Indicator Signals
List the specific signals to monitor for each account:
- Hiring/job postings (new CTO, VP Product, switching from our stack)
- Executive departures or title changes
- Headcount contraction signals
- Reduced product engagement patterns
- Competitor evaluation signals

## 3. Early Warning Triggers
Define 5-7 specific events that should immediately trigger a retention play.

## 4. Retention Playbook
For each risk level (High / Medium / Low), provide a specific retention play:
- Who to contact
- What angle to use
- What proof points to surface
- Timeline for intervention

## 5. Expansion Opportunities
Within the same accounts, identify signals that indicate expansion readiness (new headcount, new budget cycle, new executive who doesn't know the product).

## 6. Monitoring Checklist
A practical weekly checklist for CSMs to track these signals across the {lookback_days}-day window.
"""
        result = await _call_claude(system_prompt, user_message)
        return {"result": result}

    # ------------------------------------------------------------------
    # Regime Shifter — Adaptive ICP Recalibration
    # ------------------------------------------------------------------
    async def run_regime_shifter(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        geo_focus: str = inputs.get("geo_focus", "")
        scenario: Optional[str] = inputs.get("scenario")

        logger.info("Running Regime Shifter for geo=%s scenario=%s", geo_focus, scenario)

        system_prompt = (
            "You are a GTM strategist who specialises in adapting ICP definitions, messaging, and sequences "
            "in response to macro-economic events, regulatory changes, and geopolitical shifts. "
            "You help revenue teams stay ahead of market changes by proactively recalibrating their targeting and narrative."
        )

        context_lines = [f"**Geo / ICP focus:** {geo_focus}"]
        if scenario:
            context_lines.append(f"**Macro event / scenario:** {scenario}")
        context = "\n".join(context_lines)

        user_message = f"""{context}

Produce an ICP Recalibration Report with the following sections:

## 1. Macro Impact Analysis
Analyse how the described scenario (or general market conditions for the geo) affects the target ICP's buying behaviour, budget availability, and priorities.

## 2. ICP Adjustments
Specific changes to make to the ICP definition:
- Which segments to prioritise more
- Which segments to de-prioritise or pause
- New verticals or personas that emerge as stronger fits in this environment
- Firmographic filters to add/remove

## 3. Messaging Pivots
How should the core value proposition and messaging shift?
- What pain points become more acute?
- What objections become more common?
- What proof points should be surfaced?

## 4. Sequence Adjustments
Specific changes to outreach sequences:
- Timing adjustments (slower/faster cadence)
- Channel mix changes
- Subject line and hook adjustments
- New proof points or case studies to reference

## 5. Competitive Dynamics
How does this macro shift change the competitive landscape in this geo? Who benefits, who loses?

## 6. 30-60-90 Day GTM Plan
A phased plan for recalibrating GTM motion over the next 90 days in response to this shift.
"""
        result = await _call_claude(system_prompt, user_message)
        return {"result": result}


gtm_agents_service = GTMAgentsService()
