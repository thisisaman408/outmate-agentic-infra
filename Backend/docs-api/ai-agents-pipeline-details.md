# AI Agents: Pipeline Details & Improvement Strategy

This document details the current implementation of the Outmate AI Agents and outlines how to upgrade them for real-time, production-grade performance.

---

## 1. Agentic Search

### Current Implementation
*   **Goal**: Translate natural language queries into a list of B2B prospects.
*   **Input**: `query` (String, e.g., "SaaS companies in Austin")
*   **Model**: Google `gemini-1.5-flash`
*   **Pipeline**:
    1.  **Receive**: User sends query to `/api/agents/search`.
    2.  **Prompt**: Backend wraps query in a system prompt: *"You are an expert sales prospector... Return 4 companies..."*
    3.  **Generate**: Gemini uses its internal training data to hallucinate/recall companies that match.
    4.  **Parse**: JSON is extracted and sent to Frontend.

### ⚠️ Limitation
*   **Stale Data**: Gemini's knowledge is cut off at its training date. It cannot find a startup found *yesterday*.
*   **Hallucination**: It might invent a company if it doesn't know enough real ones.

### 🚀 How to Improve (Real-Time)
To get live results, you must replace "Generation" with "Search + Summarization":
1.  **Integrate Google Search API (SerpApi)**:
    *   *Action*: Backend calls Google Search with the user's query.
    *   *Result*: Gets Top 10 real URLs and snippets.
2.  **LLM Filtering**:
    *   *Action*: Pass those 10 Search Results to Gemini.
    *   *Prompt*: "Analyze these search results and format them into the JSON structure."
3.  **Benefit**: 100% Real companies, valid URLs, current existence.

---

## 2. Research Agent

### Current Implementation
*   **Goal**: Deep dive analysis of a specific company.
*   **Input**: `companyName` (String)
*   **Model**: Google `gemini-1.5-flash`
*   **Pipeline**:
    1.  **Receive**: Company Name.
    2.  **Prompt**: *"Act as a corporate researcher. Tell me about [Company]. Details: Risks, Opportunities..."*
    3.  **Generate**: LLM writes a report based on what it "read" during training.

### 🚀 How to Improve (Real-Time)
You need live web access to see *today's* news or *yesterday's* earnings call.
1.  **Perplexity API** (Recommended):
    *   Perplexity is an "Answer Engine". It searches the web and cites sources automatically.
    *   *Input*: "Research Tesla's latest Q3 reports." -> *Perplexity* -> *Output*.
2.  **Firecrawl / Browse.ai**:
    *   Tools that "scrape" a specific website (e.g., `tesla.com/investors`).
    *   Feed the scraped text into Gemini context window to summarize.

---

## 3. Lookalike Agent

### Current Implementation (Advanced)
*   **Goal**: Find companies similar to a source.
*   **Input**: `sourceCompany` (String)
*   **Model**: Google `gemini-1.5-flash`
*   **Pipeline**:
    1.  **Receive**: Source Company Name.
    2.  **Prompt**: *"Find 3 companies similar to [Source] based on Patents, R&D, and Markets."*
    3.  **Generate**: Gemini uses semantic association to guess competitors.

### 🚀 How to Improve (Real-Time & Private Data)
For production, you need to match against a *real database* of millions of companies.
1.  **Vector Database (Pinecone / pgvector)**:
    *   **Ingest**: Buy a dataset (e.g., Crunchbase/Apollo) of 1M companies.
    *   **Embed**: Convert every company description into a "Vector" (list of numbers) using `gemini-embedding` model.
    *   **Search**: When user asks for "Like Tesla", convert "Tesla" to vector and find "Nearest Neighbors" mathematically.
2.  **Benefit**: Finds deep, non-obvious matches based on description semantics, not just LLM guessing.

---

## 4. Predictive Agent

### Current Implementation (Advanced)
*   **Goal**: Forecast revenue and spending.
*   **Input**: `companyData` (Object: Industry, Local, Headcount)
*   **Model**: Google `gemini-1.5-flash`
*   **Pipeline**:
    1.  **Receive**: Data points.
    2.  **Prompt**: *"Act as Financial Analyst. Estimate travel spend for [Industry] company with [X] employees..."*
    3.  **Generate**: Gemini applies "heuristic reasoning" (logic) to produce an estimate.

### 🚀 How to Improve (Real-Time)
1.  **Enrichment APIs (Clearbit / Apollo)**:
    *   Don't ask the user for "Headcount". Ask for "Domain".
    *   Call Clearbit API -> Get exact employee count, funding raised, and tech stack *right now*.
2.  **Custom Model Training**:
    *   If you have historical data (e.g., "We know Company X spent $50k"), verify the LLM's logic against this ground truth.
    *   Fine-tune the prompt or use a Regression Model (Scikit-Learn) for pure numerical prediction.

---

## Summary of Upgrades
| Feature | Current Dependecy | Upgrade Path |
| :--- | :--- | :--- |
| **Search** | LLM Memory | **SerpApi / Google Custom Search** |
| **Research** | LLM Memory | **Perplexity API / Firecrawl** |
| **Lookalike** | LLM Association | **Vector DB (Pinecone/pgvector)** |
| **Predictive**| LLM Heuristics | **Enrichment (Clearbit) + Historical Data** |
