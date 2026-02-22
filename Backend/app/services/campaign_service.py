"""
Campaign Service - LLM-powered draft generation for signal-triggered outreach.
Uses OpenRouter (Claude) to generate personalized email and LinkedIn drafts.
"""

import os
import json
import httpx
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class CampaignDraftRequest(BaseModel):
    recipients: List[Dict[str, Any]]
    signals: List[Dict[str, Any]]
    intent: str  # "prospect" or "business"
    context: Optional[str] = ""


class CampaignDraftResponse(BaseModel):
    subject: str
    email_body: str
    linkedin_message: str
    recipients: List[Dict[str, Any]]


class CampaignService:
    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        print(f">>> [Campaign] API key loaded: {bool(self.openrouter_api_key)}, prefix: {self.openrouter_api_key[:8] if self.openrouter_api_key else 'NONE'}...", flush=True)

    def _extract_recipients(self, raw_results: List[Dict[str, Any]], intent: str) -> List[Dict[str, Any]]:
        """Extract and normalize recipient info from raw search results."""
        recipients = []
        for r in raw_results[:10]:
            if intent == "prospect":
                # Extract current employer info
                current_employer = {}
                if r.get("current_employers") and len(r["current_employers"]) > 0:
                    current_employer = r["current_employers"][0]
                elif r.get("employer") and len(r["employer"]) > 0:
                    current_employer = r["employer"][0]

                email = ""
                if r.get("emails") and len(r["emails"]) > 0:
                    email = r["emails"][0]
                elif r.get("email"):
                    email = r["email"]

                recipients.append({
                    "name": r.get("name") or r.get("full_name") or "Unknown",
                    "first_name": r.get("first_name") or (r.get("name") or "").split(" ")[0],
                    "email": email,
                    "linkedin_url": r.get("linkedin_profile_url") or r.get("flagship_profile_url") or "",
                    "job_title": current_employer.get("title") or r.get("headline") or "",
                    "company": current_employer.get("name") or "",
                    "domain": current_employer.get("company_website_domain") or current_employer.get("company_domain") or "",
                })
            else:
                # Company intent
                recipients.append({
                    "name": r.get("name") or r.get("company_name") or "Unknown",
                    "domain": r.get("domain") or "",
                    "industry": r.get("industry") or "",
                    "contact_email": r.get("contact_email") or "",
                    "company": r.get("name") or r.get("company_name") or "Unknown",
                })
        return recipients

    def _format_recipients_for_prompt(self, recipients: List[Dict[str, Any]], signals: List[Dict[str, Any]], intent: str) -> str:
        """Format recipients and their signals for the LLM prompt."""
        lines = []
        for i, recipient in enumerate(recipients, 1):
            if intent == "prospect":
                line = f"{i}. {recipient.get('name', 'Unknown')} — {recipient.get('job_title', 'N/A')} at {recipient.get('company', 'N/A')}"
            else:
                line = f"{i}. {recipient.get('name', 'Unknown')} — {recipient.get('industry', 'N/A')} (domain: {recipient.get('domain', 'N/A')})"

            # Find matching signals for this recipient
            matching_signals = []
            for sig in signals:
                sig_name = (sig.get("company_name") or sig.get("name") or "").lower()
                recip_name = (recipient.get("name") or recipient.get("company") or "").lower()
                if sig_name and recip_name and (sig_name in recip_name or recip_name in sig_name):
                    for s in sig.get("signals", []):
                        matching_signals.append(f"  - [{s.get('type', 'signal')}] {s.get('description', '')}")
                    if sig.get("personalization_tips"):
                        matching_signals.append(f"  - [Tip] {sig['personalization_tips']}")

            if matching_signals:
                line += "\n" + "\n".join(matching_signals)
            lines.append(line)

        return "\n".join(lines)

    async def generate_draft(self, request: CampaignDraftRequest) -> CampaignDraftResponse:
        """Generate personalized campaign draft using Claude via OpenRouter."""
        if not self.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")

        recipients = self._extract_recipients(request.recipients, request.intent)
        formatted_recipients = self._format_recipients_for_prompt(recipients, request.signals, request.intent)

        intent_label = "prospects" if request.intent == "prospect" else "companies"

        # Build intent-specific variable rules and reference examples
        if request.intent == "prospect":
            variable_rules = """VARIABLE RULES:
- MUST use {{{{firstName}}}} for the recipient's first name and {{{{companyName}}}} for the company name.
- NEVER hardcode any specific person or company name — ALWAYS use the variables.
- Use {{{{firstName}}}} and {{{{companyName}}}} everywhere you would mention a name or company."""

            example_emails = """
REFERENCE EXAMPLES (study the tone, structure, and brevity — do NOT copy verbatim):

Example A (Signal-based):
Subject: Quick question about {{{{companyName}}}}
Body:
Hi {{{{firstName}}}},

Noticed {{{{companyName}}}} is [signal reference, e.g. expanding / hiring / launched something]. Congrats on the momentum.

I'm curious — how are you currently handling [pain point relevant to the search context]?

We've helped [similar role/company type] [specific result], and I'd be happy to share how.

Worth a quick chat this week?

[Sender Name]

Example B (Value-first):
Subject: Idea for {{{{companyName}}}}
Body:
Hi {{{{firstName}}}},

Most [job title]s at [company type] focus on [common approach], but I noticed {{{{companyName}}}} is doing something different with [signal or observation].

That's relevant to a pattern I've been tracking — companies that [action] have seen [tangible result].

Not sure if it applies to you, but thought it was worth flagging. Open to a 10-min call?

[Sender Name]

Example C (LinkedIn — short):
Hi {{{{firstName}}}}, saw {{{{companyName}}}} is [signal]. We helped a similar team [result] — thought it might be relevant. Open to connecting?"""

        else:
            variable_rules = """VARIABLE RULES:
- MUST use {{{{companyName}}}} for the company name. This is the ONLY template variable.
- Do NOT use {{{{firstName}}}} — these are companies, not individual people.
- Address the email to the team generically (e.g. "Hi {{{{companyName}}}} team" or just "Hi there").
- NEVER hardcode any specific company name — ALWAYS use {{{{companyName}}}}."""

            example_emails = """
REFERENCE EXAMPLES (study the tone, structure, and brevity — do NOT copy verbatim):

Example A (Signal-based):
Subject: Quick question for the {{{{companyName}}}} team
Body:
Hi {{{{companyName}}}} team,

I came across {{{{companyName}}}} while researching [industry/niche] companies [signal reference, e.g. showing strong growth / expanding into new markets].

We work with similar [company type] to [primary benefit], and given what {{{{companyName}}}} is building, there might be a fit worth exploring.

Would anyone on your team be open to a brief conversation?

[Sender Name]

Example B (Value-first):
Subject: Idea for {{{{companyName}}}}
Body:
Hi there,

I noticed {{{{companyName}}}} is [signal or observation]. That caught my attention because companies in [industry] that [action] have seen [tangible result].

We've helped teams like yours [specific outcome]. Happy to share how if it's relevant.

Worth a quick call?

[Sender Name]

Example C (LinkedIn — short):
Hi, noticed {{{{companyName}}}} is [signal]. We've helped similar companies [result] — thought it might be relevant to your team. Open to connecting?"""

        prompt = f"""You are an expert B2B cold outreach copywriter. Your emails get replies because they are short, signal-driven, and human.

RECIPIENTS ({intent_label}) with detected signals:
{formatted_recipients}

USER'S SEARCH CONTEXT: "{request.context}"

{example_emails}

YOUR TASK:
Generate ONE outreach template (JSON) that works for ALL recipients above. The template must:
1. Open with a specific signal reference (funding, hiring, growth, product launch, leadership change, etc.) drawn from the recipients' signals above. Use the CATEGORY of signal, not a specific company's details.
2. Connect that signal to a relevant pain point or opportunity.
3. Offer a concrete value statement (what you help with and a tangible result).
4. End with a low-friction CTA — a question or short meeting ask, NOT "let me know your thoughts."
5. Be under 120 words for email, under 80 words for LinkedIn.
6. Sound like a real human wrote it — no corporate jargon, no filler phrases like "I hope this email finds you well", no "I wanted to reach out", no "I'd love to".
7. No emojis. No exclamation mark overload (max 1 in the entire email). No bullet points in the email body.

{variable_rules}

Return ONLY valid JSON with exactly these keys:
{{
  "subject": "Short, curiosity-driven subject line (under 8 words) using {{{{companyName}}}}",
  "email_body": "The email body following the rules above.",
  "linkedin_message": "Shorter, more casual LinkedIn version following the rules above."
}}

Return ONLY the JSON object, no other text."""

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Outmate AI"
        }

        payload = {
            "model": "anthropic/claude-3.5-haiku",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1500,
        }

        import asyncio

        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    response = await client.post(
                        "https://openrouter.ai/api/v1/chat/completions",
                        headers=headers,
                        json=payload
                    )

                    print(f">>> [Campaign] Attempt {attempt+1} - OpenRouter status: {response.status_code}", flush=True)
                    if response.status_code == 200:
                        result = response.json()
                        content = result["choices"][0]["message"]["content"]
                        print(f">>> [Campaign] LLM response: {content[:300]}", flush=True)

                        parsed = self._parse_json(content)
                        if not parsed:
                            print(f">>> [Campaign] Failed to parse JSON from: {content}", flush=True)
                            raise ValueError("LLM returned non-JSON response for campaign draft")

                        return CampaignDraftResponse(
                            subject=parsed.get("subject", "Quick follow-up"),
                            email_body=parsed.get("email_body", ""),
                            linkedin_message=parsed.get("linkedin_message", ""),
                            recipients=recipients
                        )
                    elif response.status_code in (401, 429, 500, 502, 503):
                        error_text = response.text
                        print(f">>> [Campaign] Retryable error {response.status_code}: {error_text}", flush=True)
                        last_error = f"OpenRouter API error: {response.status_code}"
                        if attempt < 2:
                            await asyncio.sleep(2 * (attempt + 1))
                            continue
                    else:
                        error_text = response.text
                        print(f">>> [Campaign] OpenRouter error {response.status_code}: {error_text}", flush=True)
                        raise ValueError(f"OpenRouter API error: {response.status_code} - {error_text}")

            except httpx.TimeoutException:
                print(f">>> [Campaign] Attempt {attempt+1} timed out", flush=True)
                last_error = "Request timed out"
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
            except ValueError:
                raise
            except Exception as e:
                print(f">>> [Campaign] Attempt {attempt+1} failed: {e}", flush=True)
                last_error = str(e)
                if attempt < 2:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue

        raise ValueError(f"Campaign draft generation failed after 3 attempts: {last_error}")

    @staticmethod
    def _extract_json_block(content: str) -> Optional[str]:
        if not content:
            return None
        start = None
        stack = 0
        in_string = False
        escape = False
        for idx, ch in enumerate(content):
            if escape:
                escape = False
                continue
            if start is None:
                if ch == "{":
                    start = idx
                    stack = 1
                    continue
            else:
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_string = not in_string
                elif not in_string:
                    if ch == "{":
                        stack += 1
                    elif ch == "}":
                        stack -= 1
                        if stack == 0:
                            return content[start : idx + 1]
        return None

    def _parse_json(self, content: str) -> Optional[Dict[str, Any]]:
        """Parse JSON from LLM response, handling markdown fences."""
        if not content or not content.strip():
            return None

        # Try direct parse
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

        # Try extracting from markdown code fence
        block = CampaignService._extract_json_block(content)
        if block:
            try:
                parsed = json.loads(block)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                pass

        return None
