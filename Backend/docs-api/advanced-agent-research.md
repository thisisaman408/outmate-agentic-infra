# Deep Research: Lookalike & Predictive Agents

This document outlines the advanced implementation logic for the "Lookalike" and "Predictive" agents, addressing your request for handling specific data types (Revenue prediction, Travel spend, etc.) and explaining the frontend capabilities.

## 1. Why are there no inputs in the Frontend?
Currently, the frontend components (`LookalikePanel` and `PredictivePanel`) were built as **"One-Click Demos"**.
- **Lookalike**: It hardcodes `seedCompanies = ["1", "2"]` behind the "Find Similar Companies" button. It assumes the "input" is your *entire existing customer database*.
- **Predictive**: It hardcodes `leadIds = ["1", "2"]` behind the "Score Leads" button. It assumes the "input" is your *entire CRM pipeline*.

**To make this real**, the Frontend needs to be updated to allow:
1.  **Lookalike**: A file uploader (CSV of customers) or a selector to pick "Seed Companies".
2.  **Predictive**: A selector to pick a specific "Lead List" or "Industry Segment" to forecast.

---

## 2. Predictive Agent: Advanced Implementation
**Goal:** Predict revenue, business travel spend, and growth.

### Input Data Needed
To predict "Revenue of Travel Providers" or "Business Travel Spend", the agent needs granular data points about the target.
- **Company Name / Domain**
- **Headcount** (Employee count)
- **Industry** (e.g., Hospitality, SaaS)
- **Location** (Cost of living adjustment)
- **Hiring Signals** (Number of open roles)

### Recommended Logic (Gemini Powered)
We can use a "Reasoning Chain" prompt with Gemini:

**Prompt Structure:**
> "Act as a Financial Analyst. Estimate the annual business travel spend for [Company Name], a [Headcount] person company in [Industry] located in [City].
>
> Use this heuristic:
> 1. Avg spread per employee for this industry is usually $[X].
> 2. Adjust for location (expensive city = +20%).
> 3. Adjust for growth (hiring spree = +15% travel for recruiting/sales).
>
> Return a JSON with:
> - `estimatedSpend`: Number
> - `confidence`: Number
> - `reasoning`: String"

### Output Structure
```json
{
  "companyName": "Acme Corp",
  "predictedRevenue": "$50M - $75M",
  "travelSpendEstimate": "$1.2M",
  "growthForecast": "High (20% YoY)",
  "signals": ["Aggressive Hiring", "New Office Location"]
}
```

---

## 3. Lookalike Agent: Advanced Implementation
**Goal:** Aggregate multi-platform data (Patents, Reviews, Research) to find matches.

### Input Data Needed
- **Seed Profile**: A specific company or a list of attributes describing the "Ideal Customer Profile" (ICP).

### Recommended Logic (Gemini + Research)
Since we don't have a live database of 100M companies, we use Gemini's **Knowledge Retrieval**:

**Prompt Structure:**
> "I need to find 5 companies that are 'Lookalikes' to [Seed Company].
> Focus on these attributes: [Patents, specialized research, market segment].
>
> For each match, explain certain 'Hidden Signals' like:
> - Do they have similar patent filings?
> - Do they hire from the same research labs?
>
> Return a JSON list."

---

## 4. Proposed Backend Update
I will update your `aiAgentController.js` to support these specific "Deep Research" requests.

**New Predictive Endpoint Logic:**
- Accepts `companyName` and `industry`.
- Returns `revenuePrediction` and `travelSpend`.

**New Lookalike Endpoint Logic:**
- Accepts `sourceCompany`.
- Returns `similarCompanies` based on *deep* attributes (patents/research focus) rather than just "industry".
