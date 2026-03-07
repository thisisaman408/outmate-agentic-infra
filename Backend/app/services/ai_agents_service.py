import os
import json
import logging
import httpx
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from app.core.config import settings
from app.core.redis import RedisManager
from app.services.explorium_service import ExploriumService
import asyncio
import uuid

logger = logging.getLogger(__name__)

COUNTRY_CODE_TO_NAME = {
    "us": "United States",
    "ca": "Canada",
    "mx": "Mexico",
    "gb": "United Kingdom",
    "de": "Germany",
    "fr": "France",
    "es": "Spain",
    "it": "Italy",
    "nl": "Netherlands",
    "au": "Australia",
    "nz": "New Zealand",
    "in": "India",
    "sg": "Singapore",
    "jp": "Japan",
}

GENERIC_DOMAINS = {"google.com", "amazon.com", "linkedin.com", "facebook.com", "microsoft.com", "apple.com"}

class AiAgentsService:
    def __init__(self):
        self.openrouter_api_key = settings.OPENROUTER_API_KEY
        self.tavily_api_key = settings.TAVILY_API_KEY
        self.serper_api_key = settings.SERPER_API_KEY
        self.openrouter_base_url = settings.OPENROUTER_BASE_URL or "https://openrouter.ai/api/v1"
        self.tavily_base_url = "https://api.tavily.com"
        
        if not self.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY not found in environment")
        if not self.serper_api_key:
            logger.warning("SERPER_API_KEY not found in environment. Serper-based search will fail.")
        if not self.tavily_api_key:
            logger.warning("TAVILY_API_KEY not found in environment. Tavily-based search will fail.")
        self.explorium = ExploriumService()
        self.seed_domain_lookup = {
            "stripe": "stripe.com",
            "airbnb": "airbnb.com",
            "notion": "notion.so",
        }
        try:
            self.redis = RedisManager.get_client()
        except Exception as exc:
            logger.warning("Redis unavailable for pipeline cohort: %s", exc)

    async def _call_serper(self, query: str, num: int = 10) -> List[Dict[str, Any]]:
        """Call Serper API for Google Search results."""
        if not self.serper_api_key:
            return []
            
        headers = {
            "X-API-KEY": self.serper_api_key,
            "Content-Type": "application/json"
        }
        payload = {"q": query, "num": num}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            attempt = 0
            while attempt < 2:
                try:
                    response = await client.post("https://google.serper.dev/search", headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json().get("organic", [])
                    logger.debug(f"Serper returned {len(data)} hits for query:{query}")
                    return data
                except httpx.HTTPStatusError as http_err:
                    status = http_err.response.status_code
                    if status == 429 and attempt == 0:
                        logger.warning("Serper rate limited; retrying after a short delay.")
                        attempt += 1
                        await asyncio.sleep(1.0)
                        continue
                    logger.error(f"Serper Search Error: {http_err}")
                    return []
                except Exception as e:
                    logger.error(f"Serper Search Error: {str(e)}")
                    return []

    async def _map_with_concurrency(self, items: List[Any], limit: int, func):
        """Helper for concurrent execution with a limit (Semaphore)."""
        import asyncio
        semaphore = asyncio.Semaphore(limit)
        
        async def sem_func(item):
            async with semaphore:
                return await func(item)
                
        return await asyncio.gather(*(sem_func(item) for item in items))

    async def _call_openrouter(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        reasoning: bool = False,
        max_tokens: int = 3000,
    ) -> Dict[str, Any]:
        """Call OpenRouter API (OpenAI-compatible)."""
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Outmate AI",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if reasoning:
            payload["reasoning"] = {"effort": "high"}
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{self.openrouter_base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                if response.status_code == 402:
                    detail = ""
                    try:
                        payload = response.json()
                        detail = payload.get("detail") or payload.get("error") or response.text
                    except Exception:
                        detail = response.text
                    logger.error(f"OpenRouter Error 402: {detail}")
                    raise HTTPException(status_code=402, detail=f"OpenRouter error: {detail}")

                response.raise_for_status()
                data = response.json()
                message = data["choices"][0]["message"]
                return {
                    "content": message.get("content") or "",
                    "reasoning_details": message.get("reasoning_details"),
                    "usage": data.get("usage"),
                }
            except HTTPException:
                raise
            except httpx.HTTPStatusError as e:
                logger.error(f"OpenRouter HTTP Error: {e.response.status_code} - {e.response.text}")
                raise
            except Exception as e:
                logger.error(f"OpenRouter Connection Error: {str(e)}")
                raise

    async def _call_tavily(self, query: str, search_depth: str = "advanced") -> Dict[str, Any]:
        """Call Tavily Search API."""
        if not self.tavily_api_key:
            return {"results": [], "error": "TAVILY_API_KEY missing"}
            
        payload = {
            "api_key": self.tavily_api_key,
            "query": query,
            "search_depth": search_depth,
            "include_answer": True,
            "include_raw_content": False,
            "max_results": 5
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.tavily_base_url}/search",
                json=payload
            )
            response.raise_for_status()
            return response.json()

    async def agentic_search(self, query: str) -> List[Dict[str, Any]]:
        """
        7-Layer Agentic Prospect Search:
        1. Normalization & Mode Detection
        2. Tiered Discovery (Serper)
        3. Deduplication & Filtering
        4. Deep Evidence Collection (Concurrent)
        5. AI Interpretation (OpenRouter/Gemini)
        6. Constraint Enforcement
        7. Final Output
        """
        import re
        from urllib.parse import urlparse

        # --- LAYER 1: NORMALIZATION & MODE DETECTION ---
        q = query.lower()
        query_mode = "DISCOVERY"
        if re.search(r"actively hiring|open roles", q):
            query_mode = "STRICT"
        elif re.search(r"hiring|funded|remote", q):
            query_mode = "FILTERED"
        
        topic = re.sub(r"^(find|show me|give me|list|search for|get)\s+", "", q).strip()

        # --- LAYER 2: TIERED DISCOVERY ---
        search_terms = [
            f"top market leader {topic} companies",
            f"fast growing mid-sized {topic} companies",
            f"new innovative {topic} startups 2024 2025"
        ]
        
        # Parallel tiered search
        raw_results = await asyncio.gather(*(self._call_serper(term, num=20) for term in search_terms))
        famous, mid, startups = raw_results

        logger.info(f"Serper tier results sizes: famous={len(famous)}, mid={len(mid)}, startups={len(startups)}")

        # --- LAYER 3: DEDUPLICATION & MERGING ---
        processed_domains = set()
        candidates = []
        blocked_domains = ["linkedin.com", "clutch.co", "g2.com", "glassdoor.com", "wikipedia.org", "quora.com", "youtube.com"]

        def add_candidate(item, limit):
            link = item.get("link")
            if not link: return
            try:
                domain = urlparse(link).netloc.replace("www.", "")
                if any(b in domain for b in blocked_domains): return
                if domain in processed_domains: return
                
                processed_domains.add(domain)
                candidates.append({**item, "domain": domain})
            except: pass

        # Mix: 5 Famous, 5 Mid, 10 Startups
        for item in famous[:5]: add_candidate(item, 5)
        for item in mid[:5]: add_candidate(item, 5)
        for item in startups[:10]: add_candidate(item, 10)

        logger.info(f"Candidate list length after deduplication: {len(candidates)}")
        if not candidates:
            logger.warning("Agentic search produced zero candidates; check Serper/Tavily sources.")
            return []

        # --- LAYER 4: DEEP EVIDENCE COLLECTION ---
        async def collect_evidence(c):
            domain = c["domain"]
            # Parallel deep search for specific company signals and contacts
            signals_task = self._call_serper(f"site:{domain} (hiring OR careers OR \"product launch\" OR funding OR \"press release\")", num=10)
            contacts_task = self._call_serper(f"site:{domain} (email OR \"@{domain}\" OR \"contact us\" OR \"leadership\" OR \"team\")", num=10)
            
            signals, contacts = await asyncio.gather(signals_task, contacts_task)
            
            evidence = []
            for item in (signals + contacts)[:6]:
                evidence.append({
                    "title": item.get("title"),
                    "snippet": item.get("snippet"),
                    "url": item.get("link")
                })
            
            return {
                "name": c.get("title"),
                "website": c.get("link"),
                "domain": domain,
                "snippet": c.get("snippet"),
                "evidence": evidence
            }

        rich_data = await self._map_with_concurrency(candidates, 5, collect_evidence)
        logger.info(f"Collected evidence for {len(rich_data)} candidates")

        # --- LAYER 5: AI INTERPRETATION ---
        async def analyze_batch(batch):
            prompt = f"""
            SYSTEM: You are a B2B Data Enrichment Agent.
            QUERY: "{topic}" (Mode: {query_mode})

            INSTRUCTIONS:
            1. Analyze the 'evidence' for each company.
            2. Generate a valid JSON Array following the SCHEMA strictly.
            3. **Do not hallucinate**: If email/contact is not found, write "Not found" or null.
            4. **Score**: Assign a relevance score (0-99) based on how well it fits the user query "{topic}".
            5. **Reason**: Briefly explain why this company fits the query.

            INPUT DATA:
            {json.dumps(batch)}

            OUTPUT SCHEMA (Strict JSON Array):
            [
              {{
                "id": "generate_uuid_v4",
                "companyName": "string",
                "website": "string",
                "domain": "string",
                "industry": "string (infer from context)",
                "location": "string (infer from context)",
                "score": number,
                "reason": "string",
                "signals": {{
                  "hiring": "Active | Moderate | Low | Not detected",
                  "productActivity": "string | Not detected",
                  "momentum": "Positive | Neutral | Unclear",
                  "evidence": [ {{ "summary": "string", "sourceUrl": "string" }} ]
                }},
                "contacts": [
                  {{
                    "name": "string | Not found",
                    "title": "string | null",
                    "email": "string | null",
                    "sourceUrl": "string | null"
                  }}
                ]
              }}
            ]
            """
            
            # Using Gemini 1.5 Flash via OpenRouter
            response_main = await self._call_openrouter("anthropic/claude-3.5-haiku", [{"role": "user", "content": prompt}])
            def _extract_json_from_text(text: str) -> List[Dict[str, Any]]:
                clean = text.strip()
                if "```json" in clean:
                    clean = clean.split("```json")[1].split("```")[0].strip()
                else:
                    start = clean.find("[")
                    end = clean.rfind("]")
                    if start != -1 and end != -1 and end > start:
                        clean = clean[start : end + 1]
                    elif clean and clean[0] == "{":
                        clean = clean.split("}", 1)[0] + "}"
                return json.loads(clean)

            try:
                clean_parsed = _extract_json_from_text(response_main["content"])
                import uuid
                for item in clean_parsed:
                    if "id" not in item or len(item["id"]) < 10:
                        item["id"] = str(uuid.uuid4())
                perplexity_details = None
                perplexity_reasoning = None
                try:
                    perplexity_response = await self._call_openrouter(
                        "perplexity/sonar-pro-search",
                        [{"role": "user", "content": prompt}],
                        temperature=0.3,
                        reasoning=True,
                        max_tokens=2000,
                    )
                    perplexity_details = perplexity_response.get("content")
                    perplexity_reasoning = perplexity_response.get("reasoning_details")
                except Exception as reasoning_err:
                    logger.warning(f"Perplexity reasoning fetch failed: {reasoning_err}")
                for item in clean_parsed:
                    item["perplexityDetails"] = perplexity_details
                    item["perplexityReasoning"] = perplexity_reasoning
                return clean_parsed
            except json.JSONDecodeError as e:
                logger.error(f"AI Batch JSON parse failed: {str(e)}; response={response_main['content'][:120]}")
                retry_prompt = (
                    prompt
                    + "\nYou failed to produce valid JSON. Repeat the entire JSON array now, without markdown or explanation."
                )
                try:
                    retry_response = await self._call_openrouter(
                        "anthropic/claude-3.5-haiku",
                        [{"role": "user", "content": retry_prompt}],
                        temperature=0.3,
                    )
                    clean_parsed = _extract_json_from_text(retry_response["content"])
                    import uuid
                    for item in clean_parsed:
                        if "id" not in item or len(item["id"]) < 10:
                            item["id"] = str(uuid.uuid4())
                    perplexity_details = None
                    perplexity_reasoning = None
                    try:
                        perplexity_response = await self._call_openrouter(
                            "perplexity/sonar-pro-search",
                            [{"role": "user", "content": prompt}],
                            temperature=0.3,
                            reasoning=True,
                            max_tokens=2000,
                        )
                        perplexity_details = perplexity_response.get("content")
                        perplexity_reasoning = perplexity_response.get("reasoning_details")
                    except Exception as reasoning_err:
                        logger.warning(f"Perplexity reasoning fetch failed after retry: {reasoning_err}")
                    for item in clean_parsed:
                        item["perplexityDetails"] = perplexity_details
                        item["perplexityReasoning"] = perplexity_reasoning
                    return clean_parsed
                except Exception as retry_exc:
                    logger.error(f"AI Batch retry failed: {str(retry_exc)}")
                    return []
            except Exception as e:
                logger.error(f"AI Batch Error: {str(e)}")
                return []

        # Process in batches of 10
        batches = [rich_data[i:i + 10] for i in range(0, len(rich_data), 10)]
        batch_results = await asyncio.gather(*(analyze_batch(b) for b in batches))
        final_results = []
        for sublist in batch_results:
            final_results.extend(sublist)
        for item in final_results:
            primary = (item.get("contacts") or [{}])[0] or {}
            item["contactName"] = primary.get("name") or "Not found"
            item["title"] = primary.get("title") or ""
            item["email"] = primary.get("email") or ""
            location_candidates = [
                item.get("location"),
                item.get("geographicPresence"),
                item.get("locationDescription"),
                item.get("address"),
                item.get("country"),
                item.get("region"),
                primary.get("location"),
                primary.get("country"),
            ]
            location_value = None
            for loc_val in location_candidates:
                if isinstance(loc_val, str):
                    loc_val = loc_val.strip()
                if loc_val:
                    location_value = loc_val
                    break
            item["location"] = location_value or "Location not specified"
            employee_candidates = [
                item.get("employees"),
                item.get("employeeCount"),
                item.get("teamSize"),
                item.get("companySize"),
                item.get("size"),
                item.get("headcount"),
                item.get("employee_range"),
                item.get("companySizeRange"),
                item.get("team_size"),
            ]
            employees_value = None
            for emp_val in employee_candidates:
                if isinstance(emp_val, (int, float)) and emp_val > 0:
                    employees_value = str(int(emp_val))
                    break
                if isinstance(emp_val, str) and emp_val.strip():
                    employees_value = emp_val.strip()
                    break
            if not employees_value:
                employees_value = self._extract_employees_from_text(item)
            item["employees"] = employees_value or "Not specified"
            reason_value = (
                item.get("reason")
                or item.get("analysis")
                or item.get("summary")
                or item.get("description")
                or item.get("insights")
            )
            item["reason"] = str(reason_value or "No reasoning provided yet.")
        logger.info(f"AI batches produced {len(final_results)} items before filtering")

        # --- LAYER 6: CONSTRAINT ENFORCEMENT ---
        filtered = final_results
        if query_mode == "STRICT":
            filtered = [c for c in final_results if c.get("signals", {}).get("hiring") in ["Active", "Moderate"]]
        
        # Sort by score
        filtered.sort(key=lambda x: x.get("score", 0), reverse=True)
        unique_results: List[Dict[str, Any]] = []
        seen_ids: set[str] = set()
        for item in filtered:
            item_id = item.get("id")
            if not item_id or len(str(item_id)) < 5:
                item_id = str(uuid.uuid4())
                item["id"] = item_id
            if item_id in seen_ids:
                continue
            seen_ids.add(item_id)
            unique_results.append(item)
        return unique_results

    def _extract_employees_from_text(self, item: Dict[str, Any]) -> Optional[str]:
        """Try to parse an employee count or range from textual context."""
        pattern = re.compile(
            r"(\d{1,3}(?:,\d{3})*(?:-\d{1,3}(?:,\d{3})*)?)(?=\s*(?:employees|staff|people|team))",
            re.I,
        )
        texts = [
            item.get("reason") or "",
            item.get("analysis") or "",
            item.get("summary") or "",
            item.get("insights") or "",
            item.get("perplexityDetails") or "",
            item.get("perplexityReasoning") or "",
        ]
        for text in texts:
            if not isinstance(text, str):
                continue
            match = pattern.search(text)
            if match:
                return match.group(1)
        return None

    async def deep_research(self, company_name: str, depth: str = "standard") -> Dict[str, Any]:
        """
        Research Agent:
        1. Real-Time Research via Tavily
        2. Tiered Model & Schema selection
        3. Perplexity Execution (via OpenRouter)
        4. Fallback Format Repair (via Gemini)
        """
        if not company_name:
            return {"error": "Company name is required"}

        # Step 1: Real-Time Research via Tavily
        research_context = ""
        tavily_depth = "basic" if depth == "quick" else "advanced"
        max_results = 10 if depth == "deep" else 5

        try:
            logger.info(f"Researching {company_name} with depth: {depth}")
            tavily_res = await self._call_tavily(
                f"detailed strategic analysis, recent news, and competitors of {company_name}",
                search_depth=tavily_depth
            )
            results = tavily_res.get("results", [])
            research_context = "\n\n".join([f"Source: {r['title']} ({r['url']})\nContent: {r['content']}" for r in results])
        except Exception as e:
            logger.error(f"Tavily Research Error: {str(e)}")
            research_context = "Tavily lookup failed. Using internal knowledge."

        # Step 2: Determine Model, Token Budget, and Schema
        model = "perplexity/sonar-reasoning-pro"
        research_max_tokens = 6000  # standard depth
        json_schema = ""

        if depth == "quick":
            model = "perplexity/sonar-pro"
            research_max_tokens = 4000
            json_schema = """{
              "companyName": "string",
              "executiveSummary": "string",
              "companyType": "B2B | B2C | D2C | Marketplace | Mixed",
              "productsAndServices": [
                { "name": "string", "description": "string" }
              ],
              "marketPosition": {
                "industry": "string",
                "positioning": "Leader | Challenger | Niche | Emerging"
              },
              "competitiveLandscape": {
                "directCompetitors": ["string"]
              },
              "recentDevelopments": [
                { "event": "string", "date": "string", "strategicImpact": "string" }
              ],
              "risksAndChallenges": ["string"],
              "confidenceLevel": "High | Medium | Low"
            }"""
        elif depth == "deep":
            model = "perplexity/sonar-deep-research"
            research_max_tokens = 8000
            json_schema = """{
              "companyName": "string",
              "executiveSummary": "string",
              "companyType": "B2B | B2C | D2C | Marketplace | Mixed",
              "businessModel": {
                "description": "string",
                "targetCustomers": "string",
                "revenueStreams": ["string"],
                "businessDurability": "string"
              },
              "productsAndServices": [
                { "name": "string", "description": "string" }
              ],
              "marketPosition": {
                "industry": "string",
                "geographicPresence": "string",
                "positioning": "Leader | Challenger | Niche | Emerging",
                "keyDifferentiators": ["string"],
                "marketDynamics": "string"
              },
              "competitiveLandscape": {
                "directCompetitors": ["string"],
                "indirectCompetitors": ["string"],
                "competitiveContext": "string"
              },
              "recentDevelopments": [
                { "event": "string", "date": "string", "strategicImpact": "string" }
              ],
              "opportunities": ["string"],
              "risks": ["string"],
              "goToMarketInsights": "string",
              "longTermOutlook": "string",
              "confidenceLevel": "High | Medium | Low"
            }"""
        else: # Standard
            json_schema = """{
              "companyName": "string",
              "executiveSummary": "string",
              "companyType": "B2B | B2C | D2C | Marketplace | Mixed",
              "businessModel": {
                "description": "string",
                "targetCustomers": "string",
                "revenueStreams": ["string"]
              },
              "productsAndServices": [
                { "name": "string", "description": "string" }
              ],
              "marketPosition": {
                "industry": "string",
                "geographicPresence": "string",
                "positioning": "Leader | Challenger | Niche | Emerging",
                "keyDifferentiators": ["string"]
              },
              "competitiveLandscape": {
                "directCompetitors": ["string"],
                "indirectCompetitors": ["string"],
                "competitiveContext": "string"
              },
              "recentDevelopments": [
                { "event": "string", "date": "string", "strategicImpact": "string" }
              ],
              "opportunities": ["string"],
              "risks": ["string"],
              "goToMarketInsights": "string",
              "confidenceLevel": "High | Medium | Low"
            }"""

        prompt = f"""
        SYSTEM ROLE: You are a Corporate Intelligence Analyst.
        RULES: 
        1. Priority: Use LIVE RESEARCH DATA.
        2. No hallucinations.
        3. Return ONLY valid JSON matching schema.

        COMPANY: {company_name}
        LIVE RESEARCH DATA: {research_context}
        DEPTH: {depth}

        OUTPUT SCHEMA:
        {json_schema}
        """

        # Step 3: Perplexity Execution
        report_obj = None
        try:
            report_text = ""
            report_raw = await self._call_openrouter(model, [
                {"role": "system", "content": "Return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ], temperature=0.2, max_tokens=research_max_tokens)
            
            report_text = (report_raw or {}).get("content", "")
            import re
            match = re.search(r"\{[\s\S]*\}", report_text)
            if match:
                report_obj = json.loads(match.group(0))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Perplexity Search Error: {str(e)}")

        # Step 4: Fallback Format Repair via Gemini
        logger.info("Retrying with Gemini Format Repair...")
        repair_prompt = f"""
        Transform the following research text into STRICT JSON matching the schema.
        TEXT: {report_text if 'report_text' in locals() else 'No data found.'}
        SCHEMA: {json_schema}
        """
        try:
            repaired = await self._call_openrouter("anthropic/claude-3.5-haiku", [{"role": "user", "content": repair_prompt}], max_tokens=3000)
            repaired_text = (repaired or {}).get("content", "")
            match = re.search(r"\{[\s\S]*\}", repaired_text)
            if match:
                report_obj = json.loads(match.group(0))
        except HTTPException:
            raise
        except:
            return {"error": "Failed to generate research report.", "companyName": company_name}

        if not report_obj:
            return self._default_research_result(company_name)

        return self._normalize_research_result(report_obj, company_name)

    def _default_research_result(self, company_name: str) -> Dict[str, Any]:
        return {
            "companyName": company_name,
            "summary": "Summary unavailable at this time.",
            "marketPosition": "Positioning data unavailable.",
            "keyInsights": [],
            "opportunities": [],
            "risks": [],
            "competitors": [],
            "recentNews": [],
        }

    def _normalize_research_result(self, payload: Dict[str, Any], company_name: str) -> Dict[str, Any]:
        def listify(value: Any) -> List[str]:
            if isinstance(value, list):
                return [str(v) for v in value if v]
            if isinstance(value, str):
                return [value]
            return []

        recent = []
        for entry in payload.get("recentDevelopments", []) or payload.get("recentNews", []):
            if isinstance(entry, dict):
                event = entry.get("event") or entry.get("title") or entry.get("summary")
                if event:
                    recent.append(str(event))
            elif isinstance(entry, str):
                recent.append(entry)

        insight_list = self._render_insight_list(payload)
        if not insight_list:
            logger.info("Research payload missing key insights; payload keys=%s", list(payload.keys()))

        return {
            "companyName": payload.get("companyName") or company_name,
            "summary": payload.get("executiveSummary") or payload.get("summary") or payload.get("description") or "Summary unavailable.",
            "marketPosition": payload.get("marketPosition") or payload.get("positioning") or "Positioning data unavailable.",
            "keyInsights": insight_list,
            "opportunities": listify(payload.get("opportunities")),
            "risks": listify(payload.get("risks")),
            "competitors": listify(payload.get("competitors") or payload.get("competition") or payload.get("directCompetitors")),
            "recentNews": recent,
        }

    def _render_insight_list(self, payload: Dict[str, Any]) -> List[str]:
        candidates = (
            payload.get("keyInsights")
            or payload.get("keyInsightFindings")
            or payload.get("insightFindings")
            or payload.get("insights")
            or payload.get("insightList")
            or payload.get("findingList")
            or payload.get("findings")
            or payload.get("reasons")
            or []
        )
        strings = self._collect_strings(candidates)
        if not strings:
            text = payload.get("analysis") or payload.get("insightsText") or payload.get("summaryText")
            if isinstance(text, str):
                strings = [line.strip() for line in text.splitlines() if line.strip()]
        if not strings:
            market_position = payload.get("marketPosition") or payload.get("positioning")
            if market_position:
                strings.append(f"Market position: {market_position}")
            def stringify_item(item):
                if isinstance(item, str):
                    return item
                if isinstance(item, dict):
                    return item.get("companyName") or item.get("name") or item.get("title") or str(item)
                if isinstance(item, list):
                    sub = [stringify_item(i) for i in item]
                    return ", ".join([s for s in sub if s])
                if item is None:
                    return ""
                return str(item)

            def format_list(lst, limit=None):
                cleaned = [stringify_item(item) for item in lst]
                cleaned = [s for s in cleaned if s]
                if limit is not None:
                    cleaned = cleaned[:limit]
                return cleaned
            direct_competitors = payload.get("competitiveLandscape", {}).get("directCompetitors") if isinstance(payload.get("competitiveLandscape"), dict) else None
            indirect = payload.get("competitiveLandscape", {}).get("indirectCompetitors") if isinstance(payload.get("competitiveLandscape"), dict) else None
            if direct_competitors:
                direct_list = format_list(direct_competitors)
                if direct_list:
                    strings.append(f"Direct competitors include {', '.join(direct_list)}")
            if indirect:
                indirect_list = format_list(indirect)
                if indirect_list:
                    strings.append(f"Indirect competitors include {', '.join(indirect_list)}")
            products = payload.get("productsAndServices")
            if products:
                if isinstance(products, list):
                    service_list = format_list(products, limit=3)
                    if service_list:
                        strings.append(f"Services: {', '.join(service_list)}")
                else:
                    strings.append(f"Services: {stringify_item(products)}")
            go_to_market = payload.get("goToMarketInsights")
            if go_to_market:
                strings.append(f"Go-to-market insight: {stringify_item(go_to_market)}")
        return strings

    def _extract_search_keywords(self, profile: Dict[str, Any]) -> List[str]:
        keywords = set()
        def add_terms(source: Any):
            if isinstance(source, str):
                for token in source.split():
                    token = token.strip().lower()
                    if len(token) >= 3:
                        keywords.add(token)
            elif isinstance(source, list):
                for term in source:
                    add_terms(term)

        add_terms(profile.get("specialties") or profile.get("specialty") or [])
        add_terms(profile.get("technologies") or profile.get("tech_stack") or [])
        add_terms(profile.get("description"))
        add_terms(profile.get("industry"))
        return [k for k in keywords if len(k) >= 3][:5]

    def _collect_strings(self, data: Any) -> List[str]:
        if data is None:
            return []
        if isinstance(data, str):
            return [data.strip()]
        if isinstance(data, dict):
            results: List[str] = []
            for value in data.values():
                results.extend(self._collect_strings(value))
            return results
        if isinstance(data, list):
            results: List[str] = []
            for entry in data:
                results.extend(self._collect_strings(entry))
            return results
        return []

    def _extract_business_id_from_match(self, match_item: Dict[str, Any]) -> Optional[str]:
        if not isinstance(match_item, dict):
            return None
        if match_item.get("business_id"):
            return match_item.get("business_id")
        nested_business = match_item.get("business")
        if isinstance(nested_business, dict):
            if nested_business.get("business_id"):
                return nested_business.get("business_id")
            if nested_business.get("id"):
                return nested_business.get("id")
        if match_item.get("id"):
            return match_item.get("id")
        match_data = match_item.get("match")
        if isinstance(match_data, dict):
            if match_data.get("business_id"):
                return match_data.get("business_id")
            if match_data.get("id"):
                return match_data.get("id")
        return None

    async def _fetch_seed_profile(self, business_id: str) -> Optional[Dict[str, Any]]:
        try:
            raw = await self.explorium.fetch_businesses(
                {"business_id": business_id}, size=1, page_size=1, page=1, mode="full"
            )
            data = (raw or {}).get("data") or []
            if not data:
                return None
            return self.explorium.normalize_company(data[0])
        except Exception as exc:
            logger.debug(f"[Lookalike] Failed to fetch seed profile for {business_id}: {exc}")
            return None

    async def _search_seed_profile_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            result = await self.explorium.search_companies({"name": name}, limit=1)
            companies = (result.get("companies") or []) if isinstance(result, dict) else []
            if not companies:
                return None
            return self.explorium.normalize_company(companies[0])
        except Exception as exc:
            logger.debug(f"[Lookalike] Failed to search seed profile by name '{name}': {exc}")
            return None

    def _is_generic_company(self, company: Dict[str, Any]) -> bool:
        domain = (company.get("website") or company.get("domain") or "")
        if isinstance(domain, str):
            domain = domain.lower()
            for blocked in GENERIC_DOMAINS:
                if domain.endswith(blocked):
                    return True
        return False

    async def _find_similar_companies(self, seed_profile: Optional[Dict[str, Any]], business_id: Optional[str]) -> List[Dict[str, Any]]:
        if not seed_profile:
            return []
        seeds = seed_profile.get("companyName") or seed_profile.get("domain") or ""
        prompt = f"""
        Act as a Market Research AI. Find 5 companies that are lookalikes to {seeds}.
        Focus on patents, technology, customer reviews, and market presence.
        Return JSON array with fields: id, companyName, similarityScore, matchingFactors, industry, employees, location, revenue.
        """
        try:
            completion = await self._call_openrouter(
                "anthropic/claude-3.5-haiku",
                [{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            content = completion.get("content") if isinstance(completion, dict) else str(completion)
            match = re.search(r"\[[\s\S]*\]", content)
            if match:
                return json.loads(match.group(0))
        except Exception as exc:
            logger.error(f"Lookalike Analysis Error: {exc}")
        return []

    async def _fetch_explorium_lookalikes(self, business_id: str, limit: int = 3) -> List[Dict[str, Any]]:
        if not business_id:
            return []
        try:
            response = await self.explorium.enrich_lookalikes(business_id)
            data = (response or {}).get("data") or []
            if isinstance(data, list):
                return data[:limit]
            return []
        except httpx.HTTPStatusError as exc:
            logger.error(
                "Lookalike enrichment failed for business %s: %s",
                business_id,
                exc.response.text if exc.response is not None else exc,
            )
        except Exception as exc:
            logger.error("Lookalike enrichment error for business %s: %s", business_id, exc)
        return []

    def _build_result_from_entry(self, entry: Dict[str, Any], matching_context: Optional[List[str]] = None, fallback: bool = False) -> Dict[str, Any]:
        name = (
            entry.get("lookalike_business_name")
            or entry.get("name")
            or entry.get("companyName")
            or entry.get("business_name")
            or "Lookalike"
        )
        lookalike_id = str(entry.get("lookalike_business_id") or entry.get("id") or uuid.uuid4())
        similarity_raw = entry.get("similarity_score") or entry.get("similarityScore") or entry.get("score") or entry.get("similarity")
        percent = self._map_similarity_score(similarity_raw)
        label = similarity_raw if isinstance(similarity_raw, str) else None
        country_code = (entry.get("lookalike_country_location") or entry.get("country") or entry.get("headquarters_country") or "").lower()
        location = COUNTRY_CODE_TO_NAME.get(country_code, country_code.upper() if country_code else None)
        industry = entry.get("lookalike_naics_description") or entry.get("industry") or entry.get("primary_industry")
        matching_factors = matching_context.copy() if matching_context else []
        if label:
            matching_factors.append(f"Similarity: {label}")
        if industry and industry not in matching_factors:
            matching_factors.append(industry)
        if fallback and industry and "industry match" not in matching_factors:
            matching_factors.append("industry match")
        if fallback:
            matching_factors.append("filtered search")
        matching_factors = list(dict.fromkeys(matching_factors))

        if not getattr(self, "_lookalike_logged", False):
            logger.info("Lookalike raw entry sample: %s", entry)
            self._lookalike_logged = True

        if percent <= 0 and isinstance(similarity_raw, (int, float)):
            percent = float(similarity_raw)
        if percent <= 0 and isinstance(similarity_raw, str):
            try:
                percent = float(similarity_raw.replace("%", "").strip())
            except Exception:
                pass
        if fallback and percent <= 5:
            percent = 85.0
            if not label:
                label = "High"

        return {
            "id": lookalike_id,
            "companyName": name,
            "website": entry.get("lookalike_website") or entry.get("website"),
            "description": entry.get("lookalike_description") or entry.get("description"),
            "industry": industry,
            "employees": entry.get("lookalike_number_of_employees_range")
            or entry.get("employee_count_range")
            or entry.get("companySize")
            or entry.get("company_size"),
            "revenue": entry.get("lookalike_revenue_range") or entry.get("revenue_range"),
            "location": location or entry.get("location"),
            "similarityScore": percent or 75,
            "matchingFactors": matching_factors,
            "similarityLabel": label,
        }

    def _map_similarity_score(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            if 0 < value <= 1:
                return value * 100
            return float(max(0, min(100, value)))
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized.endswith("%"):
                try:
                    return float(normalized.strip("%"))
                except ValueError:
                    pass
            mapping = {"high": 95.0, "medium": 85.0, "low": 70.0}
            if normalized in mapping:
                return mapping[normalized]
            try:
                estimate = float(normalized)
                if 0 <= estimate <= 1:
                    return estimate * 100
                return estimate
            except ValueError:
                pass
        return 0.0

    async def _lookup_domain_for_name(self, name: str) -> Optional[str]:
        if not name:
            return None
        try:
            result = await self.explorium.search_companies({"name": name}, limit=1, strict_filters=True)
            companies = result.get("companies") or []
            if companies:
                domain = companies[0].get("website") or companies[0].get("domain")
                if domain and "." in domain:
                    return domain.lower()
        except Exception as exc:
            logger.debug(f"[Lookalike] domain lookup failed for {name}: {exc}")
        return None

    def _normalize_seed_label(self, seed: str) -> str:
        candidate = (seed or "").strip()
        trimmed = re.sub(r"[\-–—_]+\\d+$", "", candidate)
        return trimmed.strip()

    async def _resolve_seed_business_id(self, seed: str) -> Optional[str]:
        candidate = (seed or "").strip()
        if not candidate:
            return None
        lower_candidate = candidate.lower()
        if re.fullmatch(r"[a-f0-9]{32}", lower_candidate):
            return lower_candidate

        trimmed = self._normalize_seed_label(candidate)
        if not trimmed:
            return None

        if trimmed != candidate:
            logger.debug(f"[Lookalike] Normalized seed '{candidate}' to '{trimmed}'")

        seed_key = trimmed.lower()

        inputs = []
        if re.fullmatch(r"[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", trimmed):
            inputs.append({"domain": trimmed})
        domain_override = self.seed_domain_lookup.get(seed_key)
        domain_from_lookup = None
        is_domain_like = bool(re.fullmatch(r"[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}", trimmed))
        if not is_domain_like and not domain_override:
            domain_from_lookup = await self._lookup_domain_for_name(trimmed)

        if domain_override:
            inputs.append({"domain": domain_override})
        elif is_domain_like:
            inputs.append({"domain": trimmed})
        elif domain_from_lookup:
            inputs.append({"domain": domain_from_lookup})
        inputs.append({"name": trimmed})

        try:
            match_payload = await self.explorium.match_businesses(inputs)
            candidates = []
            if isinstance(match_payload, dict):
                candidates = match_payload.get("matched_businesses") or []
                if not candidates and match_payload.get("matches"):
                    matches_list = match_payload.get("matches") or []
                    for match_item in matches_list:
                        if isinstance(match_item, dict):
                            candidate_entry = match_item.get("business") or match_item
                            if candidate_entry:
                                candidates.append(candidate_entry)
            elif isinstance(match_payload, list):
                candidates = match_payload

            if not candidates:
                logger.debug(f"[Lookalike] No match found for inputs={inputs}, response={match_payload}")
                return None

            for candidate_item in self._flatten_entries(candidates):
                bid = self._extract_business_id_from_match(candidate_item)
                if bid:
                    return bid
        except Exception as e:
            logger.debug(f"Lookalike seed match failed for '{candidate}': {e}")
        return None

    async def find_lookalikes(self, seed_company_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Lookalike Agent: query Ocean.io lookalikes through Explorium enrichment.
        """
        seeds_to_process: List[str] = []
        for seed_label in seed_company_ids:
            if seed_label:
                seeds_to_process.append(seed_label)

        if not seeds_to_process:
            logger.warning("Lookalike Agent: seed pool is empty.")
            return []

        raw_results: List[Dict[str, Any]] = []
        for seed_label in seeds_to_process:
            business_id = await self._resolve_seed_business_id(seed_label)
            if not business_id:
                logger.debug(f"[Lookalike] Could not resolve ID for '{seed_label}', falling back to name search.")
            seed_profile = None
            if business_id:
                seed_profile = await self._fetch_seed_profile(business_id)
            if not seed_profile:
                seed_profile = await self._search_seed_profile_by_name(seed_label)
            fallback_context: List[str] = []
            if seed_profile:
                if seed_profile.get("industry"):
                    fallback_context.append("industry match")
                if seed_profile.get("location"):
                    fallback_context.append("location match")
            try:
                candidates = []
                if business_id:
                    candidates = await self._fetch_explorium_lookalikes(business_id)
                if candidates:
                    for entry in candidates:
                        raw_results.append(
                            self._build_result_from_entry(entry, matching_context=fallback_context, fallback=False)
                        )
                    continue
                fallback_candidates = await self._find_similar_companies(seed_profile, business_id)
                if not fallback_candidates:
                    logger.warning(f"Lookalike Agent: fallback search returned nothing for '{seed_label}'")
                    continue
                for entry in fallback_candidates:
                    raw_results.append(
                        self._build_result_from_entry(entry, matching_context=fallback_context, fallback=True)
                    )
            except Exception:
                logger.exception(f"Lookalike search error for seed {seed_label}")

        final_results: List[Dict[str, Any]] = []
        seen_ids = set()
        for candidate in raw_results:
            candidate_id = candidate.get("id")
            if not candidate_id or candidate_id in seen_ids:
                continue
            seen_ids.add(candidate_id)
            final_results.append(candidate)
            if len(final_results) >= 3:
                break

        return final_results

    async def predictive_scoring(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predictive Agent:
        1. Wikipedia Signal Extraction
        2. SEC EDGAR Verification (US Only)
        3. Unified Predictive Prompt (OpenRouter/Claude)
        """
        target = company_data.get("company")
        if not target or not target.get("name"):
            raise HTTPException(
                status_code=422,
                detail="Company name is required. Provide: {company: {name, domain, industry, country}}"
            )
        name = target.get("name")
        country = target.get("country", "US")

        wiki_signals = {
            "wikiExists": False,
            "wikiLength": 0,
            "hasScaleSignals": False,
            "hasGlobalSignals": False,
            "hasDateSignals": False,
            "summary": ""
        }

        # Step 1: Wikipedia API
        if name:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    wiki_url = "https://en.wikipedia.org/w/api.php"
                    params = {
                        "action": "query",
                        "format": "json",
                        "prop": "extracts|pageprops",
                        "exintro": True,
                        "explaintext": True,
                        "titles": name,
                        "redirects": 1
                    }
                    headers = {"User-Agent": "OutmateAI/1.0 (https://outmate.com)"}
                    wiki_res = await client.get(wiki_url, params=params, headers=headers)
                    pages = wiki_res.json().get("query", {}).get("pages", {})
                    if pages:
                        page_id = next(iter(pages))
                        if page_id != "-1":
                            extract = pages[page_id].get("extract", "")
                            text_lower = extract.lower()
                            wiki_signals = {
                                "wikiExists": True,
                                "wikiLength": len(extract),
                                "hasScaleSignals": any(k in text_lower for k in ["employees", "public company", "revenue", "billion", "million"]),
                                "hasGlobalSignals": any(k in text_lower for k in ["global", "worldwide", "multinational", "international"]),
                                "hasDateSignals": any(k in text_lower for k in ["founded", "established", "since"]),
                                "summary": extract[:500] + "..."
                            }
                            logger.info(f"Wikipedia Signals extracted: {wiki_signals}")
            except Exception as e:
                logger.error(f"Wikipedia Signal Error: {str(e)}")

        # Step 2: SEC EDGAR Lookup (US Only)
        sec_data = None
        revenue_source = "Estimated (Wikipedia + Industry Benchmarks)"
        revenue_type = "estimated"

        if country.upper() == "US" and name:
            try:
                logger.info(f"Checking SEC Ticker list for: {name}")
                headers = {"User-Agent": "OutmateAI/1.0 (https://outmate.com)"}
                async with httpx.AsyncClient(timeout=10.0) as client:
                    # A. Get CIK from Tickers
                    tickers_res = await client.get("https://www.sec.gov/files/company_tickers.json", headers=headers)
                    tickers = tickers_res.json().values()
                    match = next((t for t in tickers if name.lower() in t["title"].lower()), None)

                    if match:
                        cik = str(match["cik_str"]).zfill(10)
                        logger.info(f"Found SEC Match: {match['title']} (CIK: {cik})")
                        # B. Get Facts
                        facts_res = await client.get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json", headers=headers)
                        gaap = facts_res.json().get("facts", {}).get("us-gaap", {})
                        
                        rev_concept = gaap.get("Revenues") or gaap.get("RevenueFromContractWithCustomerExcludingAssessedTax")
                        if rev_concept and "units" in rev_concept and "USD" in rev_concept["units"]:
                            annuals = [r for r in rev_concept["units"]["USD"] if r.get("form") == "10-K"]
                            if annuals:
                                annuals.sort(key=lambda x: x.get("end", ""), reverse=True)
                                latest = annuals[0]
                                sec_data = {
                                    "value": f"${(latest['val'] / 1e9):.2f}B",
                                    "fiscalYear": latest.get("fy"),
                                    "date": latest.get("end")
                                }
                                revenue_source = "SEC EDGAR"
                                revenue_type = "reported"
                                logger.info(f"Retrieved SEC Revenue: {sec_data}")
            except Exception as e:
                logger.error(f"SEC EDGAR Error: {str(e)}")

        # Step 3: Unified Predictive Prompt
        prompt = f"""
        SYSTEM ROLE: Constrained financial analyst.
        RULES: Use ONLY provided data. Use ranges for private companies. SEC data is authoritative.

        TARGET: {json.dumps(target)}
        WIKI SIGNALS: {json.dumps(wiki_signals)}
        SEC DATA: {json.dumps(sec_data) if sec_data else "Not Available"}

        OUTPUT SCHEMA (STRICT JSON):
        {{
          "predictiveSummary": {{
            "companyScale": "Startup | SMB | Enterprise",
            "revenue": {{
              "type": "{revenue_type}",
              "value": "{sec_data['value'] if sec_data else 'Estimated'}",
              "range": "string (if estimated)",
              "source": "{revenue_source}"
            }},
            "travelSpend": "Low | Medium | High",
            "saasSpend": "Low | Medium | High",
            "customScore": 0-100,
            "intentSignal": "High | Medium | Low",
            "confidence": 0-100,
            "reasoning": "string"
          }}
        }}
        """

        import uuid, re
        logger.info(f"Calling OpenRouter predictive model for {name} with template size {len(prompt)} chars")
        try:
            scores_raw = await self._call_openrouter("anthropic/claude-3.5-sonnet", [{"role": "user", "content": prompt}], temperature=0.1, max_tokens=4000)
            scores_text = scores_raw.get("content") if isinstance(scores_raw, dict) else str(scores_raw)
            match = re.search(r"\{[\s\S]*\}", scores_text)
            if match:
                parsed = json.loads(match.group(0))
                summary = parsed.get("predictiveSummary", {})
                def slugify(value: Optional[str]) -> str:
                    if not value:
                        return "contact"
                    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
                    return cleaned or "contact"

                def format_domain(value: Optional[str]) -> str:
                    if not value:
                        return "outmate.ai"
                    value = value.replace("https://", "").replace("http://", "").split("/")[0]
                    return value or "outmate.ai"

                summary = parsed.get("predictiveSummary", {})
                wiki_signals_data = wiki_signals
                fallback_signals: List[Dict[str, str]] = []
                if summary.get("signals"):
                    fallback_signals = summary.get("signals")
                else:
                    if wiki_signals_data.get("hasScaleSignals"):
                        fallback_signals.append({"name": "Scale signals present", "impact": "positive"})
                    if wiki_signals_data.get("hasGlobalSignals"):
                        fallback_signals.append({"name": "Global presence detected", "impact": "positive"})
                    if wiki_signals_data.get("hasDateSignals"):
                        fallback_signals.append({"name": "Recent founding or milestone date", "impact": "positive"})
                    if not fallback_signals:
                        fallback_signals.append({"name": "Behavioral opportunity signal", "impact": "positive"})
                company_domain = format_domain(target.get("domain"))
                email_slug = slugify(target.get("name"))
                profile_slug = slugify(target.get("name"))
                contact_info = summary.get("contact") or {}
                profile_link = (
                    summary.get("profileLink")
                    or summary.get("profileUrl")
                    or contact_info.get("profileUrl")
                    or contact_info.get("linkedin")
                )
                email_address = (
                    summary.get("email")
                    or summary.get("contactEmail")
                    or contact_info.get("email")
                    or contact_info.get("workEmail")
                    or contact_info.get("personalEmail")
                )

                payload = {
                    "id": str(uuid.uuid4()),
                    "companyId": target.get("domain"),
                    "companyName": target.get("name"),
                    "contactName": target.get("name"),
                    "title": "Predicted Champion",
                    "email": email_address,
                    "profileLink": profile_link,
                    "score": summary.get("customScore") or 0,
                    "conversionLikelihood": summary.get("confidence") or 0,
                    "confidence": min(max((summary.get("confidence") or 0) / 100, 0), 1),
                    "prediction": summary.get("intentSignal") or "Medium",
                    "factors": fallback_signals,
                    "guidance": summary.get("reasoning") or parsed.get("reasoning") or "",
                    "recommendation": "Execute outreach with predictive confidence."
                }
                logger.info("Received predictive score payload from OpenRouter")
                return [payload]
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Predictive Scoring Error: {str(e)}")
            
        return []

    async def add_to_pipeline(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Pipeline cohort add request: %s", payload)
        entry = {
            "companyId": payload.get("companyId") or str(uuid.uuid4()),
            "companyName": payload.get("companyName") or "Unknown",
            "contactName": payload.get("contactName"),
            "similarityScore": float(payload.get("similarityScore") or 0),
            "addedAt": datetime.utcnow().isoformat() + "Z",
        }
        if not hasattr(self, "redis") or self.redis is None:
            try:
                self.redis = RedisManager.get_client()
            except Exception as exc:
                logger.warning("Redis unavailable while recording pipeline entry: %s", exc)
                self.redis = None
        if self.redis:
            try:
                await self.redis.lpush("ai:lookalike:pipeline", json.dumps(entry))
                await self.redis.ltrim("ai:lookalike:pipeline", 0, 99)
            except Exception as exc:
                logger.warning("Pipeline queue push failed: %s", exc)
        else:
            logger.warning("Redis client missing; pipeline entry only logged.")
        return {"message": "Added to pipeline", "entry": entry}
