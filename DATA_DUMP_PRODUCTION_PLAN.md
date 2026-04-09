# Data Dump Feature - Enterprise-Scale Production Plan
**Version**: 2.0 - Agent-Based Automation Pipeline  
**Date**: March 24, 2026  
**Scale**: Enterprise (100K-1M+ prospects/month, refreshed daily)  
**Architecture**: Multi-agent scraping pipeline with daily automation  
**Storage**: Azure Blob Storage (Production) + Direct DB ingestion

---

## OVERVIEW

This plan implements an **automated multi-source data scraping pipeline** using:
- **30+ free/public data sources** across prospects & companies
- **15+ company data sources** (Crunchbase, Apollo, Hunter, etc.)
- **12+ prospect sources** (Indeed, LinkedIn, GitHub, Reddit, etc.)
- **Agent-based orchestration** (each source gets dedicated scraper agent)
- **Daily scheduled pipelines** running at 00:00 UTC, 06:00 UTC, 12:00 UTC
- **Bulk processing** (100K+ records/day)
- **Direct production storage** (Azure Blob + PostgreSQL)
- **Configuration-driven** (no code changes for source updates)
- **Fault tolerance & retry logic** (auto-restart failed agents)

---

## 1. DATA SOURCES INVENTORY

### 1.1 COMPANY DATA SOURCES (15+ sources)

| Priority | Source | API Type | Volume/Day | Quality | Freshness | Effort |
|----------|--------|----------|---|---------|-----------|--------|
| **P0** | **Crunchbase Free Export** | CSV/JSON | 500-1K | 95% | Monthly | Low |
| **P0** | **Apollo.io Free Tier** | API | 1K-2K | 90% | Daily | Medium |
| **P0** | **Hunter.io Free** | API | 800-1.5K | 85% | Daily | Medium |
| **P1** | **LinkedIn Company Pages** | Scrape | 2K-3K | 70% | Real-time | High |
| **P1** | **G2 Reviews** | Scrape | 500-800 | 75% | Weekly | Medium |
| **P1** | **GitHub Company Repos** | API | 300-500 | 60% | Real-time | Low |
| **P2** | **SEC Edgar (10-K/10-Q)** | Scrape | 100-200 | 95% | Quarterly | High |
| **P2** | **Company House (UK)** | Scrape | 200-300 | 90% | Weekly | Medium |
| **P2** | **Tech Stack Analysis** | API | 800-1.5K | 55% | Daily | Low |
| **P2** | **SimilarWeb** | Scrape | 300-500 | 65% | Weekly | High |
| **P3** | **Owler (Company Intelligence)** | API | 200-400 | 70% | Weekly | Medium |
| **P3** | **PitchBook** | Scrape | 50-100 | 88% | Monthly | High |
| **P3** | **Glassdoor Company Data** | Scrape | 400-600 | 60% | Weekly | High |
| **P3** | **Indeed Company Reviews** | Scrape | 500-800 | 55% | Daily | Medium |
| **P4** | **Angel List** | API | 300-500 | 75% | Weekly | Low |

**Monthly Volume from Company Sources**: 15K-25K companies

### 1.2 PROSPECT DATA SOURCES (12+ sources)

| Priority | Source | API Type | Volume/Day | Quality | Freshness | Effort |
|----------|--------|----------|---|---------|-----------|--------|
| **P0** | **Indeed Job Postings** | Scrape | 1.5K-2.5K | 75% | Real-time | Low |
| **P0** | **LinkedIn Job Posts** | Scrape | 1K-2K | 70% | Real-time | High |
| **P1** | **GitHub Developers** | API | 800-1.2K | 60% | Real-time | Low |
| **P1** | **Dev.to Technical Writers** | API | 200-400 | 65% | Weekly | Low |
| **P1** | **Stack Overflow Profiles** | Scrape | 500-1K | 50% | Real-time | Medium |
| **P2** | **Twitter/X Tech Profiles** | API | 2K-3K | 45% | Real-time | Medium |
| **P2** | **Reddit Job/Career Posts** | Scrape | 500-800 | 40% | Daily | Low |
| **P2** | **Hacker News Comments** | Scrape | 300-600 | 50% | Real-time | Low |
| **P3** | **GitHub Issues/PRs** | API | 1K-2K | 55% | Real-time | Low |
| **P3** | **Medium Authors** | Scrape | 300-500 | 55% | Daily | Low |
| **P4** | **ProductHunt Makers** | Scrape | 100-200 | 60% | Weekly | Low |
| **P4** | **Research Gate Profiles** | Scrape | 200-400 | 65% | Monthly | Medium |

**Monthly Volume from Prospect Sources**: 50K-100K prospects

---

## 2. AGENT-BASED ARCHITECTURE

### 2.1 Scraper Agent Pattern

Each data source gets a **dedicated agent** (independent microservice/worker):

```python
# Backend/app/agents/scraper_agent.py (Base Class)

from abc import ABC, abstractmethod
from enum import Enum
import logging

class SourcePriority(Enum):
    P0 = "critical"
    P1 = "high"
    P2 = "medium"
    P3 = "low"
    P4 = "backlog"

class ScraperAgent(ABC):
    """Base class for all scraper agents"""
    
    # Must be overridden by each agent
    SOURCE_NAME: str = "base"
    SOURCE_URL: str = ""
    PRIORITY: SourcePriority = SourcePriority.P2
    DATA_TYPE: str = "prospect"  # or "company" or "mixed"
    REFRESH_INTERVAL_HOURS: int = 24
    MAX_RECORDS_PER_RUN: int = 1000
    
    def __init__(self, config: dict):
        self.config = config
        self.logger = logging.getLogger(self.SOURCE_NAME)
        self.start_time = None
        self.end_time = None
        self.records_scraped = 0
        self.errors = []
    
    @abstractmethod
    async def authenticate(self):
        """Authenticate with the data source"""
        pass
    
    @abstractmethod
    async def fetch_data(self) -> List[dict]:
        """Fetch data from source. Return raw records"""
        pass
    
    @abstractmethod
    async def normalize_data(self, raw_records: List[dict]) -> List[dict]:
        """Normalize to standard schema"""
        pass
    
    async def run(self) -> dict:
        """Main execution pipeline"""
        
        self.start_time = datetime.now()
        
        try:
            # Step 1: Authenticate
            await self.authenticate()
            
            # Step 2: Fetch raw data
            raw_data = await self.fetch_data()
            self.logger.info(f"Fetched {len(raw_data)} raw records")
            
            # Step 3: Normalize to standard schema
            normalized = await self.normalize_data(raw_data)
            self.records_scraped = len(normalized)
            
            # Step 4: Save to storage (handled by pipeline manager)
            self.end_time = datetime.now()
            
            return {
                "status": "success",
                "agent": self.SOURCE_NAME,
                "records": normalized,
                "records_count": len(normalized),
                "duration_seconds": (self.end_time - self.start_time).total_seconds(),
                "errors": self.errors
            }
        
        except Exception as e:
            self.logger.error(f"Agent failed: {e}", exc_info=True)
            self.end_time = datetime.now()
            
            return {
                "status": "failed",
                "agent": self.SOURCE_NAME,
                "error": str(e),
                "duration_seconds": (self.end_time - self.start_time).total_seconds()
            }
```

### 2.2 Concrete Agent Examples

```python
# Backend/app/agents/indeed_agent.py

class IndeedScraperAgent(ScraperAgent):
    SOURCE_NAME = "indeed"
    DATA_TYPE = "prospect"
    PRIORITY = SourcePriority.P0
    MAX_RECORDS_PER_RUN = 2500
    
    async def authenticate(self):
        """Indeed doesn't require authentication"""
        self.logger.info("Indeed scraper initialized (no auth needed)")
    
    async def fetch_data(self) -> List[dict]:
        """Scrape Indeed job listings"""
        from bs4 import BeautifulSoup
        import httpx
        
        jobs = []
        keywords = self.config.get("keywords", ["software engineer", "data scientist", "product manager"])
        locations = self.config.get("locations", ["United States", "Remote"])
        
        async with httpx.AsyncClient(timeout=30) as client:
            for keyword in keywords:
                for location in locations:
                    try:
                        url = f"https://www.indeed.com/jobs?q={keyword}&l={location}&sort=date"
                        response = await client.get(url)
                        soup = BeautifulSoup(response.text, "html.parser")
                        
                        job_cards = soup.find_all("div", class_="job_seen_beacon")
                        
                        for card in job_cards[:200]:  # Limit per location
                            try:
                                job_data = {
                                    "title": card.find("h2").text.strip(),
                                    "company": card.find("span", class_="companyName").text.strip(),
                                    "location": location,
                                    "posted_date": card.find("span", class_="date").text.strip(),
                                    "url": card.find("a")["href"],
                                    "source": "indeed"
                                }
                                jobs.append(job_data)
                            except:
                                continue
                    except Exception as e:
                        self.errors.append(f"Error scraping {keyword} in {location}: {e}")
        
        return jobs[:self.MAX_RECORDS_PER_RUN]
    
    async def normalize_data(self, raw_records: List[dict]) -> List[dict]:
        """Convert Indeed format to standard prospect schema"""
        
        normalized = []
        for record in raw_records:
            try:
                prospect = {
                    "first_name": None,
                    "last_name": None,
                    "email": None,
                    "job_title": record.get("title"),
                    "company_name": record.get("company"),
                    "location": record.get("location"),
                    "linkedin_url": None,
                    "source": "indeed",
                    "external_id": record.get("url"),
                    "data_quality_score": 0.70,
                    "scraped_at": datetime.now().isoformat()
                }
                normalized.append(prospect)
            except Exception as e:
                self.errors.append(f"Normalization error: {e}")
        
        return normalized

# Backend/app/agents/crunchbase_agent.py

class CrunchbaseScraperAgent(ScraperAgent):
    SOURCE_NAME = "crunchbase"
    DATA_TYPE = "company"
    PRIORITY = SourcePriority.P0
    MAX_RECORDS_PER_RUN = 1000
    
    async def authenticate(self):
        """Crunchbase free tier doesn't require API auth"""
        self.logger.info("Crunchbase agent ready to process monthly export")
    
    async def fetch_data(self) -> List[dict]:
        """Process Crunchbase monthly CSV export from Azure"""
        import pandas as pd
        from azure.storage.blob import BlobServiceClient
        from io import BytesIO
        
        try:
            # Download latest Crunchbase CSV from Azure
            blob_client = BlobServiceClient(
                account_name=self.config["azure_account"],
                account_key=self.config["azure_key"]
            ).get_blob_client(
                container=self.config["azure_container"],
                blob=self.config["crunchbase_csv_path"]
            )
            
            csv_data = blob_client.download_blob().readall()
            df = pd.read_csv(BytesIO(csv_data))
            
            companies = df.to_dict('records')
            return companies[:self.MAX_RECORDS_PER_RUN]
        
        except Exception as e:
            self.errors.append(f"Failed to fetch Crunchbase CSV: {e}")
            return []
    
    async def normalize_data(self, raw_records: List[dict]) -> List[dict]:
        """Normalize Crunchbase data"""
        
        normalized = []
        for record in raw_records:
            try:
                company = {
                    "name": record.get("name"),
                    "domain": self._extract_domain(record.get("website")),
                    "industry": record.get("industry"),
                    "employee_count_range": record.get("employees"),
                    "revenue_range": record.get("revenue"),
                    "funding_stage": record.get("funding_stage"),
                    "technologies": record.get("technologies", "").split(","),
                    "founded_year": record.get("founded_year"),
                    "source": "crunchbase",
                    "external_id": record.get("id"),
                    "data_quality_score": 0.95,
                    "scraped_at": datetime.now().isoformat()
                }
                normalized.append(company)
            except Exception as e:
                self.errors.append(f"Normalization error: {e}")
        
        return normalized
```

---

## 3. CONFIGURATION-DRIVEN AGENT REGISTRY

### 3.1 Agent Configuration File

```yaml
# Backend/config/agents.yml
# Central registry for all scraper agents - easy to enable/disable/configure

agents:
  
  # PRIORITY 0 - CRITICAL (Run daily at 00:00, 06:00, 12:00 UTC)
  
  - name: "indeed"
    class: "IndeedScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P0"
    schedule: "0 0,6,12 * * *"  # 3x daily
    max_records: 2500
    config:
      keywords:
        - "software engineer"
        - "data scientist"
        - "product manager"
        - "devops engineer"
        - "machine learning engineer"
      locations:
        - "United States"
        - "Remote"
      rate_limit: 10  # requests per minute
  
  - name: "crunchbase"
    class: "CrunchbaseScraperAgent"
    enabled: true
    data_type: "company"
    priority: "P0"
    schedule: "0 1 * * *"  # Daily at 01:00 UTC
    max_records: 1000
    config:
      csv_url: "https://data.crunchbase.com/export?type=csv"
      azure_path: "source-data/crunchbase/latest.csv"
  
  - name: "apollo"
    class: "ApolloScraperAgent"
    enabled: true
    data_type: "company"
    priority: "P0"
    schedule: "0 2 * * *"
    max_records: 2000
    config:
      api_key: "${APOLLO_API_KEY}"
      endpoint: "https://api.apollo.io/v1/companies/search"
      filters:
        industry: ["Software", "Technology"]
        employee_range: "1-10000"
  
  - name: "hunter"
    class: "HunterScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P1"
    schedule: "0 3 * * *"
    max_records: 1500
    config:
      api_key: "${HUNTER_API_KEY}"
      domains: []  # Will be populated from companies table
  
  - name: "github"
    class: "GitHubScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P1"
    schedule: "0 4 * * *"
    max_records: 1200
    config:
      token: "${GITHUB_API_TOKEN}"
      search_queries:
        - "language:python stars:>100"
        - "language:javascript stars:>100"
      per_page: 100
  
  - name: "linkedin"
    class: "LinkedInScraperAgent"
    enabled: false  # Disable - requires commercial license
    data_type: "prospect"
    priority: "P1"
    schedule: "0 5 * * *"
    max_records: 2000
    config:
      api_key: "${LINKEDIN_API_KEY}"
  
  - name: "stack_overflow"
    class: "StackOverflowScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P2"
    schedule: "0 6 * * *"
    max_records: 1000
    config:
      tags: ["python", "javascript", "java", "golang"]
      min_reputation: 500
  
  - name: "g2_reviews"
    class: "G2ReviewsScraperAgent"
    enabled: true
    data_type: "company"
    priority: "P1"
    schedule: "0 0 * * 0"  # Weekly on Sunday
    max_records: 800
    config:
      categories: ["Software", "Saas"]
      min_rating: 3.5
  
  - name: "sec_edgar"
    class: "SECEdgarScraperAgent"
    enabled: true
    data_type: "company"
    priority: "P2"
    schedule: "0 0 1 * *"  # Monthly
    max_records: 200
    config:
      filing_types: ["10-K", "10-Q"]
      industries: []  # All
  
  - name: "twitter_profiles"
    class: "TwitterProfileScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P2"
    schedule: "0 7 * * *"
    max_records: 3000
    config:
      api_key: "${TWITTER_API_KEY}"
      search_terms:
        - "#DevOps"
        - "#DataScience"
        - "#ProductManagement"
      min_followers: 100

  - name: "reddit_jobs"
    class: "RedditJobsScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P2"
    schedule: "0 8 * * *"
    max_records: 800
    config:
      subreddits: ["cscareerquestions", "jobs", "forhire"]
      keywords: ["hiring", "recruiter", "seeking talent"]

  - name: "hacker_news"
    class: "HackerNewsScraperAgent"
    enabled: true
    data_type: "prospect"
    priority: "P3"
    schedule: "0 0 * * 1"  # Weekly Monday
    max_records: 600
    config:
      search_queries: ["who is hiring", "seeking developers"]
```

---

## 4. PIPELINE ORCHESTRATION

### 4.1 Daily Pipeline Manager

```python
# Backend/app/services/pipeline_manager.py

from celery import group, chain, chord
from datetime import datetime
import yaml
import importlib

class DailyPipelineManager:
    """Orchestrates all scraper agents in parallel/sequential pipelines"""
    
    def __init__(self, config_path: str = "config/agents.yml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        
        self.agents_registry = {}
        self.load_agents()
    
    def load_agents(self):
        """Dynamically load all agent classes"""
        for agent_config in self.config["agents"]:
            if not agent_config.get("enabled", True):
                continue
            
            class_name = agent_config["class"]
            module_name = f"app.agents.{agent_config['name']}_agent"
            
            try:
                module = importlib.import_module(module_name)
                agent_class = getattr(module, class_name)
                self.agents_registry[agent_config["name"]] = (agent_class, agent_config)
                logger.info(f"Loaded agent: {agent_config['name']}")
            except Exception as e:
                logger.error(f"Failed to load agent {class_name}: {e}")
    
    async def execute_daily_pipeline(self):
        """Execute all enabled agents for today"""
        
        pipeline_run = PipelineRun(
            run_id=str(uuid.uuid4()),
            started_at=datetime.now(),
            total_agents=len(self.agents_registry)
        )
        db.session.add(pipeline_run)
        db.session.commit()
        
        # Group agents by priority
        p0_agents = []
        p1_agents = []
        p2_agents = []
        other_agents = []
        
        for agent_name, (agent_class, config) in self.agents_registry.items():
            if config["priority"] == "P0":
                p0_agents.append((agent_name, agent_class, config))
            elif config["priority"] == "P1":
                p1_agents.append((agent_name, agent_class, config))
            elif config["priority"] == "P2":
                p2_agents.append((agent_name, agent_class, config))
            else:
                other_agents.append((agent_name, agent_class, config))
        
        try:
            # Execute P0 agents in parallel
            await self._execute_agent_batch(p0_agents, pipeline_run, "P0")
            
            # Execute P1 agents
            await self._execute_agent_batch(p1_agents, pipeline_run, "P1")
            
            # Execute P2 agents
            await self._execute_agent_batch(p2_agents, pipeline_run, "P2")
            
            pipeline_run.status = "completed"
            pipeline_run.completed_at = datetime.now()
            
        except Exception as e:
            pipeline_run.status = "failed"
            pipeline_run.error_message = str(e)
            logger.error(f"Pipeline failed: {e}", exc_info=True)
        
        db.session.commit()
        return pipeline_run
    
    async def _execute_agent_batch(self, agents: List[tuple], pipeline_run, priority: str):
        """Execute a batch of agents"""
        
        tasks = []
        for agent_name, agent_class, config in agents:
            task = execute_scraper_agent.delay(
                agent_name=agent_name,
                agent_class_name=agent_class.__name__,
                config=config,
                pipeline_run_id=pipeline_run.run_id
            )
            tasks.append(task)
        
        # Wait for all to complete
        for task in tasks:
            result = task.get(timeout=300)  # 5 min timeout
            await self._save_agent_results(result, pipeline_run)
    
    async def _save_agent_results(self, result: dict, pipeline_run):
        """Save agent results to database"""
        
        agent_run = AgentRun(
            pipeline_run_id=pipeline_run.run_id,
            agent_name=result["agent"],
            status=result["status"],
            records_scraped=result.get("records_count", 0),
            duration_seconds=result.get("duration_seconds", 0),
            errors="\n".join(result.get("errors", []))
        )
        db.session.add(agent_run)
        
        # Save records if successful
        if result["status"] == "success":
            records = result.get("records", [])
            for record in records:
                # Determine record type
                if "job_title" in record and not "employee_count" in record:
                    # Prospect record
                    prospect_dump = ProspectDump(
                        pipeline_run_id=pipeline_run.run_id,
                        agent_name=result["agent"],
                        data=record,
                        raw_json=json.dumps(record)
                    )
                    db.session.add(prospect_dump)
                else:
                    # Company record
                    company_dump = CompanyDump(
                        pipeline_run_id=pipeline_run.run_id,
                        agent_name=result["agent"],
                        data=record,
                        raw_json=json.dumps(record)
                    )
                    db.session.add(company_dump)
        
        db.session.commit()
```

### 4.2 Celery Tasks for Agent Execution

```python
# Backend/app/tasks/scraper_tasks.py

from celery import shared_task
from app.agents import (
    IndeedScraperAgent, CrunchbaseScraperAgent, ApolloScraperAgent,
    HunterScraperAgent, GitHubScraperAgent, StackOverflowScraperAgent,
    TwitterProfileScraperAgent, RedditJobsScraperAgent, HackerNewsScraperAgent
)

AGENT_CLASSES = {
    "indeed": IndeedScraperAgent,
    "crunchbase": CrunchbaseScraperAgent,
    "apollo": ApolloScraperAgent,
    "hunter": HunterScraperAgent,
    "github": GitHubScraperAgent,
    "stack_overflow": StackOverflowScraperAgent,
    "twitter_profiles": TwitterProfileScraperAgent,
    "reddit_jobs": RedditJobsScraperAgent,
    "hacker_news": HackerNewsScraperAgent,
}

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def execute_scraper_agent(self, agent_name: str, config: dict, pipeline_run_id: str):
    """Execute single scraper agent with retry logic"""
    
    try:
        agent_class = AGENT_CLASSES[agent_name]
        agent = agent_class(config)
        
        # Run agent synchronously in Celery worker
        loop = asyncio.new_event_loop()
        result = loop.run_until_complete(agent.run())
        loop.close()
        
        return result
    
    except Exception as exc:
        # Retry up to 3 times with exponential backoff
        raise self.retry(exc=exc, countdown=60 * self.request.retries)

@shared_task
def scheduled_daily_pipeline():
    """Scheduled task to run daily pipeline (via Celery Beat)"""
    
    pipeline_manager = DailyPipelineManager()
    
    loop = asyncio.new_event_loop()
    pipeline_run = loop.run_until_complete(pipeline_manager.execute_daily_pipeline())
    loop.close()
    
    logger.info(f"Pipeline run completed: {pipeline_run.run_id}")
    return pipeline_run.run_id
```

---

## 5. DATABASE SCHEMA - EXTENDED

### 5.1 Pipeline & Agent Run Tracking

```sql
-- Track pipeline executions
CREATE TABLE pipeline_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_agents INTEGER,
    successful_agents INTEGER DEFAULT 0,
    failed_agents INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
    error_message TEXT,
    summary JSONB
);

-- Track individual agent runs
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(run_id),
    agent_name VARCHAR(100) NOT NULL,
    status VARCHAR(20), -- success, failed, skipped
    records_scraped INTEGER DEFAULT 0,
    duration_seconds FLOAT,
    errors TEXT,
    config JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    
    CONSTRAINT fk_pipeline FOREIGN KEY(pipeline_run_id) REFERENCES pipeline_runs(run_id)
);

-- Raw prospect data from all sources (staging)
CREATE TABLE prospect_dump_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(run_id),
    agent_name VARCHAR(100),
    
    -- Standard fields
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    job_title VARCHAR(150),
    seniority_level VARCHAR(50),
    department VARCHAR(100),
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    location VARCHAR(255),
    linkedin_url TEXT,
    twitter_url TEXT,
    github_url TEXT,
    
    -- Metadata
    source_name VARCHAR(50),
    external_id VARCHAR(255),
    data_quality_score FLOAT DEFAULT 0.5,
    raw_json JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_name (agent_name),
    INDEX idx_email (email),
    INDEX idx_company_domain (company_domain),
    INDEX idx_source (source_name)
);

-- Raw company data from all sources (staging)
CREATE TABLE company_dump_staging (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(run_id),
    agent_name VARCHAR(100),
    
    -- Standard fields
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    website VARCHAR(500),
    industry VARCHAR(100),
    employee_count_range VARCHAR(50),
    employee_count_exact INTEGER,
    revenue_range VARCHAR(50),
    revenue_exact BIGINT,
    founded_year INTEGER,
    headquarters_country VARCHAR(100),
    headquarters_city VARCHAR(100),
    funding_stage VARCHAR(50),
    funding_total BIGINT,
    technologies TEXT[], -- JSONB array
    market_segments TEXT[], -- JSONB array
    
    -- Metadata
    source_name VARCHAR(50),
    external_id VARCHAR(255),
    data_quality_score FLOAT DEFAULT 0.5,
    raw_json JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_name (agent_name),
    INDEX idx_domain (domain),
    INDEX idx_source (source_name)
);

-- Deduplication tracking
CREATE TABLE dedup_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_run_id UUID NOT NULL REFERENCES pipeline_runs(run_id),
    entity_type VARCHAR(20), -- 'prospect' or 'company'
    primary_record_id UUID,
    duplicate_record_id UUID,
    match_type VARCHAR(50), -- 'email_exact', 'linkedin_exact', 'fuzzy_name_company'
    confidence_score FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. DATA NORMALIZATION & DEDUPLICATION AT SCALE

### 6.1 Bulk Deduplication

```python
# Backend/app/services/bulk_deduplication.py

class BulkDeduplicationService:
    """Handle millions of records efficiently"""
    
    async def deduplicate_pipeline_run(self, pipeline_run_id: str):
        """Deduplicate all records from a pipeline run"""
        
        # Email deduplication (fastest - exact match)
        await self._deduplicate_by_email(pipeline_run_id)
        
        # LinkedIn URL deduplication
        await self._deduplicate_by_linkedin(pipeline_run_id)
        
        # Name + Company + Job fuzzy matching (slower - use batching)
        await self._deduplicate_fuzzy(pipeline_run_id)
        
        # Mark duplicates for removal
        await self._mark_duplicates(pipeline_run_id)
    
    async def _deduplicate_by_email(self, pipeline_run_id: str):
        """Find email exact matches"""
        
        # Use database for efficiency (no Python memory)
        sql = """
        INSERT INTO dedup_records (pipeline_run_id, entity_type, primary_record_id, duplicate_record_id, match_type, confidence_score)
        SELECT 
            %s,
            'prospect',
            (SELECT id FROM prospect_dump_staging WHERE pipeline_run_id = %s AND email = t.email LIMIT 1),
            id,
            'email_exact',
            1.0
        FROM prospect_dump_staging t
        WHERE pipeline_run_id = %s AND email IS NOT NULL
        GROUP BY email
        HAVING COUNT(*) > 1
        """
        
        db.execute(sql, (pipeline_run_id, pipeline_run_id, pipeline_run_id))
        db.commit()
    
    async def _deduplicate_fuzzy(self, pipeline_run_id: str, batch_size: int = 10000):
        """Fuzzy match on name + company + job_title using vectorization"""
        
        from rapidfuzz import fuzz
        
        # Fetch all records
        records = db.query(ProspectDumpStaging)\
            .filter(ProspectDumpStaging.pipeline_run_id == pipeline_run_id)\
            .all()
        
        # Process in batches
        for i in range(0, len(records), batch_size):
            batch = records[i:i+batch_size]
            
            for j, record1 in enumerate(batch):
                for record2 in batch[j+1:]:
                    if record1.id >= record2.id:  # Avoid duplicates
                        continue
                    
                    # Compare name + company + job_title
                    key1 = f"{record1.first_name} {record1.company_name} {record1.job_title}".lower()
                    key2 = f"{record2.first_name} {record2.company_name} {record2.job_title}".lower()
                    
                    similarity = fuzz.ratio(key1, key2)
                    
                    if similarity > 85:  # >85% match = likely duplicate
                        dedup = DedupRecord(
                            pipeline_run_id=pipeline_run_id,
                            entity_type="prospect",
                            primary_record_id=record1.id if record1.data_quality_score >= record2.data_quality_score else record2.id,
                            duplicate_record_id=record2.id if record1.data_quality_score >= record2.data_quality_score else record1.id,
                            match_type="fuzzy_name_company_job",
                            confidence_score=similarity / 100
                        )
                        db.session.add(dedup)
            
            db.session.commit()
```

---

## 7. DIRECT STORAGE INTEGRATION

### 7.1 Batch Insert to Azure Blob + Database

```python
# Backend/app/services/storage_writer.py

import pandas as pd
from datetime import datetime

class BulkStorageWriter:
    """Write millions of records efficiently"""
    
    async def flush_staging_to_destinations(self, pipeline_run_id: str):
        """
        Transfer staging data to:
        1. Azure Blob Storage (CSV/Parquet for archival)
        2. PostgreSQL prospects/companies tables (for app use)
        3. Google Sheets (optional export)
        """
        
        # Read staging data
        staging_prospects = db.query(ProspectDumpStaging)\
            .filter(ProspectDumpStaging.pipeline_run_id == pipeline_run_id)\
            .all()
        
        staging_companies = db.query(CompanyDumpStaging)\
            .filter(CompanyDumpStaging.pipeline_run_id == pipeline_run_id)\
            .all()
        
        # Convert to DataFrames
        prospects_df = pd.DataFrame([
            {
                "first_name": p.first_name,
                "last_name": p.last_name,
                "email": p.email,
                "job_title": p.job_title,
                "company_name": p.company_name,
                "company_domain": p.company_domain,
                "source": p.source_name,
                "data_quality_score": p.data_quality_score,
                "scraped_at": p.created_at
            }
            for p in staging_prospects
        ])
        
        companies_df = pd.DataFrame([
            {
                "name": c.name,
                "domain": c.domain,
                "industry": c.industry,
                "employee_count": c.employee_count_exact,
                "revenue": c.revenue_exact,
                "founding_stage": c.funding_stage,
                "source": c.source_name,
                "data_quality_score": c.data_quality_score,
                "scraped_at": c.created_at
            }
            for c in staging_companies
        ])
        
        # 1. AZURE BLOB STORAGE - Archive
        await self._write_to_azure(prospects_df, companies_df, pipeline_run_id)
        
        # 2. POSTGRESQL - Primary database
        await self._write_to_postgres(prospects_df, companies_df, pipeline_run_id)
        
        # 3. GOOGLE SHEETS (optional)
        if self.config.get("enable_google_sheets"):
            await self._write_to_google_sheets(prospects_df, companies_df, pipeline_run_id)
    
    async def _write_to_azure(self, prospects_df, companies_df, pipeline_run_id: str):
        """Write to Azure Blob Storage as Parquet + CSV"""
        
        from azure.storage.blob import BlobServiceClient
        import io
        
        blob_client = BlobServiceClient(
            account_name=self.config["azure_account"],
            account_key=self.config["azure_key"]
        )
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Prospects
        prospects_buffer = io.BytesIO()
        prospects_df.to_csv(prospects_buffer, index=False)
        
        blob_client.get_blob_client(
            container="prospect-dumps",
            blob=f"{timestamp}/prospects.csv"
        ).upload_blob(prospects_buffer.getvalue(), overwrite=True)
        
        # Companies
        companies_buffer = io.BytesIO()
        companies_df.to_csv(companies_buffer, index=False)
        
        blob_client.get_blob_client(
            container="company-dumps",
            blob=f"{timestamp}/companies.csv"
        ).upload_blob(companies_buffer.getvalue(), overwrite=True)
        
        logger.info(f"Flushed to Azure Blob: prospects={len(prospects_df)}, companies={len(companies_df)}")
    
    async def _write_to_postgres(self, prospects_df, companies_df, pipeline_run_id: str):
        """Bulk insert into PostgreSQL using COPY"""
        
        import csv
        import io
        
        # Convert DataFrames to CSV buffers
        prospects_csv = io.StringIO()
        prospects_df.to_csv(prospects_csv, index=False, header=False)
        prospects_csv.seek(0)
        
        companies_csv = io.StringIO()
        companies_df.to_csv(companies_csv, index=False, header=False)
        companies_csv.seek(0)
        
        # Bulk copy prospects
        with db.engine.raw_connection() as conn:
            with conn.cursor() as cur:
                cur.copy_from(
                    prospects_csv,
                    'prospects',
                    columns=('first_name', 'last_name', 'email', 'job_title', 'company_name', 'company_domain', 'provider_source', 'data_quality_score')
                )
                
                cur.copy_from(
                    companies_csv,
                    'companies',
                    columns=('name', 'domain', 'industry', 'employee_count_exact', 'revenue_exact', 'funding_stage', 'provider_source', 'data_quality_score')
                )
                
                conn.commit()
        
        logger.info(f"Wrote to PostgreSQL: prospects={len(prospects_df)}, companies={len(companies_df)}")
```

---

## 8. SCHEDULING & AUTOMATION

### 8.1 Celery Beat Configuration

```python
# Backend/app/config/celery_schedule.py

from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    
    # Daily pipelines
    "morning-pipeline": {
        "task": "app.tasks.scraper_tasks.scheduled_daily_pipeline",
        "schedule": crontab(hour=0, minute=0),  # 00:00 UTC
        "options": {"queue": "scraping", "priority": 10}
    },
    
    "midday-pipeline": {
        "task": "app.tasks.scraper_tasks.scheduled_daily_pipeline",
        "schedule": crontab(hour=6, minute=0),  # 06:00 UTC
        "options": {"queue": "scraping", "priority": 10}
    },
    
    "afternoon-pipeline": {
        "task": "app.tasks.scraper_tasks.scheduled_daily_pipeline",
        "schedule": crontab(hour=12, minute=0),  # 12:00 UTC
        "options": {"queue": "scraping", "priority": 10}
    },
    
    # Data processing
    "deduplication-task": {
        "task": "app.tasks.scraper_tasks.run_daily_deduplication",
        "schedule": crontab(hour=18, minute=0),  # 18:00 UTC (after pipelines)
        "options": {"queue": "processing"}
    },
    
    "flush-to-storage": {
        "task": "app.tasks.scraper_tasks.flush_to_blob_storage",
        "schedule": crontab(hour=20, minute=0),  # 20:00 UTC
        "options": {"queue": "storage"}
    },
}
```

---

## 9. IMPLEMENTATION ROADMAP - PHASES

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Azure Blob Storage containers
- [ ] Create database schema (pipeline runs, agent runs, staging tables)
- [ ] Implement ScraperAgent base class
- [ ] Build configuration loader from agents.yml
- [ ] Implement Indeed + Crunchbase + Apollo agents (P0)

### Phase 2: Scaling (Week 3-4)
- [ ] Add 8 more agents (Hunter, GitHub, Stack Overflow, etc.)
- [ ] Implement bulk deduplication
- [ ] Build storage writer (Azure + PostgreSQL)
- [ ] Set up Celery scheduling
- [ ] Add monitoring/dashboards

### Phase 3: Optimization (Week 5-6)
- [ ] Add 5+ lower-priority sources
- [ ] Optimize deduplication (vectorization)
- [ ] Implement Google Sheets export
- [ ] Add data quality improvements
- [ ] Performance tuning for millions of records

### Phase 4: Production Ready (Week 7+)
- [ ] End-to-end testing at scale
- [ ] Error recovery & retry logic
- [ ] Documentation & runbooks
- [ ] Production deployment
- [ ] Continuous monitoring

---

## 10. COST ESTIMATION (Monthly - at scale)

| Component | Cost | Notes |
|-----------|------|-------|
| Azure Blob Storage | $2-10 | 1-10GB data stored |
| Azure Compute (pipeline workers) | $150-400 | 3-5 standard workers running agents |
| PostgreSQL (extended) | $100-250 | Larger DB for staging + main records (1M+ rows) |
| Network egress | $20-50 | Inter-service communication |
| Google Sheets API | $0 | Free tier sufficient |
| **TOTAL** | **$270-710/month** | Enterprise-scale daily automation |

---

## NEXT STEPS

1. ✅ **Review expanded plan** - Confirm 30+ sources & agent architecture
2. **Create agents.yml config file** - Central config for all sources
3. **Set up database schema** - Pipeline runs, agent runs, staging tables
4. **Build Phase 1 agents** - Indeed, Crunchbase, Apollo (P0)
5. **Setup Celery + Beat scheduler** - Daily 3x execution at 00:00, 06:00, 12:00 UTC
6. **Implement bulk storage writer** - Direct Azure Blob + PostgreSQL
7. **Deploy & monitor** - Run initial pipeline, track metrics
8. **Add Phase 2 agents** - 8 more sources weekly

🚀 **Ready to proceed with Phase 1 implementation?**
