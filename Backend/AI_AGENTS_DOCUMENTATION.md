# AI Agents Documentation

This document outlines the architecture, pipeline, input/output structures, and working logic for the 4 core AI Agents implemented in `aiAgentController.js`.

---

## 1. Agentic Search Agent (`searchProspects`)
**Goal**: Find high-quality B2B prospects based on natural language queries, filtering for specific signals (e.g., "Hiring", "Funded").

### 🔹 Input
- **JSON Body**: `{ "query": "Find B2B SaaS companies in India" }`

### 🔹 Pipeline (7 Layers)
1.  **Normalization & Mode Detection**:
    -   Classifies query into `STRICT` (e.g., "actively hiring"), `FILTERED` (e.g., "remote"), or `DISCOVERY` (default).
    -   Removes noise words ("find", "list") to get the raw `topic`.
2.  **Tiered Discovery Search** (Serper API):
    -   Executes 3 parallel sub-queries to ensure variety:
        1.  **Leaders**: "top market leader [topic] companies"
        2.  **Mid-Sized**: "fast growing mid-sized [topic] companies"
        3.  **Startups**: "new innovative [topic] startups 2024 2025"
3.  **Deduplication & Filtering**:
    -   Merges results, deduplicates by domain.
    -   **Blocklist**: Removes aggregators (LinkedIn, Clutch, Glassdoor) to find *actual* company sites.
    -   **Listicle Filter**: Skips "Top 10" style pages in non-strict modes.
4.  **Deep Evidence Collection** (Concurrent):
    -   For each candidate, runs parallel deep searches (`site:domain.com ...`) for:
        -   **Signals**: "hiring", "product launch", "funding".
        -   **Contacts**: "email", "teams", "leadership".
    -   Uses `mapWithConcurrency` to process batches (limit 5 concurrent) without hitting rate limits.
5.  **AI Interpretation** (Gemini Batch):
    -   Feeds raw evidence to Gemini 2.5 Flash.
    -   **Strict Rules**:
        -   No hallucination (explicit "Not found" for missing data).
        -   Classifies hiring ("Active", "Moderate", "Not detected").
    -   Parses response into strict JSON.
6.  **Constraint Enforcement**:
    -   **Strict Mode**: Drops companies with no hiring/funding evidence.
    -   **Filtered Mode**: Sorts best matches to the top.
7.  **Output**: Returns enriched, sorted list.

### 🔹 Output Structure
```json
[
  {
    "companyName": "TechCorp",
    "score": 95,
    "signals": {
      "hiring": "Active",
      "momentum": "Positive",
      "evidence": [{ "summary": "Hiring 5 engineers", "sourceUrl": "..." }]
    },
    "contacts": [{ "name": "Jane Doe", "email": "jane@techcorp.com" }]
  }
]
```

---

## 2. Lookalike Agent (`findLookalikes`)
**Goal**: Find competitors or similar companies to a given seed company.

### 🔹 Input
- **JSON Body**: `{ "sourceCompany": "Stripe" }`

### 🔹 Pipeline
1.  **Prompt Engineering**:
    -   Constructs a request for Gemini to act as a "Market Research AI".
    -   Asks for lookalikes based on: **Patents/Tech, R&D Focus, Market Sentiment**.
2.  **AI Generation**:
    -   Gemini generates a list of 5 similar companies with similarity scores and matching factors.
3.  **Parsing**: extract JSON from Markdown code blocks.

### 🔹 Output Structure
```json
[
  {
    "companyName": "Adyen",
    "similarityScore": 92,
    "matchingFactors": ["Payment Infrastructure", "API-first"],
    "revenue": "Est. $1B+"
  }
]
```

---

## 3. Research Agent (`researchCompany`)
**Goal**: Perform deep strategic analysis of a specific company using live web data.

### 🔹 Input
- **JSON Body**: `{ "companyName": "Vercel", "depth": "quick" | "standard" | "deep" }`

### 🔹 Pipeline
1.  **Live Info Gathering (Tavily)**:
    -   Searches for "detailed strategic analysis, recent news" via Tavily API.
    -   Aggregates content sources to form `researchContext`.
2.  **Model Selection**:
    -   **Quick**: `sonar-pro` (Perplexity) - High level 30s brief.
    -   **Standard**: `sonar-reasoning-pro` - Balanced report.
    -   **Deep**: `sonar-deep-research` - Exhaustive due diligence.
3.  **Schema Enforcement**:
    -   Injects a strict JSON schema specific to the selected depth (e.g., `Deep` includes "businessDurability", "longTermOutlook").
4.  **Perplexity Execution**:
    -   Calls Perplexity API with the context and schema.
5.  **Fallback & Repair**:
    -   If Perplexity returns malformed JSON, a **Gemini Fallback** agent repairs the format into valid JSON.

### 🔹 Output Structure (Deep Example)
```json
{
  "executiveSummary": "...",
  "businessModel": { "revenueStreams": ["..."] },
  "competitiveLandscape": { "directCompetitors": ["Netlify"] },
  "risksAndChallenges": ["Market saturation..."]
}
```

---

## 4. Predictive Agent (`scoreLeads`)
**Goal**: Estimate revenue and score leads for private companies using fragmentary public signals.

### 🔹 Input
- **JSON Body**: `{ "company": { "name": "OpenAI", "country": "US" } }`

### 🔹 Pipeline
1.  **Wikipedia Signal Extraction**:
    -   Checks Wikipedia for "scale signals" (employees, revenue keywords, global presence).
    -   Extracts metadata: `wikiLength`, `hasGlobalSignals`, `founded`.
2.  **SEC EDGAR Verification (US Only)**:
    -   Checks explicit SEC Ticker list.
    -   If public, retrieves **exact reported revenue** from latest 10-K filing using XBRL facts.
3.  **Unified Predictive Prompt**:
    -   Feeds Wiki signals + SEC data to Gemini.
    -   **Rules**:
        -   If SEC data exists -> Use `reported` value (Ground Truth).
        -   If Private -> Estimate `conservative range` based on Wiki scale signals (e.g., "Large wiki + global = Enterprise").
    -   Estimates `travelSpend` and `saasSpend` propensity.

### 🔹 Output Structure
```json
{
  "predictiveSummary": {
    "companyScale": "Enterprise",
    "revenue": {
      "type": "reported",
      "value": "$2.00B",
      "source": "SEC EDGAR"
    },
    "travelSpend": "High",
    "intentSignal": "High",
    "confidence": 95
  }
}
```
