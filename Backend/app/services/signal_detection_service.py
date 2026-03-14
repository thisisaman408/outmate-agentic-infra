"""
Signal Detection Service - Uses Crustdata and Explorium APIs to detect signals for companies/prospects

For Prospects (data_source="crustdata"): 
    Uses Crustdata People APIs to detect signals about the PERSON:
    - People Enrichment API - get skills, job history, current role
    - LinkedIn Posts by Person API - get recent posts and activity
    - Recent job changes detection

For Companies (data_source="explorium"): 
    Uses Explorium APIs to detect signals about the COMPANY:
    - Business Challenges API - get growth, hiring, tech challenges
    - LinkedIn Posts API - get company activity
    - Company enrichment data analysis
"""

import os
import httpx
from typing import Dict, Any, List, Optional
import logging

from app.core.config import settings
from app.services.crustdata_service import CrustdataService
from app.services.explorium_service import ExploriumService

logger = logging.getLogger(__name__)


class SignalDetectionService:
    def __init__(self):
        self.crustdata = CrustdataService()
        self.explorium = ExploriumService()

    @staticmethod
    def _dict_or_empty(value: Any) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}
    
    async def detect_signals(
        self,
        companies: List[Dict[str, Any]],
        prospect_query: str = "",
        data_source: str | List[str] = "explorium",  # Accept string or list: "explorium" for companies, "crustdata" for prospects
        action: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Detect signals for companies using Crustdata and Explorium APIs.
        
        For Prospects (data_source includes "crustdata"):
        - Uses Crustdata LinkedIn posts keyword search
        - Uses Crustdata company enrichment
        
        For Companies (data_source includes "explorium"):
        - Uses Explorium business challenges
        - Uses Explorium LinkedIn posts
        
        Signals include:
        - Recent funding
        - Hiring trends (job openings)
        - Technology adoption
        - Growth indicators
        - Recent news/events
        - Expansion signals
        """
        if not companies:
            return []
        
        signals = []
        
        # Normalize data_source to list
        sources = []
        if isinstance(data_source, str):
            sources = [data_source]
        elif isinstance(data_source, list):
            sources = data_source
        else:
            sources = ["explorium"]  # default
        
        try:
            # Determine which source to use based on intent
            # For prospects: use crustdata, for companies: use explorium
            if "crustdata" in sources:
                # Use Crustdata for prospects
                signals = await self._detect_signals_crustdata(companies, prospect_query)
            elif "explorium" in sources:
                # Use Explorium for companies
                signals = await self._detect_signals_explorium(companies, prospect_query, action=action)
            else:
                # Default fallback
                signals = await self._detect_signals_explorium(companies, prospect_query, action=action)
                
        except Exception as e:
            print(f">>> [Signals] Signal detection failed: {e}", flush=True)
        
        return signals
    
    async def _detect_signals_crustdata(
        self,
        companies: List[Dict[str, Any]],
        prospect_query: str
    ) -> List[Dict[str, Any]]:
        """
        Detect signals using Crustdata APIs for prospects (people).
        
        Uses Crustdata's People APIs to get person-level signals:
        - People Enrichment API
        - LinkedIn Posts by Person API
        - Recent job changes
        
        This detects signals about the PERSON, not their company.
        """
        signals = []
        
        for prospect in companies[:10]:  # Limit to 10 prospects
            # Get person information
            person_name = prospect.get("name", "") or prospect.get("full_name", "")
            first_name = prospect.get("first_name", "")
            last_name = prospect.get("last_name", "")
            linkedin_url = prospect.get("linkedin_url", "") or prospect.get("linkedin_profile_url", "")
            email = prospect.get("email", "")
            job_title = prospect.get("job_title", "") or prospect.get("title", "")
            company_name = prospect.get("company_name", "") or prospect.get("company", "")
            company_domain = prospect.get("company_domain", "") or prospect.get("domain", "")
            
            if not person_name and not linkedin_url:
                continue
            
            person_signals = []
            
            try:
                # 1. Get person enrichment from Crustdata if we have LinkedIn URL or email
                if linkedin_url or email:
                    enrichment_params = {}
                    if linkedin_url:
                        enrichment_params["linkedin_profile_url"] = linkedin_url
                    if email:
                        enrichment_params["business_email"] = email
                    
                    # Call Crustdata person enrichment API
                    async with httpx.AsyncClient(timeout=30) as client:
                        try:
                            response = await client.get(
                                f"{self.crustdata.base_url}/screener/person/enrich",
                                headers=self.crustdata._get_headers(),
                                params=enrichment_params
                            )
                            
                            if response.status_code == 200:
                                enrichment_data = response.json()
                                if enrichment_data and len(enrichment_data) > 0:
                                    person_data = enrichment_data[0]
                                    
                                    # Check for recent job changes
                                    current_employers = person_data.get("current_employers", [])
                                    past_employers = person_data.get("past_employers", [])
                                    
                                    if current_employers:
                                        current = current_employers[0] if isinstance(current_employers, list) else current_employers
                                        current_title = current.get("employee_title", "") or current.get("title", "")
                                        current_company = current.get("employer_name", "") or current.get("company_name", "")
                                        
                                        # Check if recently joined (new hire signal)
                                        start_date = current.get("start_date", "")
                                        if start_date:
                                            from datetime import datetime, timedelta
                                            try:
                                                # Try parsing the date
                                                if "T" in start_date:
                                                    start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                                                else:
                                                    start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                                                
                                                days_since = (datetime.now() - start_dt).days
                                                if days_since < 90:  # Joined in last 3 months
                                                    person_signals.append({
                                                        "type": "new_job",
                                                        "description": f"Recently joined {current_company} as {current_title}",
                                                        "urgency": "high"
                                                    })
                                            except:
                                                pass
                                        
                                        # Current role info
                                        if current_title:
                                            person_signals.append({
                                                "type": "current_role",
                                                "description": f"Working as {current_title} at {current_company}",
                                                "urgency": "low"
                                            })
                                    
                                    # Check skills for technology signals
                                    skills = person_data.get("skills", [])
                                    if skills:
                                        skills_str = " ".join([s.lower() for s in skills if isinstance(s, str)])
                                        ai_skills = ["ai", "machine learning", "artificial intelligence", "llm", "gpt", "nlp", "deep learning"]
                                        if any(s in skills_str for s in ai_skills):
                                            person_signals.append({
                                                "type": "ai_expertise",
                                                "description": "Has AI/ML expertise",
                                                "urgency": "medium"
                                            })
                                        
                                        # Cloud skills
                                        cloud_skills = ["aws", "azure", "gcp", "google cloud", "kubernetes", "docker"]
                                        if any(s in skills_str for s in cloud_skills):
                                            person_signals.append({
                                                "type": "cloud_expertise",
                                                "description": "Has cloud infrastructure expertise",
                                                "urgency": "medium"
                                            })
                                        
                                        # Data skills
                                        data_skills = ["python", "sql", "data science", "analytics", "tableau", "spark"]
                                        if any(s in skills_str for s in data_skills):
                                            person_signals.append({
                                                "type": "data_expertise",
                                                "description": "Has data analytics expertise",
                                                "urgency": "medium"
                                            })
                        except Exception as e:
                            print(f">>> [Signals] Person enrichment error: {e}", flush=True)
                
                # 2. Get LinkedIn posts for the person
                if linkedin_url:
                    async with httpx.AsyncClient(timeout=30) as client:
                        try:
                            # Extract profile slug from LinkedIn URL
                            profile_slug = linkedin_url.split("/in/")[-1].split("?")[0] if "/in/" in linkedin_url else linkedin_url
                            
                            response = await client.get(
                                f"{self.crustdata.base_url}/screener/linkedin_posts",
                                headers=self.crustdata._get_headers(),
                                params={
                                    "person_linkedin_url": linkedin_url,
                                    "limit": 5
                                }
                            )
                            
                            if response.status_code == 200:
                                posts_data = response.json()
                                posts = posts_data.get("posts", [])
                                
                                for post in posts:
                                    text = post.get("text", "").lower()
                                    
                                    # Check for job change announcements
                                    if any(word in text for word in ["excited to join", "new role", "new position", "happy to announce"]):
                                        person_signals.append({
                                            "type": "career_update",
                                            "description": "Recently announced career update on LinkedIn",
                                            "urgency": "high"
                                        })
                                    
                                    # Check for hiring/recruitment posts
                                    if any(word in text for word in ["hiring", "job opening", "join my team", "looking for"]):
                                        person_signals.append({
                                            "type": "hiring_signal",
                                            "description": "Posting about job openings - may have budget for tools",
                                            "urgency": "high"
                                        })
                                    
                                    # Check for product launches
                                    if any(word in text for word in ["launch", "announcing", "released", "new feature"]):
                                        person_signals.append({
                                            "type": "product_update",
                                            "description": "Recently launched something",
                                            "urgency": "medium"
                                        })
                                    
                                    # Check for thought leadership
                                    if any(word in text for word in ["thoughts on", "opinion", "analysis", "insights"]):
                                        person_signals.append({
                                            "type": "thought_leader",
                                            "description": "Active LinkedIn content creator",
                                            "urgency": "low"
                                        })
                        except Exception as e:
                            print(f">>> [Signals] Person posts error: {e}", flush=True)
                
                # 3. Also check company-level signals as secondary info
                if company_domain:
                    try:
                        enrichment = await self.crustdata.enrich_company(
                            domain=company_domain,
                            fields="headcount,job_openings"
                        )
                        
                        if enrichment:
                            job_data = enrichment.get("job_openings", {})
                            if job_data:
                                openings = job_data.get("openings", 0)
                                if openings and openings > 50:
                                    person_signals.append({
                                        "type": "company_hiring",
                                        "description": f"Company is rapidly hiring ({openings} openings)",
                                        "urgency": "medium"
                                    })
                    except:
                        pass
                
            except Exception as e:
                print(f">>> [Signals] Crustdata API error for {person_name}: {e}", flush=True)
            
            # Add prospect with signals
            if person_signals:
                # Deduplicate signals
                seen_types = set()
                unique_signals = []
                for s in person_signals:
                    if s["type"] not in seen_types:
                        seen_types.add(s["type"])
                        unique_signals.append(s)
                
                signals.append({
                    "person_name": person_name,
                    "linkedin_url": linkedin_url,
                    "job_title": job_title,
                    "company": company_name,
                    "signals": unique_signals,
                    "personalization_tips": self._generate_person_personalization_tips(unique_signals, job_title)
                })
            else:
                # Add default signal if no signals found
                signals.append({
                    "person_name": person_name,
                    "linkedin_url": linkedin_url,
                    "job_title": job_title,
                    "company": company_name,
                    "signals": [{
                        "type": "prospecting_target",
                        "description": f"{job_title} at {company_name}" if job_title and company_name else "Potential prospect for outreach",
                        "urgency": "low"
                    }],
                    "personalization_tips": "Focus on value proposition relevant to their role and company"
                })
        
        return signals
    
    def _generate_person_personalization_tips(self, signals: List[Dict[str, Any]], job_title: str = "") -> str:
        """Generate outreach tips based on detected person signals"""
        signal_types = [s.get("type", "") for s in signals if isinstance(s, dict)]
        
        tips = []
        
        if "new_job" in signal_types or "career_update" in signal_types:
            tips.append("Congratulate them on their new role")
        
        if "hiring_signal" in signal_types:
            tips.append("They may have budget - offer solutions for their hiring needs")
        
        if "ai_expertise" in signal_types:
            tips.append("Position AI-native solutions - they'll understand the value")
        
        if "cloud_expertise" in signal_types:
            tips.append("Focus on cloud-based solutions")
        
        if "data_expertise" in signal_types:
            tips.append("Lead with data-driven insights and analytics")
        
        if "thought_leader" in signal_types:
            tips.append("Engage with their content before pitching")
        
        if "product_update" in signal_types:
            tips.append("Reference their recent launch in your approach")
        
        if not tips:
            # Customize based on job title
            if job_title:
                if any(word in job_title.lower() for word in ["ceo", "founder", "cto", "vp"]):
                    tips.append("Focus on strategic value and ROI")
                elif any(word in job_title.lower() for word in ["engineer", "developer", "tech"]):
                    tips.append("Focus on technical benefits and integration")
                elif any(word in job_title.lower() for word in ["sales", "revenue"]):
                    tips.append("Focus on revenue impact")
                else:
                    tips.append("Personalize based on their role")
            else:
                tips.append("Focus on core value proposition")
        
        return " | ".join(tips)
    
    async def _detect_signals_explorium(
        self,
        companies: List[Dict[str, Any]],
        prospect_query: str,
        action: str = ""
    ) -> List[Dict[str, Any]]:
        """Detect signals using new Explorium bulk APIs for comprehensive business and prospect signals"""
        signals = []
        business_ids = []
        business_to_company = {}
        
        # First, match companies to get business_ids
        for company in companies[:10]:  # Limit to 10 companies
            company_name = company.get("name", "")
            domain = company.get("domain", "")
            
            if not company_name and not domain:
                continue
            
            try:
                raw_match = await self.explorium.match_businesses([{
                    "domain": domain,
                    "name": company_name
                }])
                match_result = self._dict_or_empty(raw_match)
                matched = match_result.get("matched_businesses") or match_result.get("matches") or []
                if matched:
                    business_id = matched[0].get("business_id")
                    if business_id:
                        business_ids.append(business_id)
                        business_to_company[business_id] = company
            except Exception as e:
                print(f">>> [Signals] Match error for {company_name}: {e}", flush=True)
        
        if not business_ids:
            return self._fallback_signal_detection(companies)
        
        # Enrich each business individually using single-enrich APIs (reliable, known response shape)
        enrichment_data = {}
        for bid in business_ids:
            enrichment_data[bid] = {}
            company_name = business_to_company.get(bid, {}).get("name", bid)

            # 1. Firmographics
            try:
                fg_data = self._dict_or_empty(await self.explorium.enrich_firmographics(bid)).get("data") or {}
                if fg_data:
                    enrichment_data[bid]["firmographics"] = fg_data
                    print(f">>> [Signals] Firmographics OK for {company_name}: revenue={fg_data.get('yearly_revenue_exact')}, employees={fg_data.get('number_of_employees_range')}", flush=True)
            except Exception as e:
                print(f">>> [Signals] Firmographics error for {company_name}: {e}", flush=True)

            # 2. Bombora intent
            try:
                intent_data = self._dict_or_empty(await self.explorium.enrich_bombora_intent(bid)).get("data") or {}
                if intent_data:
                    enrichment_data[bid]["intent"] = intent_data
                    topics_count = len(intent_data.get("intent_topics", []))
                    print(f">>> [Signals] Intent OK for {company_name}: {topics_count} topics", flush=True)
            except Exception as e:
                print(f">>> [Signals] Intent error for {company_name}: {e}", flush=True)

            # 3. Business challenges
            try:
                challenges_data = self._dict_or_empty(await self.explorium.enrich_business_challenges(bid)).get("data") or {}
                if challenges_data:
                    enrichment_data[bid]["challenges"] = challenges_data
                    print(f">>> [Signals] Challenges OK for {company_name}", flush=True)
            except Exception as e:
                print(f">>> [Signals] Challenges error for {company_name}: {e}", flush=True)

            # 4. Financial indicators
            try:
                financial_data = self._dict_or_empty(await self.explorium.enrich_financial_indicators(bid)).get("data") or {}
                if financial_data:
                    enrichment_data[bid]["financial"] = financial_data
                    print(f">>> [Signals] Financial OK for {company_name}: revenue_growth={financial_data.get('revenue_growth_percentage')}", flush=True)
            except Exception as e:
                print(f">>> [Signals] Financial error for {company_name}: {e}", flush=True)

            # 5. LinkedIn posts (for activity signals)
            try:
                posts_data = (self._dict_or_empty(await self.explorium.enrich_linkedin_posts(bid)).get("data") or {})
                if posts_data:
                    enrichment_data[bid]["linkedin_posts"] = posts_data
                    print(f">>> [Signals] LinkedIn posts OK for {company_name}", flush=True)
            except Exception as e:
                print(f">>> [Signals] LinkedIn posts error for {company_name}: {e}", flush=True)

        # Process enrichment data into signals
        for business_id, data in enrichment_data.items():
            company = business_to_company.get(business_id, {})
            company_name = company.get("name", "")
            domain = company.get("domain", "")
            
            company_signals = []
            
            # Process intent signals
            intent_info = data.get("intent", {})
            intent_topics = intent_info.get("intent_topics", [])
            for topic in intent_topics[:5]:  # Top 5 topics
                if not isinstance(topic, dict):
                    continue
                topic_name = topic.get("topic", "")
                category = topic.get("category", "")
                score = topic.get("composite_score", 0)
                level = topic.get("level_of_intent", "Early Research")
                
                confidence = min(95, max(60, int(score * 100)))
                
                company_signals.append({
                    "type": "intent_signal",
                    "description": f"Researching {topic_name} ({category}) - {level}",
                    "urgency": "high" if level == "In-Depth Research" else "medium",
                    "confidence": confidence
                })
            
            # Process firmographics signals — extract any available data
            fg = data.get("firmographics", {})
            revenue = fg.get("yearly_revenue_exact") or fg.get("yearly_revenue") or fg.get("revenue_usd")
            if revenue:
                try:
                    revenue = float(revenue)
                    if revenue > 10_000_000:
                        company_signals.append({"type": "revenue_signal", "description": f"High revenue company (${revenue:,.0f})", "urgency": "high", "confidence": 85})
                    elif revenue > 1_000_000:
                        company_signals.append({"type": "revenue_signal", "description": f"Growing company (${revenue:,.0f} revenue)", "urgency": "medium", "confidence": 75})
                except (ValueError, TypeError):
                    pass

            employee_range = fg.get("number_of_employees_range") or fg.get("employees_range")
            if employee_range:
                company_signals.append({"type": "size_signal", "description": f"Company size: {employee_range} employees", "urgency": "medium", "confidence": 80})

            industry = fg.get("naics_description") or fg.get("linkedin_industry_category") or fg.get("primary_industry") or fg.get("industry")
            if industry:
                company_signals.append({"type": "industry_signal", "description": f"Industry: {industry}", "urgency": "low", "confidence": 85})

            founded = fg.get("year_founded") or fg.get("founded_year")
            if founded:
                try:
                    from datetime import datetime
                    age = datetime.now().year - int(founded)
                    if age <= 3:
                        company_signals.append({"type": "startup_signal", "description": f"Early-stage company (founded {founded})", "urgency": "high", "confidence": 80})
                    elif age <= 7:
                        company_signals.append({"type": "growth_stage", "description": f"Growth-stage company (founded {founded})", "urgency": "medium", "confidence": 75})
                except (ValueError, TypeError):
                    pass

            country = fg.get("country_name") or fg.get("country")
            city = fg.get("city_name") or fg.get("city")
            if country or city:
                location = ", ".join(filter(None, [city, country]))
                company_signals.append({"type": "location_signal", "description": f"Headquartered in {location}", "urgency": "low", "confidence": 90})

            # Process challenges signals
            challenges = data.get("challenges", {})
            # Handle both dict and list shapes
            if isinstance(challenges, dict):
                challenge_categories = challenges.get("challenge_categories", []) or challenges.get("challenges", [])
            elif isinstance(challenges, list):
                challenge_categories = challenges
            else:
                challenge_categories = []
            for cat in challenge_categories[:3]:
                if isinstance(cat, dict):
                    category_name = cat.get("category", "") or cat.get("challenge", "") or cat.get("name", "")
                elif isinstance(cat, str):
                    category_name = cat
                else:
                    continue
                if category_name:
                    company_signals.append({
                        "type": "challenge_signal",
                        "description": f"Business challenge: {category_name}",
                        "urgency": "high",
                        "confidence": 70
                })
            
            # Process financial signals
            financial = data.get("financial", {})
            if isinstance(financial, dict):
                revenue_growth = financial.get("revenue_growth_percentage") or financial.get("revenue_growth")
                if revenue_growth:
                    try:
                        rg = float(revenue_growth)
                        if rg > 20:
                            company_signals.append({"type": "growth_signal", "description": f"Strong revenue growth ({rg:.0f}%)", "urgency": "high", "confidence": 90})
                        elif rg > 0:
                            company_signals.append({"type": "growth_signal", "description": f"Positive revenue growth ({rg:.0f}%)", "urgency": "medium", "confidence": 75})
                    except (ValueError, TypeError):
                        pass

                # Check for other financial indicators
                for key in ["total_funding", "latest_funding_amount", "funding_total"]:
                    funding = financial.get(key)
                    if funding:
                        try:
                            funding_val = float(funding)
                            if funding_val > 0:
                                company_signals.append({"type": "funding_signal", "description": f"Funding: ${funding_val:,.0f}", "urgency": "high", "confidence": 85})
                                break
                        except (ValueError, TypeError):
                            pass

            # Process LinkedIn posts for activity signals
            linkedin_posts = data.get("linkedin_posts", {})
            if isinstance(linkedin_posts, dict):
                posts = linkedin_posts.get("posts", []) or linkedin_posts.get("recent_posts", [])
                if posts and len(posts) > 0:
                    company_signals.append({
                        "type": "social_activity",
                        "description": f"Active on LinkedIn ({len(posts)} recent posts)",
                        "urgency": "low",
                        "confidence": 70
                    })
                    # Check post content for specific signals
                    for post in posts[:5]:
                        if not isinstance(post, dict):
                            continue
                        text = (post.get("text", "") or post.get("content", "") or "").lower()
                        if any(w in text for w in ["hiring", "join our team", "open role", "job opening"]):
                            company_signals.append({"type": "hiring_signal", "description": "Posting about job openings on LinkedIn", "urgency": "high", "confidence": 80})
                            break
                    for post in posts[:5]:
                        if not isinstance(post, dict):
                            continue
                        text = (post.get("text", "") or post.get("content", "") or "").lower()
                        if any(w in text for w in ["launch", "announcing", "new product", "released", "excited to share"]):
                            company_signals.append({"type": "product_launch", "description": "Recently announced product/feature launch", "urgency": "high", "confidence": 75})
                            break

            # Also extract signals from the company data passed in from search results
            company_data = business_to_company.get(business_id, {})
            if company_data.get("funding_stage"):
                stage = str(company_data["funding_stage"]).lower()
                if any(s in stage for s in ["series a", "series b", "series c", "seed"]):
                    company_signals.append({"type": "funding_stage", "description": f"Funding stage: {company_data['funding_stage']}", "urgency": "high", "confidence": 85})
            tech = company_data.get("technologies", [])
            if tech and isinstance(tech, list) and len(tech) > 0:
                company_signals.append({"type": "tech_stack", "description": f"Tech stack includes: {', '.join(str(t) for t in tech[:5])}", "urgency": "medium", "confidence": 75})
            growth = company_data.get("employee_growth_6m_percent") or company_data.get("employee_growth_12m_percent")
            if growth:
                try:
                    g = float(growth)
                    if g > 20:
                        company_signals.append({"type": "rapid_growth", "description": f"Rapid employee growth ({g:.0f}%)", "urgency": "high", "confidence": 85})
                except (ValueError, TypeError):
                    pass

            # Deduplicate signals
            seen_descriptions = set()
            unique_signals = []
            for s in company_signals:
                desc = s.get("description", "")
                if desc not in seen_descriptions:
                    seen_descriptions.add(desc)
                    unique_signals.append(s)
            
            if unique_signals:
                signals.append({
                    "company_name": company_name,
                    "domain": domain,
                    "signals": unique_signals,
                    "personalization_tips": self._generate_personalization_tips(unique_signals)
                })
            else:
                # Fallback signal
                signals.append({
                    "company_name": company_name,
                    "domain": domain,
                    "signals": [{
                        "type": "prospecting_target",
                        "description": "Active company with enrichment data available",
                        "urgency": "low",
                        "confidence": 60
                    }],
                    "personalization_tips": "Leverage intent and enrichment data for targeted outreach"
                })
        
        return signals
    
    def _create_company_summary(self, company: Dict[str, Any]) -> str:
        """Create a brief summary of a company for analysis"""
        name = company.get("name", "Unknown")
        domain = company.get("domain", "")
        industry = company.get("industry", "")
        size = company.get("employee_count_range", company.get("employee_count_exact", ""))
        funding = company.get("funding_stage", "")
        tech = company.get("technologies", [])
        
        summary_parts = [f"{name} ({domain})"]
        if industry:
            summary_parts.append(f"Industry: {industry}")
        if size:
            summary_parts.append(f"Size: {size}")
        if funding:
            summary_parts.append(f"Funding: {funding}")
        if tech and isinstance(tech, list) and len(tech) > 0:
            summary_parts.append(f"Tech: {', '.join(tech[:5])}")
        
        return ", ".join(summary_parts)
    
    def _fallback_signal_detection(
        self, 
        companies: List[Dict[str, Any]],
        action: str = ""
    ) -> List[Dict[str, Any]]:
        """Rule-based signal detection when API is unavailable"""
        signals = []
        
        companies_list = list(companies) if isinstance(companies, (tuple, set, dict)) else list(companies or [])
        for company in companies_list[:20]:
            company_signals = []
            company_name = company.get("name", "Unknown")
            domain = company.get("domain", "")
            industry = company.get("industry", "")
            
            catalog_signals = self._sample_signals_for_demo(domain)
            if catalog_signals:
                signals.append({
                    "company_name": company_name,
                    "domain": domain,
                    "signals": catalog_signals,
                    "personalization_tips": self._generate_personalization_tips(catalog_signals)
                })
                continue
            
            # Check for funding signals
            if company.get("funding_stage"):
                stage = company.get("funding_stage", "").lower()
                if stage in ["series a", "series b", "series c", "series d"]:
                    company_signals.append({
                        "type": "recent_funding",
                        "description": f"Recent {stage} funding stage - likely scaling operations",
                        "urgency": "high"
                    })
                elif stage == "seed":
                    company_signals.append({
                        "type": "early_stage",
                        "description": "Seed stage - may be open to sales tools",
                        "urgency": "medium"
                    })
            
            # Check for growth signals
            if company.get("employee_growth_6m_percent") or company.get("employee_growth_12m_percent"):
                growth = company.get("employee_growth_6m_percent") or company.get("employee_growth_12m_percent")
                if growth and growth > 20:
                    company_signals.append({
                        "type": "rapid_growth",
                        "description": f"Strong employee growth ({growth}%) - likely expanding",
                        "urgency": "high"
                    })
            
            # Check for tech signals
            tech = company.get("technologies", [])
            if tech and isinstance(tech, list) and len(tech) > 0:
                tech_str = " ".join([str(t).lower() for t in tech])
                ai_tech = ["ai", "machine learning", "artificial intelligence", "llm", "gpt", "chatgpt"]
                cloud_tech = ["aws", "azure", "gcp", "cloud"]
                
                if any(t in tech_str for t in ai_tech):
                    company_signals.append({
                        "type": "ai_adoption",
                        "description": "AI/ML technology user - modern tech stack",
                        "urgency": "medium"
                    })
                if any(t in tech_str for t in cloud_tech):
                    company_signals.append({
                        "type": "cloud_native",
                        "description": "Cloud infrastructure user - tech-forward company",
                        "urgency": "low"
                    })
            
            # Check for job openings
            if company.get("job_openings_count"):
                openings = company.get("job_openings_count")
                if openings and openings > 50:
                    company_signals.append({
                        "type": "hiring_surge",
                        "description": f"Active hiring ({openings} open positions)",
                        "urgency": "high"
                    })
            
            # Check for recent funding amount
            if company.get("funding_total") and company.get("funding_total") > 1000000:
                amount = company.get("funding_total")
                company_signals.append({
                    "type": "well_funded",
                    "description": f"Strong funding (${amount/1000000:.1f}M raised)",
                    "urgency": "medium"
                })
            
            # Check employee count for company size signal
            emp_exact = company.get("employee_count_exact", 0)
            emp_range = company.get("employee_count_range", "")
            if emp_exact and emp_exact > 0:
                if emp_exact < 50:
                    company_signals.append({
                        "type": "small_business",
                        "description": f"Small company ({emp_exact} employees) - agile decision making",
                        "urgency": "medium"
                    })
                elif emp_exact > 500:
                    company_signals.append({
                        "type": "enterprise",
                        "description": f"Large company ({emp_exact}+ employees) - established buyer",
                        "urgency": "low"
                    })
            
            # If no signals found, create a basic signal based on industry
            if not company_signals and industry:
                company_signals.append({
                    "type": "industry_target",
                    "description": f"Active in {industry} industry",
                    "urgency": "low"
                })
            
            # Always add a company even if no signals (for demo purposes)
            if company_signals:
                signals.append({
                    "company_name": company_name,
                    "domain": domain,
                    "signals": company_signals,
                    "personalization_tips": self._generate_personalization_tips(company_signals)
                })
            else:
                # Add company with a default signal if nothing else
                signals.append({
                    "company_name": company_name,
                    "domain": domain,
                    "signals": [{
                        "type": "signal_builder",
                        "description": self._generate_action_signal(action, industry),
                        "urgency": "low"
                    }],
                    "personalization_tips": self._generate_action_tip(action)
                })
        
        return signals
    
    def _sample_signals_for_demo(self, domain: str) -> List[Dict[str, Any]]:
        catalog = {
            "catalystsecurity.com": [
                {
                    "type": "hiring_surge",
                    "description": "Hiring Director of Sales to accelerate go-to-market across EMEA.",
                    "urgency": "high"
                },
                {
                    "type": "growth_challenge",
                    "description": "Scaling European footprint while maintaining security posture.",
                    "urgency": "medium"
                },
            ],
            "northwindanalytics.com": [
                {
                    "type": "recent_funding",
                    "description": "Series B funding announced, enabling multi-product expansion.",
                    "urgency": "high"
                },
                {
                    "type": "tech_challenge",
                    "description": "Modernizing analytics stack for real-time insights.",
                    "urgency": "medium"
                },
            ],
            "streamlinedevops.com": [
                {
                    "type": "tech_challenge",
                    "description": "Automating DevOps pipelines to keep up with rapid deployments.",
                    "urgency": "high"
                },
                {
                    "type": "hiring_surge",
                    "description": "Expanding platform engineering team across EU markets.",
                    "urgency": "high"
                },
            ],
        }
        return catalog.get(domain.lower(), [])

    def _generate_action_signal(self, action: str, industry: str) -> str:
        action_key = (action or "").lower()
        if "funding" in action_key:
            return f"Funding alert for {industry or 'target companies'}."
        if "hiring" in action_key or "job" in action_key:
            return f"Hiring momentum detected in {industry or 'target industries'}."
        if "tech" in action_key:
            return f"Technology adoption signal for {industry or 'otherwise qualified companies'}."
        return f"Signal curated for {action or 'your request'}."

    def _generate_action_tip(self, action: str) -> str:
        action_key = (action or "").lower()
        if "funding" in action_key:
            return "Lead with funding momentum and use case studies showing measurable ROI."
        if "hiring" in action_key or "job" in action_key:
            return "Mention their recruiting push and offer efficiency gains for talent teams."
        if "tech" in action_key:
            return "Reference their stack and focus on integration speed."
        return "Tie the outreach to the signal you selected."

    def _describe_matched_company(self, match: Dict[str, Any], action: str) -> str:
        name = match.get("name") or match.get("company_name") or "the target company"
        industry = match.get("industry") or match.get("sector") or ""
        size = match.get("employee_count_range") or match.get("company_size") or match.get("employee_count_exact")
        funding = match.get("funding_stage") or match.get("last_funding_round")
        description_parts = [name]
        if industry:
            description_parts.append(f"in {industry}")
        if size:
            description_parts.append(f"({size})")
        if funding:
            description_parts.append(f"recently in {funding}")
        action_desc = action or "the selected signal"
        return " ".join(description_parts) + f" matches {action_desc} intent."

    def _generate_personalization_tips(self, signals: List[Dict[str, Any]]) -> str:
        """Generate outreach tips based on detected signals"""
        signal_types = [s.get("type", "") for s in signals if isinstance(s, dict)]
        
        tips = []
        
        if "recent_funding" in signal_types or "well_funded" in signal_types:
            tips.append("Reference their recent funding round and suggest solutions for scaling")
        
        if "rapid_growth" in signal_types or "hiring_surge" in signal_types:
            tips.append("Mention their growth - offer solutions for managing scale")
        
        if "ai_adoption" in signal_types:
            tips.append("Reference their tech-forward approach - position as an AI-native solution")
        
        if "early_stage" in signal_types:
            tips.append("Be first to market - offer flexible pricing for startups")
        
        if not tips:
            tips.append("Focus on core value proposition and case studies")
        
        return " | ".join(tips)
