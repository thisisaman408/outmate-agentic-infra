# AI Agents API Documentation

## Overview
This document outlines the backend API endpoints required to support the AI Agents feature in the Outmate dashboard. These endpoints replace the mock implementations found in `lib/api/ai-agents.ts`.

**Base URL:** `/api/agents` (Recommended)

---

## 1. Agentic Search
**Endpoint:** `POST /search`  
**Description:** Search for prospects based on a natural language query.

### Request Body
```json
{
  "query": "string" // e.g., "Find B2B SaaS companies with 100-500 employees"
}
```

### Response Body
Returns an array of `AgenticSearchResult` objects.

```json
[
  {
    "id": "string",
    "companyName": "string",
    "score": 95, // 0-100 Relevance Score
    "reason": "string", // Explanation of why this result matches the query
    "industry": "string",
    "employees": "string",
    "location": "string",
    "contactName": "string",
    "title": "string",
    "email": "string"
  }
]
```

---

## 2. Lookalike Agent
**Endpoint:** `POST /lookalike`  
**Description:** Find similar companies based on a list of seed company IDs (e.g., your best customers).

### Request Body
```json
{
  "seedCompanyIds": ["string"] // Array of Company IDs used as the baseline
}
```

### Response Body
Returns an array of `LookalikeResult` objects.

```json
[
  {
    "id": "string",
    "companyName": "string",
    "similarityScore": 94, // 0-100 Similarity Score
    "matchingFactors": ["string"], // e.g., ["Industry", "Company Size", "Tech Stack"]
    "industry": "string",
    "employees": "string",
    "location": "string",
    "revenue": "string" // Optional field
  }
]
```

---

## 3. Research Agent
**Endpoint:** `POST /research`  
**Description:** Get comprehensive insights about a specific company. The `depth` parameter controls the thoroughness and time taken for the research.

### Request Body
```json
{
  "companyName": "string",
  "depth": "quick" | "standard" | "deep"
}
```

### Response Body
Returns a single `ResearchResult` object.

```json
{
  "companyName": "string",
  "summary": "string", // High-level company overview
  "marketPosition": "string",
  "keyInsights": ["string"], // List of key findings
  "opportunities": ["string"], // List of potential sales opportunities
  "risks": ["string"], // List of potential risks
  "competitors": ["string"], // List of competitor names
  "recentNews": ["string"] // List of recent news headlines
}
```

---

## 4. Predictive Agent
**Endpoint:** `POST /score-leads`  
**Description:** Predict conversion likelihood for a list of leads using historical data.

### Request Body
```json
{
  "leadIds": ["string"] // Array of Lead/Company IDs to score
}
```

### Response Body
Returns an array of `PredictiveScore` objects.

```json
[
  {
    "companyId": "string",
    "companyName": "string",
    "conversionLikelihood": 87, // 0-100 Score
    "confidence": 92, // 0-100 Model Confidence
    "reasons": [
      {
        "factor": "string", // e.g., "Recent funding"
        "impact": "positive" | "negative" | "neutral",
        "weight": 25 // Numeric weight of this factor
      }
    ],
    "recommendation": "string" // AI generated action item
  }
]
```

---

## Database Integration (PostgreSQL)

To implement these APIs with PostgreSQL, consider the following schema recommendations:

1.  **Agentic Search**:
    *   Use `pgvector` for semantic search on company descriptions and attributes.
    *   Store company profiles in a `companies` table.

2.  **Lookalike**:
    *   Query the `companies` table using filters derived from the seed companies (e.g., matching industry, employee count range).
    *   Compute a similarity score based on overlapping attributes.

3.  **Research**:
    *   If researching *internal* data, query `companies`, `notes`, and `activities` tables.
    *   For external data, you may need to integrate with a provider (e.g., LinkedIn API, Clearbit, OpenAI) and cache results in a `company_research` table to avoid re-fetching.

4.  **Predictive**:
    *   Analyze the `leads` table.
    *   Look at historical `deals` (won vs lost) to train a simple logistic regression or scoring model.
    *   Factors might include: `source`, `industry`, `time_to_response`, etc.
