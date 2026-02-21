import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class AiAgentsService:
    def __init__(self):
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY")
        self.tavily_api_key = os.getenv("TAVILY_API_KEY")
        self.serper_api_key = os.getenv("SERPER_API_KEY")
        self.openrouter_base_url = "https://openrouter.ai/api/v1"
        self.tavily_base_url = "https://api.tavily.com"
        
        if not self.openrouter_api_key:
            logger.warning("OPENROUTER_API_KEY not found in environment")
        if not self.serper_api_key:
            logger.warning("SERPER_API_KEY not found in environment. Serper-based search will fail.")
        if not self.tavily_api_key:
            logger.warning("TAVILY_API_KEY not found in environment. Tavily-based search will fail.")

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
            try:
                response = await client.post("https://google.serper.dev/search", headers=headers, json=payload)
                response.raise_for_status()
                return response.json().get("organic", [])
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

    async def _call_openrouter(self, model: str, messages: List[Dict[str, str]], temperature: float = 0.7) -> str:
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
            "temperature": temperature
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    f"{self.openrouter_base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                if response.status_code == 402:
                    logger.error("OpenRouter Error: Insufficient credits (402 Payment Required)")
                    from fastapi import HTTPException
                    raise HTTPException(status_code=402, detail="OpenRouter insufficient credits. Please top up your account.")
                
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
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

        if not candidates: return []

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
            response_raw = await self._call_openrouter("google/gemini-flash-1.5", [{"role": "user", "content": prompt}])
            try:
                # Cleanup markdown
                clean_json = response_raw.strip()
                if "```json" in clean_json:
                    clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                
                import uuid
                parsed = json.loads(clean_json)
                for item in parsed:
                    if "id" not in item or len(item["id"]) < 10:
                        item["id"] = str(uuid.uuid4())
                return parsed
            except Exception as e:
                logger.error(f"AI Batch Error: {str(e)}")
                return []

        # Process in batches of 10
        batches = [rich_data[i:i + 10] for i in range(0, len(rich_data), 10)]
        batch_results = await asyncio.gather(*(analyze_batch(b) for b in batches))
        final_results = [item for sublist in batch_results for item in sublist]

        # --- LAYER 6: CONSTRAINT ENFORCEMENT ---
        filtered = final_results
        if query_mode == "STRICT":
            filtered = [c for c in final_results if c.get("signals", {}).get("hiring") in ["Active", "Moderate"]]
        
        # Sort by score
        filtered.sort(key=lambda x: x.get("score", 0), reverse=True)

        return filtered

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

        # Step 2: Determine Model and Schema
        model = "perplexity/sonar-reasoning-pro"
        json_schema = ""

        if depth == "quick":
            model = "perplexity/sonar-pro"
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
        try:
            report_raw = await self._call_openrouter(model, [
                {"role": "system", "content": "Return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ], temperature=0.2)
            
            # JSON extraction
            import re
            match = re.search(r"\{[\s\S]*\}", report_raw)
            if match:
                return json.loads(match.group(0))
        except Exception as e:
            logger.error(f"Perplexity Search Error: {str(e)}")

        # Step 4: Fallback Format Repair via Gemini
        logger.info("Retrying with Gemini Format Repair...")
        repair_prompt = f"""
        Transform the following research text into STRICT JSON matching the schema.
        TEXT: {report_raw if 'report_raw' in locals() else 'No data found.'}
        SCHEMA: {json_schema}
        """
        try:
            repaired = await self._call_openrouter("google/gemini-flash-1.5", [{"role": "user", "content": repair_prompt}])
            match = re.search(r"\{[\s\S]*\}", repaired)
            if match:
                return json.loads(match.group(0))
        except:
            return {"error": "Failed to generate research report.", "companyName": company_name}

    async def find_lookalikes(self, seed_company_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Lookalike Agent:
        Finds companies similar to seeds by analyzing their industry, size, and tech stack.
        """
        seeds_str = ", ".join(seed_company_ids)
        prompt = f"""
        Act as a Market Research AI. Find 5 companies that are "Lookalikes" to: {seeds_str}.
        
        Perform a deep analysis based on:
        1. Patents and Core Technology.
        2. Academic Research and R&D Focus.
        3. Customer Reviews and Market Sentiment.
        
        Return a JSON array where each object has:
        - id (string)
        - companyName (string)
        - similarityScore (number 0-100)
        - matchingFactors (array of strings)
        - industry (string)
        - employees (string)
        - location (string)
        - revenue (string estimate)

        Return ONLY valid JSON array.
        """
        
        lookalikes_raw = await self._call_openrouter("google/gemini-flash-1.5", [{"role": "user", "content": prompt}], temperature=0.3)
        try:
            import re
            match = re.search(r"\[[\s\S]*\]", lookalikes_raw)
            if match:
                return json.loads(match.group(0))
            return []
        except Exception as e:
            logger.error(f"Lookalike Analysis Error: {str(e)}")
            return []

    async def predictive_scoring(self, company_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predictive Agent:
        1. Wikipedia Signal Extraction
        2. SEC EDGAR Verification (US Only)
        3. Unified Predictive Prompt (OpenRouter/Claude)
        """
        target = company_data.get("company") or {
            "name": "Stripe",
            "domain": "stripe.com",
            "industry": "Fintech",
            "country": "US"
        }
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

        try:
            scores_raw = await self._call_openrouter("anthropic/claude-3.5-sonnet", [{"role": "user", "content": prompt}], temperature=0.1)
            import re
            match = re.search(r"\{[\s\S]*\}", scores_raw)
            if match:
                return json.loads(match.group(0))
        except Exception as e:
            logger.error(f"Predictive Scoring Error: {str(e)}")
            
        return {"error": "Failed to score lead", "companyName": name}
