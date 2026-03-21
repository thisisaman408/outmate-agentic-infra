
## Global Copilot Chatbot PRD
**Project**: Outmate Global Copilot Chatbot  
**Owner**: _(TBD)_  
**Date**: _(TBD)_  

---

### 1. Problem Statement

The bottom‑right Copilot icon in Outmate currently acts mainly as an entrypoint to the **Daily Brief** experience. While useful for sales intelligence, it does not:

- Help users understand **all major features** in Outmate (signals, leads, campaigns, pipeline alerts, copilot tools, etc.).
- Provide a **single conversational surface** to ask “What can I do here?” or “How do I use this feature?” across the app.
- Reduce reliance on docs / support for basic “how to use Outmate” questions.

We want this icon to become a **global product assistant**: a chat-style Copilot that explains Outmate’s features, guides feature discovery, and answers questions about how to use the platform, **without exposing internal data sources/vendors**.

---

### 2. Goals & Non‑Goals

- **G1 – Global Copilot entrypoint**: The bottom-right Copilot icon opens a **chat-based assistant** available from anywhere in Outmate.
- **G2 – Product education & discovery**: Copilot explains what each feature does, how to use it, and where to find it, with deep links into the app.
- **G3 – Natural language Q&A about Outmate**: Users can ask freeform questions about Outmate features (signals, Daily Brief, Lead Copilot, pipeline alerts, campaigns, settings).
- **G4 – Context-aware guidance (MVP)**: Responses use basic context such as current route/page to tailor explanations and suggested questions.
- **G5 – Reuse existing copilot stack**: Leverage the existing copilot backend and frontend patterns (API client/hooks/UI).
- **G6 – No vendor/source reveal**: Copilot must **never name or expose** specific third‑party providers, APIs, or model details; it only describes data at a generic level (e.g. “trusted external data providers”).
- **G7 – Light normal conversation**: Copilot can handle basic small talk and conversational prompts (e.g. “hi”, “thanks”, “how are you”) while gently steering the user back toward Outmate-related help.

**Non‑Goals**

- Not implementing complex **workflow automation** or “do this action for me” flows beyond basic navigation and explanation.
- Not replacing existing specialized UIs (Daily Brief page, Lead Copilot panel, Campaign Optimizer, etc.).
- Not answering general web/internet questions outside of Outmate’s product and supported sales use cases.
- Not providing tenant-specific documentation per tenant (knowledge is global to Outmate, but v1 will already auto-scan our own product surfaces).

---

### 3. Key User Stories

- **US1 – Discover Outmate**: As a new user, I click the Copilot icon and ask “What can I do with Outmate?” so I see an overview of the main modules and where to start.
- **US2 – Understand current page**: On Signals → Events, I ask “What does this page do?” so I understand what it’s for and how to configure it.
- **US3 – Configure Daily Brief**: I ask “How do I configure the daily brief and notifications?” so I can enable/disable and tune timing/preferences.
- **US4 – Compare features**: I ask “What’s the difference between Daily Brief and Pipeline Alerts?” so I know when to use each.
- **US5 – Lead Copilot help**: On a lead profile, I ask “What can the Lead Copilot do for this prospect?” so I know the quick actions and how to use them.
- **US6 – Campaign optimization**: I ask “How do I optimize my campaign emails with Copilot?” so I’m guided to the correct feature and understand outputs.
- **US7 – Credits understanding**: I ask “How do credits work?” so I understand consumption and what happens when I run out.

---

### 4. User Experience

#### 4.1 Entry Point

- **Trigger**: The small Copilot icon in the **bottom-right corner** of the Outmate UI.
- **New behavior**:
  - Click opens a **chat panel** anchored bottom-right (sheet or floating panel).
  - Panel header:
    - Title: **“Outmate Copilot”** (or similar).
    - Subtitle: “Ask about any feature in Outmate or how to use it.”
  - Primary content: chat history.
  - Input: single-line text field with “Enter to send”.

#### 4.2 Daily Brief access

Daily Brief must remain easy to access:

- Provide an explicit button/chip such as **“View today’s Daily Brief”** that:
  - Navigates to the existing Daily Brief screen; or
  - Opens an inline preview (optional future enhancement).

#### 4.3 Chat Interaction

- **Initial assistant message**:
  - A short welcome and example prompts like:
    - “What are signals and how do I use them?”
    - “Explain the Lead Copilot panel.”
    - “How do pipeline alerts work?”

- **Contextual suggestions (MVP)**:
  - Show suggested questions relevant to the current page/route.

- **Assistant responses**:
  - Keep answers concise first; allow deeper detail on demand.
  - Include:
    - Plain-language explanation
    - Step-by-step usage guidance
    - Deep links to relevant screens (e.g. signals, copilot settings, campaign optimizer)

- **No vendor/source reveal**:
  - If user asks “Where does this data come from?” respond generically:
    - “Copilot combines your Outmate data with trusted external business data sources.”
    - “Copilot uses third‑party enrichment providers to keep information current.”
  - Never mention specific provider names, APIs, or model details.

---

### 5. Functional Requirements

#### 5.1 Frontend

- **FR1 – Global Copilot panel component**
  - New `GlobalCopilotPanel` rendered at the app shell level.
  - Responsibilities:
    - Open/close state (tied to bottom-right icon)
    - Render conversation history
    - Input + send (with size limits and validation)
    - Loading / “thinking” indicator

- **FR2 – Conversation state**
  - Message schema:
    - `id`
    - `role: "user" | "assistant"`
    - `content: string`
    - `createdAt: number`
    - Optional: `links?: { label: string; url: string }[]`
  - Persist in memory for session (v1). Optional persistence later.

- **FR3 – API integration**
  - Extend the frontend copilot API client with:
    - `askProductAssistant(question, context) -> { answer, related_links, feature_tags }`
  - On error:
    - Show a friendly assistant message instead of failing silently.
  - Enforce a **maximum input length** (e.g. 500–1,000 characters) on the client:
    - Prevent typing beyond the limit and show a small helper text (“Keep questions under N characters.”).
    - Optionally truncate pasted text with a warning.

- **FR4 – Daily Brief quick entry**
  - Provide “View today’s Daily Brief” quick action inside the panel.

- **FR5 – Analytics hooks (recommended)**
  - Track:
    - Panel opened
    - Question asked (store category/intent rather than full text)
    - Link clicked

#### 5.2 Backend

- **FR6 – Product assistant endpoint**
  - Add: `POST /api/copilot/product-assistant`
  - Request:
    - `question: string`
    - `context?: { route?: string; feature_hint?: string }`
  - Response:
    - `answer: string`
    - `related_links: { label: string; url: string }[]`
    - `feature_tags: string[]`

- **FR7 – Product assistant service**
  - Implement a new service module to:
    - Maintain structured Outmate product knowledge (features + navigation + “how-to” summaries)
    - Build prompts for Q&A
    - Map answers to deep links

- **FR7b – Automatic feature catalog build (v1)**
  - Add a small backend or build-time utility that:
    - Scans known locations for feature surfaces (e.g. `Frontend/app/(dashboard)/**`, `Frontend/components/**`, copilot routes, signals routes).
    - Uses simple heuristics + annotations (e.g. frontmatter comments or config objects) to build/update the **feature registry**:
      - Feature id
      - Human-readable name
      - Route / URL
      - Category (signals, leads, campaigns, copilot, settings, etc.)
    - Stores the registry in a single JSON/YAML file or table that the product assistant service reads at runtime.
  - Editing this registry manually should still be possible, but a one-click/one-command script keeps it in sync with newly added feature pages so v1 can ship quickly without a big manual mapping exercise.

- **FR8 – Prompt constraints (no source reveal)**
  - Prompt must explicitly enforce:
    - Do not name vendors, data sources, APIs, infrastructure, or model names.
    - Use generic wording like “external data providers” when needed.
    - Do not invent features; if unknown, say so and offer navigation alternatives.
    - It is okay to respond to light small talk (e.g. greetings, “thank you”), but longer answers should still try to connect back to how Copilot can help with Outmate.

- **FR10 – Hallucination handling**
  - Backend prompt and logic must:
    - Prefer **“I don’t know / this isn’t available”** over guessing when:
      - A feature is not present in the feature registry, and
      - The question cannot be answered from the curated product description.
    - When unsure, respond with:
      - A short explanation that the feature may not exist or isn’t supported yet.
      - A safe navigation suggestion (e.g. “You can check the main navigation or settings for related options.”).
  - Any returned feature IDs must be validated against the registry before turning into links; unknown IDs are dropped.

- **FR9 – Authentication and rate limits**
  - Require authentication as with existing Copilot endpoints.
  - Optional per-user rate limiting for abuse protection.

---

### 6. Technical Architecture (High-Level)

- **Frontend**
  - Add `GlobalCopilotPanel` in the main layout so it’s available on every page.
  - Bottom-right icon toggles the panel.
  - Requests include current route for context.

- **Backend**
  - Implement a product-assistant service using the same internal LLM gateway used by other copilot services.
  - Product knowledge is primarily static (Outmate feature descriptions + UX flows).
  - No external enrichment is required for v1.

---

### 7. Knowledge Feeding Logic

- **Authoritative sources (v1)**
  - Copilot product chatbot should be fed from:
    - A **generated feature registry** (from FR7b) that lists all major feature pages/routes and their metadata.
    - A **single, curated product description**, assembled from:
      - `COPILOT_README.md` (copilot features)
      - High-level docs/sections describing signals, leads, campaigns, pipeline alerts, settings, etc.
  - These sources are **compiled into prompt content** on the backend and are **not** exposed as raw documents to users.

- **Preprocessing**
  - Product docs are normalized into:
    - A list of **features** with:
      - `id` (e.g. `signals_events_page`, `copilot_daily_brief`)
      - `name`
      - `short_description`
      - `when_to_use`
      - `navigation_path` (e.g. menu + URL)
    - A brief **platform overview**.
  - This structure is passed into the LLM as JSON/text context so answers can:
    - Stay consistent
    - Attach correct navigation links
    - Avoid hallucinating non-existent features

- **Runtime feeding**
  - For each question:
    - Build a prompt with:
      - User question
      - Current route/feature hint
      - The structured feature list + platform overview
      - Explicit “no source/vendor reveal” instructions
  - LLM returns:
    - Natural language answer
    - (Optionally) a small machine-readable section mapping to feature IDs
  - Backend maps feature IDs back to:
    - `related_links`
    - `feature_tags`

- **Updates & maintenance**
  - On product changes:
    - Update the curated product description (the structured feature list + overview).
    - Keep `COPILOT_README.md` and any new feature docs in sync with this structure.
  - No changes are required from end users; once the backend config is updated, the chatbot reflects new features/flows.

---

### 8. UX & Content Guidelines

- **Tone**: Friendly, clear, concise.
- **Answer style**:
  - Short answers first, with optional depth.
  - Always include actionable next steps and links.
- **Privacy/opacity**:
  - Never reveal provider names or internal architecture details.
  - If asked about sources, respond with generic descriptions only.

---

### 9. Success Metrics

- **Adoption**: % of active users opening Copilot chat weekly.
- **Engagement**: average questions per user per week.
- **Support deflection**: fewer “how-to” questions about core features.
- **Qualitative**: onboarding feedback indicates faster feature discovery and a production-quality experience.

---

### 10. Operational & Production Requirements

- **Reliability & performance**
  - Target p95 latency for responses under a reasonable threshold (e.g. 3–5 seconds) for typical product questions.
  - Fail fast on upstream errors and always return a graceful in-product message instead of hard failures.
  - Handle transient errors with limited retries where it is safe to do so.

- **Logging & observability**
  - Log request metadata (timestamps, anonymized intent/category, success/error flags) for monitoring.
  - Avoid logging raw user text where it could conflict with privacy policies; prefer redacted or derived signals.
  - Provide basic dashboards/alerts for:
    - Error rate of `/api/copilot/product-assistant`
    - Latency and timeout rates

- **Security & privacy**
  - Use the existing auth model; only authenticated Outmate users can access the chatbot.
  - Ensure prompts and logs do not expose sensitive customer data beyond what existing copilot features already use.
  - Enforce rate limits to prevent abuse or accidental flooding.

- **UX quality**
  - Loading, empty, and error states must be polished:
    - Clear “thinking” indicator while the model responds.
    - Friendly copy when something goes wrong, with suggested next steps.
    - No significant layout shift or jank when messages stream in.
  - The panel must behave well on common production viewports (laptops, large screens) and not obstruct core workflows.

---

### 11. Open Questions / Future Work

- Should the assistant support simple navigational actions (“Take me to Signals → Events”)?
- Should global chat converge with the Lead Copilot panel into a unified multi-mode Copilot later?
- Should admins be able to add tenant-specific FAQs/playbooks in a later phase?

