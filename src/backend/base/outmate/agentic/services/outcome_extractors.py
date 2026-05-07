"""Per-template parsers that turn an agent's free-form markdown output into
structured tabular columns for the Outcome tab.

Architecture
------------
- `Extractor` is the contract: a pure function `(output_text) -> ExtractedRun`.
- Each template ships its own extractor that knows the markdown format its
  system prompt produces.
- `extract_for_flow(flow, output_text)` looks at the flow's name / agent type
  and dispatches to the right extractor; falls back to `generic_extractor`
  for arbitrary user-built workflows.
- The `columns` ordering returned by an extractor IS the column order the
  frontend renders, so each template controls its own table shape.

Adding a new template extractor
-------------------------------
1. Write a `parse_<name>(text) -> ExtractedRun` function below.
2. Map the agent's `display_name` (or its `Component.name` class attr) to it
   in `_BY_AGENT_NAME` / `_BY_TEMPLATE_NAME`.
3. That's it — no migration, no config flag.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class ExtractedRun:
    """One run rendered as a row in the Outcome table.

    Attributes:
        title: Short label for the row, e.g. "Vidit Paliwal — BigStep" for a
            prospect-research run, or the first line for arbitrary flows.
        columns: Ordered dict of {column_label: cell_value}. The frontend
            renders these as table columns in declaration order.
        sections: Long-form per-row blocks (markdown) shown below the row
            when expanded. Used for things like "Conversation Starters",
            "Email Body", or the full brief text.
        template: Detected template name (Prospect Research, ICP Scoring,
            Hyper-Personalisation, …, or "Generic").
    """

    title: str
    template: str
    columns: dict[str, Any] = field(default_factory=dict)
    sections: dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _line(text: str, pattern: str, *, group: int = 1) -> str:
    m = re.search(pattern, text)
    return m.group(group).strip() if m else ""


# Headings the agents emit in practice. We have to match all of these because
# (a) prompts ask for `### N. Header`, but (b) larger LLMs frequently "improve"
# the format to `**Header:**`, `## Header`, or `**Header**` — and bolded
# headings broke the strict `### ` regex, leaving every column blank for
# Prospect Research runs even though the brief was clearly in the output.
_SECTION_HEADERS = (
    r"###\s*\d*\.?\s*",          # `### 1. Role Context` / `### Role Context`
    r"##\s*\d*\.?\s*",           # `## Role Context`
    r"\*\*\s*\d*\.?\s*",         # `**Role Context:**` / `**Role Context**`
)
# What can terminate a section body — any new header style, end of text,
# or a markdown horizontal rule.
_SECTION_END = r"(?=\n\s*(?:###\s|\##\s|\*\*[A-Z][^*]*\*\*\s*\n|---\n)|\Z)"


def _section(text: str, header: str) -> str:
    """Pull the body under a `header` regardless of which markdown style the
    LLM used (`###`, `##`, or `**bold**`).
    """
    esc = re.escape(header)
    for prefix in _SECTION_HEADERS:
        pattern = rf"{prefix}{esc}[^\n]*\n([\s\S]*?){_SECTION_END}"
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def _bullets(text: str) -> list[str]:
    out = []
    for line in text.splitlines():
        s = line.lstrip().lstrip("-•*").strip()
        if s:
            out.append(s)
    return out


# A few field-extractors that work even when the LLM writes narrative prose
# instead of `**Field:** value` rows. These are the columns most prospect-
# research runs actually need to populate the dashboard, and Apollo / Hunter
# disable them often enough that we have to mine the text.
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_LINKEDIN_RE = re.compile(r"https?://(?:www\.|in\.)?linkedin\.com/(?:in|pub)/[\w%~.\-/?=&]+", re.IGNORECASE)
_COMPANY_LINKEDIN_RE = re.compile(r"https?://(?:www\.|in\.)?linkedin\.com/company/[\w%~.\-/?=&]+", re.IGNORECASE)
# Narrative role description: "X is the VP of Sales at Y" / "X, the VP of Sales at Y".
# We require " at " as the connector between title and company because the
# title itself often contains " of " ("VP of Sales", "Head of Marketing"),
# so an "of"-anchored split would chop the title in half.
_NARRATIVE_ROLE_RE = re.compile(
    r"\*?\*?([A-Z][\w.\- ]{1,60}?)\*?\*?\s+is\s+(?:the|a|an)\s+"
    r"([A-Z][\w&/.\- ]{2,80}?)\s+at\s+"
    r"([A-Z][\w&\- .,]+?)(?:[.,;\n]|$)"
)


def _first(pattern: re.Pattern[str], text: str) -> str:
    m = pattern.search(text)
    return m.group(0).strip() if m else ""


def _email_in(*chunks: str) -> str:
    for c in chunks:
        if not c:
            continue
        m = _EMAIL_RE.search(c)
        if m:
            return m.group(0).strip()
    return ""


def _linkedin_in(*chunks: str, prefer_personal: bool = True) -> str:
    if prefer_personal:
        for c in chunks:
            if not c:
                continue
            m = _LINKEDIN_RE.search(c)
            if m:
                return m.group(0).strip()
    for c in chunks:
        if not c:
            continue
        m = _COMPANY_LINKEDIN_RE.search(c)
        if m:
            return m.group(0).strip()
    return ""


# Narrative-prose field miners. Used when the LLM ditches `**Field:** value`
# rows and embeds the data in sentences instead — which Llama-3.3-70B in
# particular does almost every run.
_NARR_EMPLOYEES = re.compile(
    r"(?:approximately\s+|around\s+|~|with\s+(?:a\s+team\s+of\s+)?)?"
    r"(\d[\d,]*(?:\s*[-–]\s*\d[\d,]*)?)\s+employees",
    re.IGNORECASE,
)
_NARR_FOUNDED = re.compile(r"founded\s+in\s+(\d{4})", re.IGNORECASE)
_NARR_LOCATION = re.compile(
    # Match "based in City[, Region][, Country]" — greedily for the comma
    # parts so we capture both "Gurgaon, India" and "San Francisco, CA, USA",
    # but stop at clause boundaries (`with`, `and`, `,`-after-the-pair).
    r"(?:based|headquartered|located)\s+in\s+"
    r"([A-Z][A-Za-z .\-]+(?:,\s*[A-Z][A-Za-z .\-]+){0,2})"
    r"(?=[.;\n]|,?\s+(?:with|and)\b)",
    re.IGNORECASE,
)
_NARR_REVENUE = re.compile(
    r"(?:annual\s+)?revenue\s+of\s+(?:approximately\s+|around\s+)?"
    r"(\$?\d[\d.,]*\s*(?:[KMB]|million|billion|thousand)?)",
    re.IGNORECASE,
)
_NARR_FUNDING = re.compile(
    r"(?:raised|funding\s+stage|latest\s+funding|series|seed|pre[-\s]?seed)\s*[:\-]?\s*"
    r"([A-Z][A-Za-z0-9\- /]+|\$?\d[\d.,]*\s*(?:[KMB]|million|billion))",
    re.IGNORECASE,
)
_NARR_INDUSTRY = re.compile(
    r"(?:in|specializ\w+\s+in|industry[:\s]+)\s*"
    r"(information technology[\w &/]*|software\s+(?:engineering|development)|"
    r"saas|fintech|healthtech|biotech|ai/ml|machine learning|cybersecurity|"
    r"e[-\s]?commerce|edtech|cloud computing|consulting)",
    re.IGNORECASE,
)


def _mine(pattern: re.Pattern[str], text: str, *, group: int = 1) -> str:
    m = pattern.search(text)
    return m.group(group).strip().rstrip(".,;") if m else ""


def _narrative_role(text: str) -> tuple[str, str, str]:
    """Try to mine ``(name, title, company)`` out of a sentence like
    "Gautam Singh is the VP of Sales at BigStep Technologies".
    Returns ``("", "", "")`` if nothing convincingly matches.
    """
    m = _NARRATIVE_ROLE_RE.search(text)
    if not m:
        return "", "", ""
    name, title, company = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
    # Filter out obvious false positives (e.g. "BigStep is a company that").
    if any(stop in title.lower() for stop in ("company", "platform", "subsidiary", "service")):
        return "", "", ""
    return name, title, company


# ---------------------------------------------------------------------------
# Prospect Research Agent
# ---------------------------------------------------------------------------
# Output format declared in DEFAULT_SYSTEM_PROMPT of prospect_research_agent.py:
#   ## Prospect Brief: [Full Name]
#   ### 1. Role Context (Name / Email / LinkedIn / Title / Location / KPIs)
#   ### 2. Company Overview (Name / Website / Industry / Employees / Funding / Description)
#   ### 3. Pain Points & Challenges
#   ### 4. Recent Activity & Signals
#   ### 5. Conversation Starters (Top 5)
#   ### 6. Sources & Confidence


def parse_prospect_research(text: str) -> ExtractedRun:
    role_section = _section(text, "Role Context")
    company_section = _section(text, "Company Overview")

    # Strict labelled-field extraction first (matches the prompt format).
    name = _line(text, r"##\s+Prospect Brief:\s*(.+)") or _line(text, r"\*\*Name:\*\*\s*(.+)")
    title = _line(role_section or text, r"\*\*Title:\*\*\s*(.+)")
    company = _line(company_section, r"\*\*Company:\*\*\s*(.+)")

    # Narrative fallback: when the LLM ditches labelled fields and writes
    # "Gautam Singh is the VP of Sales at BigStep Technologies" instead.
    if not (name and title and company):
        nname, ntitle, ncompany = _narrative_role(role_section or text)
        name = name or nname
        title = title or ntitle
        company = company or ncompany

    email = (
        _line(role_section or text, r"\*\*Email:\*\*\s*(.+)")
        or _email_in(role_section, text)
    )
    linkedin = (
        _line(role_section or text, r"\*\*LinkedIn:\*\*\s*(.+)")
        # Personal LinkedIn first; fall back to company LinkedIn so the cell
        # isn't empty when only Apollo's company URL was returned.
        or _linkedin_in(role_section, text, prefer_personal=True)
    )
    location = (
        _line(role_section or text, r"\*\*Location:\*\*\s*(.+)")
        or _mine(_NARR_LOCATION, company_section or text)
    )

    industry = (
        _line(company_section or text, r"\*\*Industry:\*\*\s*(.+)")
        or _mine(_NARR_INDUSTRY, company_section or text)
    )
    employees = (
        _line(company_section or text, r"\*\*Employees:\*\*\s*(.+)")
        or _mine(_NARR_EMPLOYEES, company_section or text)
    )
    revenue = (
        _line(company_section or text, r"\*\*(?:Annual\s+)?Revenue:\*\*\s*(.+)")
        or _mine(_NARR_REVENUE, company_section or text)
    )
    funding = (
        _line(company_section or text, r"\*\*(?:Latest\s+)?Funding(?:\s+Stage)?:\*\*\s*(.+)")
        or _mine(_NARR_FUNDING, company_section or text)
    )
    # If we still have nothing for Funding but did extract a founded year,
    # surface that as "Founded 2008" so the cell is informative without
    # masquerading as actual funding data.
    if not funding:
        founded = _mine(_NARR_FOUNDED, company_section or text)
        if founded:
            funding = f"Founded {founded}"

    pains = _bullets(_section(text, "Pain Points"))[:5]
    if not pains:
        # Some prompts call it "Pain Points & Challenges".
        pains = _bullets(_section(text, "Pain Points & Challenges"))[:5]
    # Filter out lead-in sentences ("…may face challenges such as:") that aren't
    # the actual pain — keep only items that don't end in a colon/contain
    # "such as" / "include" so the table cell shows a real challenge.
    pains = [p for p in pains if not p.rstrip().endswith(":") and " such as" not in p.lower() and " include " not in p.lower()] or pains
    activity = _bullets(_section(text, "Recent Activity"))[:5]
    if not activity:
        activity = _bullets(_section(text, "Recent Activity & Signals"))[:5]
    starters = _bullets(_section(text, "Conversation Starters"))[:5]

    title_label = " — ".join(p for p in (name or "Prospect", company) if p) or "Prospect Brief"

    return ExtractedRun(
        title=title_label,
        template="Prospect Research",
        columns={
            "Name": name,
            "Title": title,
            "Email": email,
            "LinkedIn": linkedin,
            "Company": company,
            "Industry": industry,
            "Employees": employees,
            "Revenue": revenue,
            "Funding": funding,
            "Location": location,
            "Top Pain Point": pains[0] if pains else "",
            "Recent Signal": activity[0] if activity else "",
        },
        sections={
            "Pain Points": "\n".join(f"- {p}" for p in pains),
            "Recent Activity": "\n".join(f"- {a}" for a in activity),
            "Conversation Starters": "\n".join(f"- {s}" for s in starters),
            "Full Brief": text.strip(),
        },
    )


# ---------------------------------------------------------------------------
# ICP Scoring Agent
# ---------------------------------------------------------------------------
# Output format from icp_scoring_agent.py:
#   ## Lead: [Person] at [Company]
#   ### Scorecard | table with TOTAL line
#   ### Verdict: [HOT/WARM/MODERATE/COLD]
#   ### Key Match Factors / Mismatch Flags / Intent Signals Detected


_ICP_LEAD_SPLIT = re.compile(r"\n?---\n##\s+Lead:")


def parse_icp_scoring(text: str) -> list[ExtractedRun]:
    blocks = _ICP_LEAD_SPLIT.split(text)
    runs: list[ExtractedRun] = []
    for i, block in enumerate(blocks):
        if i == 0 and "## Lead:" not in block:
            continue
        if i == 0:
            block = block.split("## Lead:", 1)[1]
        head = block.split("\n", 1)[0].strip()
        person, _, company = head.partition(" at ")
        person = person.strip()
        company = company.strip()

        total_match = re.search(r"\|\s*\*?\*?TOTAL\*?\*?\s*\|\s*\*?\*?(\d+)\s*/\s*100", block)
        total = int(total_match.group(1)) if total_match else None

        verdict = _line(block, r"###\s*Verdict:\s*\[?([A-Z]+)\]?")

        company_fit = _line(block, r"\|\s*Company Fit\s*\|\s*(\d+)\s*/\s*40")
        buyer_fit = _line(block, r"\|\s*Buyer Fit\s*\|\s*(\d+)\s*/\s*25")
        techno = _line(block, r"\|\s*Technographics\s*\|\s*(\d+)\s*/\s*15")
        intent = _line(block, r"\|\s*Intent Signals\s*\|\s*(\d+)\s*/\s*20")

        match_factors = _bullets(_section(block, "Key Match Factors"))[:5]
        mismatches = _bullets(_section(block, "Mismatch Flags"))[:5]
        signals = _bullets(_section(block, "Intent Signals Detected"))[:5]

        runs.append(
            ExtractedRun(
                title=f"{person} — {company}" if company else person or "Lead",
                template="ICP Scoring",
                columns={
                    "Lead": person,
                    "Company": company,
                    "Score": total,
                    "Verdict": verdict,
                    "Company Fit": f"{company_fit}/40" if company_fit else "",
                    "Buyer Fit": f"{buyer_fit}/25" if buyer_fit else "",
                    "Tech": f"{techno}/15" if techno else "",
                    "Intent": f"{intent}/20" if intent else "",
                },
                sections={
                    "Match Factors": "\n".join(f"- {m}" for m in match_factors),
                    "Mismatches": "\n".join(f"- {m}" for m in mismatches),
                    "Signals": "\n".join(f"- {s}" for s in signals),
                    "Full Scorecard": block.strip(),
                },
            )
        )
    return runs


# ---------------------------------------------------------------------------
# Hyper-Personalisation Agent
# ---------------------------------------------------------------------------
# Output format from hyper_personalisation_agent.py:
#   ### Email for [Prospect Name]
#   **To:** ... **Email Verified:** ... **Subject:** ...
#   [email body]
#   **Research Evidence Used:** ...


_EMAIL_BLOCK_SPLIT = re.compile(r"\n?---\n###\s+Email for")


def parse_hyper_personalisation(text: str) -> list[ExtractedRun]:
    blocks = _EMAIL_BLOCK_SPLIT.split(text)
    runs: list[ExtractedRun] = []
    for i, block in enumerate(blocks):
        if i == 0 and "### Email for" not in block:
            continue
        if i == 0:
            block = block.split("### Email for", 1)[1]
        # First line is the prospect name.
        first_nl = block.find("\n")
        name = block[:first_nl].strip() if first_nl > 0 else "Prospect"

        to_addr = _line(block, r"\*\*To:\*\*\s*(.+)")
        verified = _line(block, r"\*\*Email Verified:\*\*\s*(.+)")
        subject = _line(block, r"\*\*Subject:\*\*\s*(.+)")

        # Body sits between Subject line and "**Research Evidence Used:**"
        body_match = re.search(
            r"\*\*Subject:\*\*[^\n]*\n+([\s\S]*?)(?:\n\*\*Research Evidence Used:\*\*|\Z)",
            block,
        )
        body = body_match.group(1).strip() if body_match else ""
        evidence = _bullets(
            _line(block, r"\*\*Research Evidence Used:\*\*\s*\n([\s\S]*?)(?:\n---|\Z)")
        )

        runs.append(
            ExtractedRun(
                title=name,
                template="Hyper-Personalisation",
                columns={
                    "Prospect": name,
                    "To": to_addr,
                    "Verified": verified,
                    "Subject": subject,
                    "Word Count": len(body.split()),
                },
                sections={
                    "Email Body": body,
                    "Evidence": "\n".join(f"- {e}" for e in evidence),
                },
            )
        )
    return runs


# ---------------------------------------------------------------------------
# Generic fallback
# ---------------------------------------------------------------------------


def parse_generic(text: str) -> ExtractedRun:
    """No template detected — surface a single row with the raw output.

    The first markdown heading (if any) becomes the title; otherwise the
    first non-empty line. Body is shown as a sections blob.
    """
    title = ""
    for line in text.splitlines():
        s = line.strip()
        if not s:
            continue
        # H1/H2 wins over plain text.
        m = re.match(r"#+\s*(.+)", s)
        title = m.group(1) if m else s
        break
    title = title or "Run output"
    if len(title) > 80:
        title = title[:77] + "…"

    return ExtractedRun(
        title=title,
        template="Generic",
        columns={
            "Output preview": (text[:200] + "…") if len(text) > 200 else text,
            "Length (chars)": len(text),
        },
        sections={"Full output": text.strip()},
    )


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------


# Maps the agent component's `name` class attribute (e.g. "ProspectResearchAgent")
# to its parser. Some agents emit one row per call (Prospect Research),
# others emit a list of rows (ICP Scoring grades several leads in one run).
ParserSingle = Callable[[str], ExtractedRun]
ParserMulti = Callable[[str], list[ExtractedRun]]


_BY_AGENT_NAME: dict[str, ParserSingle | ParserMulti] = {
    "ProspectResearchAgent": parse_prospect_research,
    "ICPScoringAgent": parse_icp_scoring,
    "HyperPersonalisationAgent": parse_hyper_personalisation,
}

# Same dispatch keyed by display name / template name (whichever the flow
# carries — different paths use different metadata).
_BY_TEMPLATE_NAME: dict[str, ParserSingle | ParserMulti] = {
    "Prospect Research Agent": parse_prospect_research,
    "ICP Scoring Agent": parse_icp_scoring,
    "Hyper-Personalisation Agent": parse_hyper_personalisation,
}


def _detect_agent_in_flow(flow_data: dict | None) -> str | None:
    """Find the primary agent component's `name` in a flow's saved data.

    Walks `flow.data.nodes`, returns the first node whose `data.type` matches
    a registered agent. None if no curated agent is in the flow.
    """
    if not flow_data:
        return None
    for node in flow_data.get("nodes") or []:
        nd = (node or {}).get("data") or {}
        ntype = nd.get("type") or ""
        if ntype in _BY_AGENT_NAME:
            return ntype
    return None


def extract_for_flow(
    flow_name: str | None,
    flow_data: dict | None,
    output_text: str,
) -> list[ExtractedRun]:
    """Parse `output_text` for the flow and return one or more rows.

    Resolution order:
        1. Match by agent class name in flow.data.nodes (most reliable).
        2. Match by flow.name against template-name registry.
        3. Generic fallback.
    """
    if not output_text:
        return []

    parser = None
    detected = _detect_agent_in_flow(flow_data)
    if detected:
        parser = _BY_AGENT_NAME.get(detected)
    if parser is None and flow_name:
        parser = _BY_TEMPLATE_NAME.get(flow_name.strip())

    if parser is None:
        return [parse_generic(output_text)]

    result = parser(output_text)
    if isinstance(result, ExtractedRun):
        return [result]
    return list(result)
