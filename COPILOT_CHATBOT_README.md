# Global Copilot Chatbot — Product Assistant

A RAG-powered conversational AI assistant available from any page in Outmate. It answers questions about the platform's features, guides users to the right tools, and provides contextual help based on the current page — all without consuming credits.

---

## Features

### RAG-Powered Knowledge Base
- Indexed from `outmate_feature_documnetation` (30+ features), `COPILOT_README.md`, and `AI_AGENTS_DOCUMENTATION.md`
- Hybrid search: **pgvector** cosine similarity + PostgreSQL **TSVECTOR** full-text search
- Chunking strategy: H1/H2 header splits, sub-chunks > 2000 chars with parent context prefix (`[H1 > H2]`)
- 6 most relevant snippets injected into each LLM prompt

### SSE Streaming
- Token-by-token streaming via Server-Sent Events (`text/event-stream`)
- Event types: `token` (incremental text), `done` (final parsed JSON), `error`
- Frontend parses partial JSON in real-time using `stripJSONWrapper()` for smooth display

### Feature Registry Integration
- 19 platform routes loaded from `feature-registry.json` into every LLM prompt
- Ensures the assistant only recommends valid navigation links
- Post-generation **link validation** drops any hallucinated URLs not in the registry

### Route-Based Contextual Suggestions
- `ROUTE_SUGGESTIONS` map covers 16 route prefixes
- Shows clickable question chips based on the user's current page
- Example: on `/campaigns`, suggests "How do I improve my email open rates?"

### Chat History
- Full CRUD persistence: create, resume, delete sessions
- Auto-saves after each assistant response (debounced 1s)
- Session list with message counts and timestamps
- "New Chat" to start fresh, or resume any previous conversation

### Markdown Rendering
- Assistant messages rendered with `react-markdown`
- Custom component mapping: headings, bold, lists, code blocks, links, blockquotes
- User messages displayed as plain text

### Credit-Free
- No credits charged for product assistant queries
- Designed for product education — removing friction increases adoption

---

## Architecture

### Backend Pipeline

```
User Question
    ↓
RAG Retrieval (KnowledgeService.search)
    → pgvector cosine similarity + tsvector full-text
    → Top 6 snippets
    ↓
Prompt Assembly (_build_user_prompt)
    → Question + current route
    → Feature registry (19 routes)
    → RAG documentation snippets
    ↓
LLM Call (OpenRouter)
    → System prompt: 8 rules (grounding, valid links, no vendor names, scope, formatting)
    → Structured JSON output: { answer, related_links, feature_tags }
    ↓
Post-Processing (_validate_links)
    → Drop links not matching feature registry routes
    → Fallback to /dashboard if all links invalid
    ↓
Response (JSON or SSE stream)
```

### System Prompt Rules
1. **Grounding** — only answer from provided documentation snippets
2. **Valid Links** — only use routes from the feature registry
3. **No Vendor Reveal** — never mention OpenRouter, Tavily, Explorium, Serper, etc. (12 vendors listed)
4. **Stay in Scope** — refuse off-topic questions politely
5. **Small Talk** — handle greetings briefly, redirect to features
6. **Context Awareness** — use current route to tailor answers
7. **Formatting** — use markdown (bold, bullets, headers) for readability
8. **Related Features** — suggest 1-3 related features with valid links

### Knowledge Base Storage

| Table | Description |
|-------|-------------|
| `copilot_knowledge_chunks` | Indexed documentation chunks with pgvector embeddings and tsvector search |
| `copilot_chat_sessions` | Chat session persistence (user_id, title, messages JSONB, timestamps) |

### Files

```
Backend/
├── app/services/copilot/
│   ├── product_assistant_service.py   # RAG pipeline, feature registry, link validation
│   ├── knowledge_service.py           # Hybrid search (pgvector + tsvector), indexing, chunking
│   └── prompts.py                     # PRODUCT_ASSISTANT_SYSTEM_PROMPT
├── app/api/routes/copilot.py          # Endpoints (product-assistant, chat-history)
├── app/db/models/
│   ├── product_knowledge.py           # Knowledge chunk model (embeddings + tsvector)
│   └── copilot_chat_session.py        # Chat session model (JSONB messages)
├── app/schemas/copilot.py             # ProductAssistantRequest/Response, ChatMessage schemas
└── scripts/index_product_docs.py      # Knowledge base indexing script

Frontend/
├── components/copilot/
│   └── global-copilot-panel.tsx       # Sheet panel UI (welcome state, messages, history, suggestions)
├── hooks/use-chatbot.ts               # SSE streaming, JSON parsing, session CRUD, auto-save
└── feature-registry.json              # 19 platform routes (loaded by backend + frontend)
```

---

## API Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`).

No credits are charged for any of these endpoints.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/copilot/product-assistant` | Ask a question (JSON response) |
| `POST` | `/api/copilot/product-assistant/stream` | Ask a question (SSE streaming) |
| `GET` | `/api/copilot/chat-history` | List all chat sessions for current user |
| `GET` | `/api/copilot/chat-history/{session_id}` | Get a specific session with messages |
| `POST` | `/api/copilot/chat-history` | Create or update a chat session |
| `DELETE` | `/api/copilot/chat-history/{session_id}` | Delete a chat session |

### Request — Product Assistant

```json
POST /api/copilot/product-assistant/stream
{
  "question": "How do pipeline alerts work?",
  "context": {
    "route": "/copilot/pipeline-alerts",
    "feature_hint": null
  }
}
```

### Response — SSE Stream

```
data: {"type": "token", "content": "Pipeline"}
data: {"type": "token", "content": " alerts"}
data: {"type": "token", "content": " monitor"}
...
data: {"type": "done", "result": {"answer": "Pipeline alerts monitor...", "related_links": [{"label": "Pipeline Alerts", "url": "/copilot/pipeline-alerts"}], "feature_tags": ["pipeline_alerts"]}}
```

### Response — JSON (non-streaming)

```json
{
  "answer": "Pipeline alerts monitor your active deals...",
  "related_links": [
    { "label": "Pipeline Alerts", "url": "/copilot/pipeline-alerts" },
    { "label": "Dashboard", "url": "/dashboard" }
  ],
  "feature_tags": ["pipeline_alerts", "dashboard"]
}
```

---

## Knowledge Base Management

### Indexed Documents

| File | Content | Size |
|------|---------|------|
| `outmate_feature_documnetation` | All 30+ platform features (primary knowledge source) | ~51KB |
| `COPILOT_README.md` | Copilot feature documentation | ~8KB |
| `AI_AGENTS_DOCUMENTATION.md` | AI Agents documentation | ~15KB |

### Re-indexing

Run this when documentation files are updated:

```bash
cd Backend
python scripts/index_product_docs.py
```

This will:
1. Read each markdown file
2. Split by H1/H2 headers
3. Sub-split chunks > 2000 chars (with parent header context)
4. Generate embeddings via `sentence-transformers`
5. Store in `copilot_knowledge_chunks` table (replaces existing entries for that file)

### Chunking Strategy

```
Original Document
    ↓
H1/H2 Header Split (MarkdownHeaderTextSplitter)
    → Each feature section becomes a chunk
    ↓
Sub-Split Oversized Chunks (RecursiveCharacterTextSplitter, 2000 chars, 200 overlap)
    → Preserves parent context: "[Signals > Funding Signals]\n..."
    ↓
Embedding Generation + TSVECTOR
    → Stored in PostgreSQL with pgvector extension
```

---

## Frontend Components

### global-copilot-panel.tsx

- **Floating trigger**: Bottom-right button opens a right-side Sheet panel
- **Welcome state**: 3 example questions + route-based contextual suggestions + daily brief quick action
- **Message thread**: User bubbles (right-aligned) + assistant bubbles (left) with ReactMarkdown
- **Typing indicator**: Animated wave bars with pulsing Sparkles icon
- **Related links**: Clickable navigation buttons below assistant messages
- **Chat history**: Session list view with resume, delete, and new chat actions
- **Character counter**: Shows count when input exceeds 800 chars (max 1000)

### use-chatbot.ts

- **SSE parsing**: `stripJSONWrapper()` extracts answer text from partial JSON during streaming
- **Buffer handling**: Properly splits SSE events by `\n\n`, processes remaining buffer after stream ends
- **Fallback parsing**: If no `done` event fires, attempts full JSON parse of accumulated content
- **Session persistence**: `saveChatSession()` auto-called 1s after each response completes
- **Error handling**: HTTP 402 → friendly credit error message; network errors → retry suggestion

### Route Suggestions (16 routes covered)

| Route Prefix | Example Suggestions |
|---|---|
| `/signals` | "What types of signals does Outmate track?" |
| `/campaigns` | "How do I improve my email open rates?" |
| `/leads` | "How do I search for new prospects?" |
| `/copilot/daily-brief` | "What information is in the daily brief?" |
| `/copilot/pipeline-alerts` | "How do pipeline alerts work?" |
| `/ai-agents` | "What AI agents are available?" |
| `/analytics` | "What metrics can I track in analytics?" |
| `/dashboard` | "What can I see on my dashboard?" |
| ... | *(and 8 more)* |

---

## Configuration

No additional environment variables are needed. The chatbot reuses:

| Variable | Used For |
|---|---|
| `OPENROUTER_API_KEY` | LLM calls via OpenRouter |
| `DATABASE_URL` | Knowledge base storage (pgvector) |

### Feature Registry

Located at `feature-registry.json` in the repository root. Contains 19 platform routes. Loaded by:
- **Backend** (`ProductAssistantService._load_feature_registry`) — injected into LLM prompt + used for link validation
- **Frontend** (`ROUTE_SUGGESTIONS` in `global-copilot-panel.tsx`) — drives contextual suggestion chips

To add a new feature route, add an entry to `feature-registry.json`:
```json
{
  "id": "new_feature",
  "name": "New Feature",
  "description": "What it does",
  "route": "/new-feature"
}
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Free (no credits)** | Product education should be frictionless — removing credit cost increases adoption |
| **Never reveals vendors** | Users shouldn't know about OpenRouter, Tavily, Explorium, etc. — the AI is "Outmate's" |
| **Grounded answers only** | Refuses off-topic questions; only answers from indexed documentation to prevent hallucination |
| **Link validation** | LLMs hallucinate URLs — validating against the feature registry ensures every link works |
| **Hybrid search** | pgvector (semantic) + tsvector (keyword) gives better recall than either alone |
| **SSE streaming** | Token-by-token display feels responsive; users don't wait for full generation |
| **Chat history** | Users can resume conversations — important for multi-step feature exploration |
