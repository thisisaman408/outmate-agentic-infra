# Feature Implementation Code Reference

Quick copy-paste snippets showing actual code patterns used in each feature.

---

## 1. ENRICHMENT - Code Snippets

### BetterContact Service Pattern
```python
# Backend/app/services/bettercontact_service.py (pattern)

class BetterContactService:
    async def enrich_company(
        self,
        company_name: str,
        company_domain: str
    ) -> Dict[str, Any]:
        """
        Enrichment waterfall:
        1. Try BetterContact API
        2. If fails, try ContactOut API
        3. Return first success
        """
        try:
            # Call BetterContact
            result = await self._call_bettercontact(company_name, company_domain)
            if result.get("email"):
                return {"success": True, "email": result["email"]}
        except Exception as e:
            logger.warning(f"BetterContact failed: {e}")
        
        try:
            # Fallback to ContactOut
            result = await self._call_contactout(company_name, company_domain)
            if result.get("email"):
                return {"success": True, "email": result["email"]}
        except Exception as e:
            logger.warning(f"ContactOut failed: {e}")
        
        return {"success": False, "error": "Enrichment failed"}

    async def _call_bettercontact(self, company_name, domain):
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.bettercontact.com/v1/enrich",
                json={
                    "company_name": company_name,
                    "domain": domain
                },
                headers={"Authorization": f"Bearer {BETTERCONTACT_API_KEY}"}
            )
            return resp.json()
```

### Copilot Enrichment Service Pattern
```python
# Backend/app/services/copilot/enrichment.py

async def enrich_company(company_name: str, company_domain: Optional[str] = None) -> Dict[str, Any]:
    """Fetch real company data from Explorium for Copilot."""
    try:
        svc = ExploriumService()
        filters: Dict[str, Any] = {}
        if company_domain:
            filters["domain"] = company_domain
        if company_name:
            filters["name"] = company_name

        # Search Explorium
        result = await svc.search_companies(filters, limit=1)
        companies = result.get("companies", [])
        if not companies:
            return {}

        # Enrich the first result
        company = companies[0]
        enriched = await svc.enrich_company_fully(company)
        if enriched:
            return enriched
        
        return company
    except Exception as exc:
        logger.warning(f"Company enrichment failed: {exc}")
        return {}


def format_company_context(data: Dict[str, Any]) -> str:
    """Format company data for LLM prompt."""
    if not data:
        return ""
    lines = ["=== VERIFIED COMPANY DATA (from Explorium) ==="]
    lines.append(f"Name: {data.get('name')}")
    lines.append(f"Domain: {data.get('domain')}")
    lines.append(f"Industry: {data.get('industry')}")
    lines.append(f"Employees: {data.get('employee_count_range')}")
    lines.append(f"Revenue: {data.get('revenue_range')}")
    lines.append(f"Funding Stage: {data.get('funding_stage')}")
    lines.append(f"Technologies: {', '.join(data.get('technologies', []))}")
    lines.append("=== END COMPANY DATA ===")
    return "\n".join(lines)
```

---

## 2. SIGNALS - Code Snippets

### Signal Creation Pattern
```python
# Backend/app/api/routes/signals.py

@router.post("")
async def create_signal(request: CreateSignalRequest):
    """Create a new signal that auto-runs in background."""
    new_signal = {
        "_id": f"signal-{uuid4().hex[:8]}",
        "name": request.name,
        "type": request.type,
        "category": request.category or "overview",
        "configuration": request.configuration or {},
        "status": request.status or "active",
        "created_at": _now_iso(),
        "last_run_at": None,
        "cursor_state": {},
    }
    SIGNAL_STORE.append(new_signal)
    
    # Fire-and-forget background run
    asyncio.create_task(
        fetcher_run_signal(new_signal, SIGNAL_RESULTS_STORE, SIGNAL_STORE)
    )
    return new_signal
```

### Signal Detection Service
```python
# Backend/app/services/signal_detection_service.py

class SignalDetectionService:
    def __init__(self):
        self.crustdata = CrustdataService()
        self.explorium = ExploriumService()

    async def detect_signals(
        self,
        companies: List[Dict[str, Any]],
        prospect_query: str = "",
        data_source: str | List[str] = "explorium",
        action: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Detect signals using Crustdata/Explorium.
        
        For prospects (crustdata):
        - LinkedIn posts
        - Job changes
        - Stock movements
        
        For companies (explorium):
        - Business challenges
        - Funding events
        - Tech adoption
        """
        if not companies:
            return []
        
        signals = []
        sources = [data_source] if isinstance(data_source, str) else data_source
        
        try:
            if "crustdata" in sources:
                signals = await self._detect_signals_crustdata(companies, prospect_query)
            elif "explorium" in sources:
                signals = await self._detect_signals_explorium(companies, prospect_query, action=action)
        except Exception as e:
            logger.error(f"Signal detection failed: {e}")
        
        return signals
```

---

## 3. WATCHER - Code Snippets

### Watcher Creation Pattern
```python
# Backend/app/api/routes/watchers.py

@router.post("/event")
async def create_event_watcher(request: CreateWatcherRequest, db: Session):
    """Create an event-based watcher."""
    wid = f"w-{uuid4().hex[:8]}"
    logger.info(f">>> [Create Event Watcher] ID: {wid}, Criteria: {request.criteria}")
    
    db_w = WatcherModel(
        id=wid,
        name=request.name,
        description=request.description,
        type="event",
        status="active",
        criteria=request.criteria or {},
        triggers=request.triggers or [],
        notification_settings=request.notificationSettings or {"email": True},
        match_count="0",
        recent_updates=[],
    )
    db.add(db_w)
    db.commit()
    db.refresh(db_w)
    
    return watcher_to_dict(db_w)


@router.post("/account")
async def create_account_watcher(request: Dict[str, Any], db: Session):
    """Create an account watcher for a specific business."""
    wid = f"w-{uuid4().hex[:8]}"
    
    db_w = WatcherModel(
        id=wid,
        name=request.get("name", request.get("accountName", "Account Watcher")),
        description=request.get("description"),
        type="account",
        status="active",
        account_name=request.get("accountName"),
        account_domain=request.get("accountDomain"),
        triggers=request.get("triggers") or [],
        notification_settings=request.get("notificationSettings") or {"email": True},
        match_count="0",
        recent_updates=[],
    )
    db.add(db_w)
    db.commit()
    db.refresh(db_w)
    
    return watcher_to_dict(db_w)
```

### Watcher Sync Pattern - Account
```python
@router.post("/{id}/sync")
async def sync_watcher(id: str, db: Session):
    """Sync watcher with Explorium to fetch latest updates."""
    db_w = db.query(WatcherModel).filter(WatcherModel.id == id).first()
    if not db_w:
        raise HTTPException(status_code=404, detail="Watcher not found")

    svc = ExploriumService()
    w = watcher_to_dict(db_w)

    try:
        if w["type"] == "account":
            # Map trigger names to Explorium events
            _acct_trigger_map = {
                "Funding Events": ["new_funding_round", "new_investment"],
                "Job Changes": ["team_expansion", "team_reduction"],
                "Technology Changes": ["product_launch"],
                "News Mentions": ["merger_and_acquisitions", "ipo_announcement"],
            }
            raw_triggers = db_w.triggers or []

            # Step 1: Match domain to business_id
            bid = db_w.business_id
            if not bid and w.get("accountDomain"):
                try:
                    match_res = await svc.match_businesses([
                        {"domain": w["accountDomain"], "name": w.get("accountName")}
                    ])
                    matched = match_res.get("matched_businesses") or []
                    if matched:
                        bid = matched[0].get("business_id")
                        db_w.business_id = bid
                        logger.info(f"Matched business_id: {bid}")
                except Exception as e:
                    logger.error(f"Business match failed: {e}")

            updates = []
            if bid:
                # Step 2: Enroll business for monitoring
                api_event_types = set()
                for t in raw_triggers:
                    mapped = _acct_trigger_map.get(t, [])
                    api_event_types.update(mapped)
                
                if api_event_types:
                    try:
                        await svc.enroll_business_events([bid], list(api_event_types))
                        logger.info(f"Enrolled {bid} for events")
                    except Exception as e:
                        logger.error(f"Enrollment failed: {e}")

                # Step 3: Fetch business events
                try:
                    events_res = await svc.fetch_business_events([bid], list(api_event_types))
                    events = events_res.get("data", [])
                    
                    # Build updates
                    for ev in events:
                        updates.append({
                            "id": f"ev-{uuid4().hex[:8]}",
                            "type": ev.get("event_type", "event"),
                            "description": ev.get("description", "Event detected"),
                            "date": ev.get("event_date", datetime.now(timezone.utc).isoformat())
                        })
                except Exception as e:
                    logger.error(f"Fetch events failed: {e}")

            # Step 4: Store updates in DB
            db_w.recent_updates = updates
            db_w.match_count = str(len(updates))
            db_w.last_synced_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(db_w)

            # Step 5: Send notifications
            await notify_updates(w, db_w)

        return watcher_to_dict(db_w)

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
```

### Watcher Notification Pattern
```python
async def notify_updates(w: Dict[str, Any], db_w: WatcherModel = None):
    """Send notifications for new watcher updates."""
    settings = (db_w.notification_settings or {}) if db_w else {}
    if not settings.get("email") and not settings.get("slack"):
        return
    
    name = w.get("name", "Watcher")
    update_count = len(w.get("recentUpdates", []))
    
    if settings.get("email"):
        try:
            subject = f"Watcher Alert: {name} found {update_count} new updates"
            body = f"""
Your watcher "{name}" found {update_count} new matches.

Recent Updates:
{json.dumps(w.get('recentUpdates', []), indent=2)}
            """
            # TODO: Send email via EmailService
            logger.info(f"Email notification: {subject}")
        except Exception as e:
            logger.error(f"Email notification failed: {e}")
    
    if settings.get("slack"):
        try:
            webhook_url = settings.get("slackWebhookUrl")
            if webhook_url:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        webhook_url,
                        json={"text": f"Watcher Alert: *{name}* found {update_count} new updates."}
                    )
        except Exception as e:
            logger.error(f"Slack notification failed: {e}")
```

---

## 4. COPILOT - Code Snippets

### Copilot Service Orchestrator
```python
# Backend/app/services/copilot/copilot_service.py

class CopilotService:
    """Central orchestrator for all Co-Pilot features."""
    
    def __init__(self, db: Session):
        self.db = db
        self.daily_brief = DailyBriefService(db)
        self.meeting_prep = MeetingPrepService(db)
        self.campaign_optimizer = CampaignOptimizerService(db)
        self.pipeline_risk = PipelineRiskService(db)
```

### Daily Brief Service Pattern
```python
# Backend/app/services/copilot/daily_brief_service.py (pattern)

class DailyBriefService:
    def __init__(self, db: Session):
        self.db = db
        self.openrouter = OpenRouterService()
        self.redis = RedisManager()

    async def get_or_generate(self, user_id: str) -> tuple[Dict, bool]:
        """Get today's brief, or generate if missing."""
        today = date.today()
        
        # Check DB
        brief = self.db.query(CopilotBrief).filter(
            CopilotBrief.user_id == user_id,
            CopilotBrief.brief_date == today
        ).first()
        
        if brief:
            return brief.content, False  # Already exists
        
        # Generate new
        brief_content = await self.generate(user_id)
        
        # Store in DB
        new_brief = CopilotBrief(
            user_id=user_id,
            brief_date=today,
            brief_type="daily",
            content=brief_content,
            status="generated"
        )
        self.db.add(new_brief)
        self.db.commit()
        
        return brief_content, True  # Just generated

    async def generate(self, user_id: str) -> Dict[str, Any]:
        """Generate a daily brief from scratch."""
        # 1. Fetch user's data: deals, prospects, signals, etc.
        user_data = await self._fetch_user_pipeline(user_id)
        
        # 2. Enrich with market data
        enriched_data = await self._enrich_with_market_intelligence(user_data)
        
        # 3. Call LLM to synthesize
        prompt = f"""
        Generate a daily brief for a sales rep with this data:
        
        {enriched_data}
        
        Include:
        - Executive summary (2-3 sentences)
        - Top 3 deals at risk
        - Key signals detected
        - Action items
        """
        
        response = await self.openrouter.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            system="You are a sales intelligence AI...",
            model="anthropic/claude-3-opus"
        )
        
        return {
            "executive_summary": response.get("summary"),
            "highlights": response.get("highlights", []),
            "deals_at_risk": response.get("deals_at_risk", []),
            "action_items": response.get("action_items", [])
        }
```

### Lead Copilot Action - Streaming
```python
# Backend/app/api/routes/copilot.py

@router.post("/lead-action/stream")
async def execute_lead_action_stream(
    request: LeadActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream an AI lead action with SSE progress events."""
    cost = COPILOT_CREDIT_COSTS.get(f"lead_{request.action_type.value}", 1)
    _check_credits(db, current_user.id, cost)

    async def event_generator():
        service = LeadCopilotService(db)
        credits_deducted = False
        try:
            async for event in service.execute_action_stream(
                user_id=str(current_user.id),
                prospect_id=request.prospect_id,
                action_type=request.action_type.value,
                prompt=request.prompt,
                context_overrides=request.context_overrides,
            ):
                if event.get("stage") == "complete" and not credits_deducted:
                    _deduct(
                        db,
                        current_user.id,
                        cost,
                        f"Copilot: Lead {request.action_type.value}"
                    )
                    credits_deducted = True
                    event["credits_used"] = cost
                    event["action_type"] = request.action_type.value
                
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            logger.error(f"Lead action stream error: {e}")
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
```

### Lead Copilot Service - Action Streaming
```python
# Backend/app/services/copilot/lead_copilot_service.py (pattern)

class LeadCopilotService:
    async def execute_action_stream(
        self,
        user_id: str,
        prospect_id: str,
        action_type: str,
        prompt: str,
        context_overrides: Dict
    ) -> AsyncGenerator[Dict, None]:
        """Execute action and stream output."""
        
        # Stage 1: Enriching
        yield {"stage": "enriching", "message": "Researching lead..."}
        
        # Get lead context
        lead_context = self.get_lead_context(prospect_id)
        enrichment_service = LeadEnrichmentService()
        enriched_data = await enrichment_service.fetch_all(prospect_id)
        
        # Build enriched context
        context_text = self._build_context_prompt(enriched_data)
        
        # Stage 2: Generating
        yield {"stage": "generating", "message": "Generating response..."}
        
        # Get system prompt for action
        system_prompt = self._get_system_prompt(action_type)
        
        # Stage 3: Streaming tokens
        openrouter = OpenRouterService()
        async with openrouter.stream_completion(
            messages=[{"role": "user", "content": prompt or context_text}],
            system=system_prompt,
            model="anthropic/claude-3-opus"
        ) as stream:
            full_response = ""
            async for chunk in stream:
                if chunk:
                    full_response += chunk
                    yield {"stage": "token", "content": chunk}
        
        # Stage 4: Complete
        yield {
            "stage": "complete",
            "result": {
                "action_type": action_type,
                "content": full_response
            }
        }
```

### Product Assistant RAG Pattern
```python
# Backend/app/services/copilot/product_assistant_service.py (pattern)

class ProductAssistantService:
    async def answer(
        self,
        question: str,
        context: Dict[str, Any]
    ) -> AsyncGenerator[Dict, None]:
        """Answer a question using RAG (Retrieval-Augmented Generation)."""
        
        # Step 1: Search knowledge base
        knowledge_service = KnowledgeService()
        relevant_chunks = await knowledge_service.hybrid_search(
            question=question,
            limit=5
        )
        
        # Step 2: Build context
        knowledge_text = "\n".join([
            f"- {chunk['content']}"
            for chunk in relevant_chunks
        ])
        
        # Step 3: Load feature registry
        feature_registry = self._load_feature_registry()
        
        # Step 4: Build system prompt with rules
        system_prompt = f"""
You are the Outmate platform assistant. Answer questions about Outmate.

RULES:
1. Only answer using the provided documentation snippets
2. Never mention vendors (OpenRouter, Tavily, Explorium, etc.)
3. Only suggest features from this registry: {feature_registry}
4. Stay in scope - refuse off-topic questions
5. Provide markdown-formatted answers

KNOWLEDGE BASE:
{knowledge_text}

FEATURE REGISTRY:
{feature_registry}

CURRENT CONTEXT:
Route: {context.get('route', 'unknown')}
"""
        
        # Step 5: Stream response
        openrouter = OpenRouterService()
        async with openrouter.stream_completion(
            messages=[{"role": "user", "content": question}],
            system=system_prompt
        ) as stream:
            full_response = ""
            async for chunk in stream:
                if chunk:
                    full_response += chunk
                    yield {"type": "token", "content": chunk}
            
            # Suggest related features
            related = self._extract_related_features(full_response, feature_registry)
            yield {
                "type": "done",
                "result": {
                    "answer": full_response,
                    "related_links": related,
                    "feature_tags": [f.get("id") for f in related]
                }
            }
```

### Credit Detection Pattern
```python
# Backend/app/api/routes/copilot.py

def _check_credits(db: Session, user_id, cost: int):
    """Raise HTTP 402 if user has insufficient credits."""
    balance = get_user_credits(db, user_id)
    if balance < cost:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail={
                "message": f"Insufficient credits. Cost: {cost}, Balance: {balance}",
                "credits_required": cost,
                "credits_remaining": balance,
            },
        )


def _deduct(db: Session, user_id, cost: int, description: str, reference_id=None):
    """Deduct credits after a successful copilot action."""
    deduct_credits(db, user_id, cost, reference_id, description)
    # Logs to CreditTransaction table for audit
```

---

## Quick Reference: Database Query Patterns

### Watcher Query
```python
# Get all active watchers for a user
watchers = db.query(WatcherModel).filter(
    WatcherModel.status == "active"
).order_by(WatcherModel.created_at.desc()).all()

# Get watcher by ID
watcher = db.query(WatcherModel).filter(
    WatcherModel.id == "w-a1b2c3d4"
).first()
```

### Copilot Brief Query
```python
# Get today's brief
today_brief = db.query(CopilotBrief).filter(
    CopilotBrief.user_id == user_id,
    CopilotBrief.brief_date == date.today(),
    CopilotBrief.brief_type == "daily"
).first()

# Get recent briefs
recent_briefs = db.query(CopilotBrief).filter(
    CopilotBrief.user_id == user_id
).order_by(CopilotBrief.brief_date.desc()).limit(30).all()
```

### Chat Session Query
```python
# Get user's chat sessions
sessions = db.query(CopilotChatSession).filter(
    CopilotChatSession.user_id == user_id
).order_by(CopilotChatSession.updated_at.desc()).all()

# Get specific session
session = db.query(CopilotChatSession).filter(
    CopilotChatSession.id == session_id,
    CopilotChatSession.user_id == user_id
).first()
```

---

## Error Handling Patterns

### Try-Except with Logging
```python
try:
    result = await expensive_operation()
    return result
except HTTPStatusError as e:
    if e.response.status_code == 403:
        raise ExploriumCreditError("Insufficient credits")
    logger.warning(f"API returned {e.response.status_code}: {e.response.text}")
    raise
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    raise HTTPException(status_code=500, detail="Operation failed")
```

### HTTP Exceptions
```python
# 400 - Bad Request
raise HTTPException(status_code=400, detail="Invalid field value")

# 402 - Payment Required (insufficient credits)
raise HTTPException(status_code=402, detail="Insufficient credits")

# 404 - Not Found
raise HTTPException(status_code=404, detail="Watcher not found")

# 500 - Internal Server Error
raise HTTPException(status_code=500, detail="Database connection failed")
```

---

Generated: March 24, 2026 | Code Snippets Reference
