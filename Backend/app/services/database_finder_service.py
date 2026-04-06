"""
Database Finder Service — ZenRows + Tavily
Searches for people/leads via Google→LinkedIn scraping (ZenRows)
and enriches them with signals (Tavily).

Returns 30-40 data fields per lead.
"""

import asyncio
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class DatabaseFinderError(Exception):
    """Custom exception for Database Finder errors."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class DatabaseFinderService:
    """
    Production-grade lead discovery service using ZenRows and Tavily.

    Flow:
    1. User provides a search query (company name, industry term, job title, etc.)
    2. ZenRows scrapes Google for LinkedIn profiles matching the query
    3. For each profile URL found, ZenRows scrapes the LinkedIn profile page
    4. Tavily enriches each lead with company signals and person signals
    5. All data is combined into a 30-40 field lead record
    """

    ZENROWS_BASE = "https://api.zenrows.com/v1/"
    DEFAULT_TIMEOUT = 60.0

    # Characters outside basic Latin + common punctuation → strip them
    # This removes Hindi (Devanagari), Chinese, Arabic, emoji, etc.
    _NON_LATIN_RE = re.compile(r"[^\x00-\x7F\u00C0-\u024F]+")
    # Markdown / decoration noise
    _MARKDOWN_RE = re.compile(r"[*#_~`>]+")
    # Collapse whitespace
    _MULTI_SPACE_RE = re.compile(r"\s{2,}")

    @classmethod
    def _clean_text(cls, text: str) -> str:
        """
        Sanitise scraped text:
        - Strip *, #, _, ~, ` (markdown decoration)
        - Remove non-Latin scripts (Hindi, Chinese, Arabic, emoji, etc.)
        - Collapse whitespace
        - Strip leading/trailing junk
        """
        if not text:
            return ""
        text = cls._MARKDOWN_RE.sub(" ", text)
        text = cls._NON_LATIN_RE.sub(" ", text)
        text = cls._MULTI_SPACE_RE.sub(" ", text)
        return text.strip(" .-,;:|")

    def __init__(self):
        self.zenrows_api_key = getattr(settings, "ZENROWS_API_KEY", None) or ""
        self.tavily_api_key = getattr(settings, "TAVILY_API_KEY", None) or ""

    # ── ZenRows helpers ──────────────────────────────────────────────────

    async def _zenrows_get(
        self,
        url: str,
        mode: str = "auto",
        js_render: Optional[bool] = None,
        premium_proxy: Optional[bool] = None,
        antibot: Optional[bool] = None,
        autoparse: bool = False,
    ) -> str:
        """Fetch a page through ZenRows proxy.

        By default uses mode=auto which lets ZenRows pick the cheapest
        working configuration and only charges for the successful attempt.
        """
        if not self.zenrows_api_key:
            raise DatabaseFinderError("ZENROWS_API_KEY is not configured", 503)

        params: Dict[str, str] = {
            "apikey": self.zenrows_api_key,
            "url": url,
        }
        if mode:
            params["mode"] = mode
        # Only set manual params when not using auto mode
        if not mode:
            if js_render:
                params["js_render"] = "true"
            if premium_proxy:
                params["premium_proxy"] = "true"
            if antibot:
                params["antibot"] = "true"
        if autoparse:
            params["autoparse"] = "true"

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
            resp = await client.get(self.ZENROWS_BASE, params=params, headers=headers)
            if resp.status_code >= 400:
                logger.warning(
                    f"ZenRows returned {resp.status_code} for {url[:80]} "
                    f"(mode={mode})"
                )
                raise DatabaseFinderError(
                    f"ZenRows request failed ({resp.status_code})",
                    status_code=502,
                )
            return resp.text

    async def _search_google_linkedin(
        self,
        query: str,
        location: str = "United States",
        num_results: int = 20,
    ) -> List[str]:
        """Google search via ZenRows → extract LinkedIn profile URLs."""
        search_query = f'site:linkedin.com/in "{query}" {location}'
        search_url = (
            f"https://www.google.com/search?q={quote_plus(search_query)}"
            f"&num={min(num_results * 2, 100)}&hl=en&gl=us"
        )

        logger.info(f"ZenRows Google search: {query} in {location}")

        # Use mode=auto — ZenRows picks the cheapest working config
        # and only charges for the successful attempt
        try:
            html = await self._zenrows_get(search_url, mode="auto")
        except DatabaseFinderError:
            raise

        # Extract LinkedIn profile URLs
        pattern = r'href="(https://(?:www\.)?linkedin\.com/in/[^"&]+)"'
        matches = re.findall(pattern, html)

        unique_urls: List[str] = []
        for match in matches:
            # Strip query params, fragments, and URL-encoded tracking junk
            cleaned = match.split("&")[0].split("?")[0].split("#")[0]
            # Extract just the /in/slug part — discard anything after slug
            slug_match = re.search(r"(https://(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-]+)", cleaned)
            if slug_match:
                cleaned = slug_match.group(1).rstrip("/")
            if cleaned not in unique_urls and "/in/" in cleaned:
                unique_urls.append(cleaned)
            if len(unique_urls) >= num_results:
                break

        logger.info(f"Found {len(unique_urls)} LinkedIn URLs for '{query}'")
        return unique_urls

    async def _search_tavily_linkedin(self, query: str, location: str = "United States", num_results: int = 20) -> List[str]:
        """Fallback: Tavily search for LinkedIn profile URLs."""
        if not self.tavily_api_key:
            return []

        search_query = f'site:linkedin.com/in "{query}" {location}'.strip()
        results = await self._tavily_search(search_query, max_results=min(num_results * 2, 20))
        urls: List[str] = []
        for r in results:
            url = r.get("url", "")
            if "linkedin.com/in/" not in url:
                continue
            cleaned = url.split("?")[0].split("#")[0].rstrip("/")
            slug_match = re.search(r"(https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-]+)", cleaned)
            if slug_match:
                cleaned = slug_match.group(1).rstrip("/")
            if cleaned not in urls:
                urls.append(cleaned)
            if len(urls) >= num_results:
                break
        if urls:
            logger.info(f"Tavily fallback found {len(urls)} LinkedIn URLs for '{query}'")
        return urls

    @staticmethod
    def _split_headline(raw: str) -> tuple:
        """
        Split a LinkedIn headline into (role, company).
        Handles patterns like:
          "CEO at Tesla"  → ("CEO", "Tesla")
          "Software Engineer - Google" → ("Software Engineer", "Google")
          "VP Sales | Acme Corp" → ("VP Sales", "Acme Corp")
          "Founder & CEO" → ("Founder & CEO", "")
        """
        raw = re.sub(r"[\u200f\u200e]", "", raw).strip()

        # Try "role at/@ Company"
        m = re.split(r"\s+(?:at|@)\s+", raw, maxsplit=1, flags=re.IGNORECASE)
        if len(m) == 2 and m[0] and m[1]:
            return m[0].strip(), m[1].strip()

        # Try "role - Company" or "role | Company"
        m = re.split(r"\s*[\-\|]\s+", raw, maxsplit=1)
        if len(m) == 2 and m[0] and m[1]:
            return m[0].strip(), m[1].strip()

        return raw, ""

    @staticmethod
    def _strip_linkedin_slug_suffix(slug: str) -> str:
        """
        Remove LinkedIn ID suffix and tracking junk from a URL slug.
        Examples:
            "john-doe-5b1a2c3d"                          → "john-doe"
            "jane-smith-123456789"                        → "jane-smith"
            "robert-nick1096B8Bb"                         → "robert-nick"
            "john-doe%20Text=See%20Mutual%20Connections"  → "john-doe"
        """
        # First, strip everything from % onwards (URL-encoded tracking)
        slug = slug.split("%")[0]
        # Strip everything from a capital-followed-by-hex pattern (e.g. "nick1096B8Bb")
        slug = re.sub(r"[A-F0-9]{4,}[A-Za-z0-9]*$", "", slug, flags=re.IGNORECASE)
        # Strip trailing hex/alphanumeric ID (5+ chars after dash)
        slug = re.sub(r"-[a-z0-9]{5,}$", "", slug, flags=re.IGNORECASE)
        # Strip trailing pure numbers
        slug = re.sub(r"-?\d{3,}$", "", slug)
        # Strip any trailing dashes
        slug = slug.rstrip("-")
        return slug

    @staticmethod
    def _looks_like_name(text: str, first_name: str, last_name: str) -> bool:
        """Check if text is actually a person's name rather than a job title."""
        if not text or not (first_name or last_name):
            return False
        text_lower = text.lower().strip()
        fn = first_name.lower().strip()
        ln = last_name.lower().strip()
        # Direct match
        if fn and ln and text_lower == f"{fn} {ln}":
            return True
        if fn and ln and text_lower == f"{ln} {fn}":
            return True
        # Text starts with first+last name
        if fn and ln and text_lower.startswith(f"{fn} {ln}"):
            return True
        # Text has no job-like keywords and matches name parts
        job_words = {"manager", "director", "engineer", "developer", "vp", "ceo",
                     "cto", "cfo", "founder", "analyst", "consultant", "lead",
                     "head", "chief", "officer", "president", "associate",
                     "coordinator", "specialist", "executive", "sales", "marketing",
                     "senior", "junior", "intern", "professor", "teacher",
                     "architect", "designer", "strategist", "advisor"}
        words = set(text_lower.split())
        if not words.intersection(job_words):
            # No job keywords found — likely a name
            if (fn and fn in text_lower) or (ln and ln in text_lower):
                return True
        return False

    @staticmethod
    def _parse_title_tag(title_text: str) -> tuple:
        """
        Parse LinkedIn <title> tag: "John Doe - CEO - Google | LinkedIn"
        Returns (role, company). Skips the first segment (name).
        """
        # Remove trailing "| LinkedIn" (already stripped by regex, but just in case)
        title_text = re.sub(r"\s*\|\s*LinkedIn.*$", "", title_text, flags=re.IGNORECASE).strip()
        parts = [p.strip() for p in re.split(r"\s*-\s*", title_text) if p.strip()]
        if len(parts) >= 3:
            # "Name - Title - Company" → skip first (name)
            return parts[1], parts[2]
        elif len(parts) == 2:
            # "Name - Title" → skip first (name)
            return parts[1], ""
        return "", ""

    async def _scrape_linkedin_profile(self, profile_url: str) -> Dict[str, Any]:
        """Scrape a single LinkedIn profile via ZenRows and extract data."""
        try:
            html = await self._zenrows_get(profile_url)
        except Exception as e:
            logger.warning(f"Failed to scrape {profile_url}: {e}")
            return {"linkedin_url": profile_url}

        details: Dict[str, Any] = {"linkedin_url": profile_url}

        # ── Extract name from URL slug ──────────────────────────────────
        name_match = re.search(r"/in/([A-Za-z0-9\-%]+)", profile_url)
        if name_match:
            raw_slug = name_match.group(1)
            clean = self._strip_linkedin_slug_suffix(raw_slug)
            name = clean.replace("-", " ").title()
            # Only keep alphabetic words (drop leftover numbers/codes)
            name_words = [w for w in name.split() if re.match(r"^[A-Za-z]+$", w)]
            name = " ".join(name_words)
            parts = name.split(" ", 1)
            if parts and parts[0]:
                details["first_name"] = parts[0]
                details["last_name"] = parts[1] if len(parts) > 1 else ""
                details["full_name"] = name

        # ── Name from JSON-LD (override URL-based name early) ───────────
        gn = re.search(r'"givenName"\s*:\s*"([^"]+)"', html, re.IGNORECASE)
        fn = re.search(r'"familyName"\s*:\s*"([^"]+)"', html, re.IGNORECASE)
        if gn:
            val = gn.group(1).strip()
            # Only use if it looks like a real name (alphabetic, no codes)
            if re.match(r"^[A-Za-z\s\.\-']+$", val):
                details["first_name"] = val
        if fn:
            val = fn.group(1).strip()
            if re.match(r"^[A-Za-z\s\.\-']+$", val):
                details["last_name"] = val
        if details.get("first_name") and details.get("last_name"):
            details["full_name"] = f"{details['first_name']} {details['last_name']}"

        first_name = details.get("first_name", "")
        last_name = details.get("last_name", "")

        # ── Headline / Title ────────────────────────────────────────────
        # Priority 1: jobTitle from JSON-LD (pure role, no name, no company)
        jt = re.search(r'"jobTitle"\s*:\s*"([^"]+)"', html, re.IGNORECASE)
        if jt:
            title_val = jt.group(1).strip()
            if not self._looks_like_name(title_val, first_name, last_name):
                details["title"] = title_val

        # Priority 2: headline JSON-LD (may contain "Role at Company")
        if not details.get("title"):
            hl = re.search(r'"headline"\s*:\s*"([^"]+)"', html, re.IGNORECASE | re.DOTALL)
            if hl:
                text = hl.group(1).strip()
                if text and len(text) < 200 and "linkedin" not in text.lower():
                    role, company = self._split_headline(text)
                    if not self._looks_like_name(role, first_name, last_name):
                        details["title"] = role
                        if company:
                            details["_headline_company"] = company

        # Priority 3: visual headline element
        if not details.get("title"):
            vh = re.search(
                r'<div[^>]*class="[^"]*text-body-medium[^"]*break-words[^"]*"[^>]*>\s*([^<]+)',
                html, re.IGNORECASE | re.DOTALL,
            )
            if vh:
                text = vh.group(1).strip()
                if text and len(text) < 200 and "linkedin" not in text.lower():
                    role, company = self._split_headline(text)
                    if not self._looks_like_name(role, first_name, last_name):
                        details["title"] = role
                        if company and not details.get("_headline_company"):
                            details["_headline_company"] = company

        # Priority 4: <title> tag — "Name - Title - Company | LinkedIn"
        if not details.get("title"):
            tt = re.search(r"<title>([^<]+)</title>", html, re.IGNORECASE)
            if tt:
                role, company = self._parse_title_tag(tt.group(1))
                if role and not self._looks_like_name(role, first_name, last_name):
                    details["title"] = role
                    if company and not details.get("_headline_company"):
                        details["_headline_company"] = company

        # ── Organization / company ──────────────────────────────────────
        org_patterns = [
            r'"worksFor"\s*:\s*\[\s*\{[^}]*"name"\s*:\s*"([^"]+)"',
            r'"companyName"\s*:\s*"([^"]+)"',
            r'href="https://www\.linkedin\.com/company/[^"]+"[^>]*>\s*([^<]+?)\s*</a>',
        ]
        for pat in org_patterns:
            m = re.search(pat, html, re.IGNORECASE | re.DOTALL)
            if m:
                org_val = m.group(1).strip()
                if org_val and org_val != details.get("title", ""):
                    details["organization"] = org_val
                    break

        # Fallback: use the company portion split from the headline
        if not details.get("organization") and details.get("_headline_company"):
            details["organization"] = details["_headline_company"]

        # Guard: if title and org ended up identical, clear the org
        if details.get("title") and details.get("organization") and details["title"] == details["organization"]:
            details["organization"] = ""

        details.pop("_headline_company", None)

        # ── Location ────────────────────────────────────────────────────
        loc_patterns = [
            r'"addressLocality"\s*:\s*"([^"]+)"',
            r'"addressRegion"\s*:\s*"([^"]+)"',
            r'"location"\s*:\s*"([^"]+)"',
            r'<span[^>]*class="[^"]*text-body-small[^"]*inline[^"]*t-black--light[^"]*"[^>]*>([^<]+)</span>',
        ]
        for pat in loc_patterns:
            m = re.search(pat, html, re.IGNORECASE | re.DOTALL)
            if m:
                details["location"] = m.group(1).strip()
                break

        # Try to split "City, State, Country" into parts
        loc_str = details.get("location", "")
        if loc_str:
            loc_parts = [p.strip() for p in loc_str.split(",")]
            if len(loc_parts) >= 3:
                details["city"] = loc_parts[0]
                details["state"] = loc_parts[1]
                details["country"] = loc_parts[2]
            elif len(loc_parts) == 2:
                details["city"] = loc_parts[0]
                details["state"] = loc_parts[1]

        # ── Email ───────────────────────────────────────────────────────
        email_matches = re.findall(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", html
        )
        if email_matches:
            details["email"] = email_matches[0]

        # ── Phone ───────────────────────────────────────────────────────
        phone_patterns = [
            # JSON-LD structured data
            r'"telephone"\s*:\s*"([^"]+)"',
            # tel: links (common in contact sections)
            r'href="tel:([^"]+)"',
            r'tel:([+\d\-() ]{7,20})',
            # Explicit labels near a number
            r'(?:phone|tel|mobile|cell|contact)[:\s]*\(?(\+?[\d][\d\s\-().]{6,19})',
            # International formats: +1 (555) 123-4567, +91-9876543210
            r'(\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4})',
            # US format: (555) 123-4567
            r'(\(\d{3}\)\s?\d{3}[\-\s]\d{4})',
            # 10-digit blocks with area code
            r'(?<![/\d])(\d{3}[\-.\s]\d{3}[\-.\s]\d{4})(?![/\d])',
        ]
        for pat in phone_patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                phone = re.sub(r"[^\d+\-() ]", "", m.group(1)).strip()
                # Validate: at least 7 digits
                digit_count = sum(c.isdigit() for c in phone)
                if digit_count >= 7:
                    details["phone"] = phone
                    break

        # ── Twitter / X ─────────────────────────────────────────────────
        for pat in [
            r'href="(https?://(?:www\.)?(?:twitter|x)\.com/[^"]+)"',
        ]:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                details["twitter_url"] = m.group(1)
                break

        # ── Website / personal URL ──────────────────────────────────────
        website_patterns = [
            r'"url"\s*:\s*"(https?://(?!.*linkedin)[^"]+)"',
        ]
        for pat in website_patterns:
            m = re.search(pat, html, re.IGNORECASE)
            if m:
                details["website"] = m.group(1).strip()
                break

        # ── Company LinkedIn URL ────────────────────────────────────────
        company_link = re.search(
            r'href="(https://www\.linkedin\.com/company/[^"]+)"', html
        )
        if company_link:
            details["company_linkedin_url"] = company_link.group(1).split("?")[0]

        # ── Education ───────────────────────────────────────────────────
        edu_match = re.search(
            r'"alumniOf"\s*:\s*\[\s*\{[^}]*"name"\s*:\s*"([^"]+)"', html, re.DOTALL
        )
        if edu_match:
            details["education"] = edu_match.group(1).strip()

        # Education degree — only inside alumniOf block
        deg_match = re.search(
            r'"alumniOf"\s*:\s*\[\s*\{[^}]*"description"\s*:\s*"([^"]+)"', html, re.DOTALL
        )
        edu_degree_text = ""
        if deg_match:
            edu_degree_text = deg_match.group(1).strip()
            details["education_degree"] = edu_degree_text

        # ── Industry ────────────────────────────────────────────────────
        ind_match = re.search(r'"industry"\s*:\s*"([^"]+)"', html, re.IGNORECASE)
        if ind_match:
            details["industry"] = ind_match.group(1).strip()

        # ── Summary / About ─────────────────────────────────────────────
        # The person's summary/about is in the top-level "description" of
        # the Person JSON-LD object. We must NOT match the alumniOf
        # description (education degree) or any short meta descriptions.
        summary_found = False

        # Try 1: Person object description (near @type Person)
        person_desc = re.search(
            r'"@type"\s*:\s*"Person"[^}]*"description"\s*:\s*"([^"]{30,1000})"',
            html, re.IGNORECASE | re.DOTALL,
        )
        if person_desc:
            desc = person_desc.group(1).strip()
            if desc != edu_degree_text and "linkedin" not in desc.lower()[:30]:
                details["summary"] = desc[:500]
                summary_found = True

        # Try 2: Any "description" that is long enough and NOT the degree
        if not summary_found:
            for m in re.finditer(r'"description"\s*:\s*"([^"]{40,1000})"', html, re.IGNORECASE | re.DOTALL):
                desc = m.group(1).strip()
                # Skip if it's the same as the education degree
                if desc == edu_degree_text:
                    continue
                # Skip LinkedIn boilerplate
                if "linkedin" in desc.lower()[:30]:
                    continue
                details["summary"] = desc[:500]
                break

        # ── Skills (from JSON-LD or visible text) ───────────────────────
        skills_matches = re.findall(r'"skill"\s*:\s*\[\s*"([^"]+)"', html, re.IGNORECASE)
        if not skills_matches:
            skills_matches = re.findall(r'"name"\s*:\s*"([^"]{2,40})".*?"@type"\s*:\s*"DefinedTerm"', html, re.IGNORECASE | re.DOTALL)
        if skills_matches:
            details["skills"] = list(dict.fromkeys(skills_matches))[:15]

        # ── Connections count ───────────────────────────────────────────
        conn_match = re.search(r'(\d+)\+?\s*connections', html, re.IGNORECASE)
        if conn_match:
            details["connections_count"] = int(conn_match.group(1))

        # ── Followers count ─────────────────────────────────────────────
        foll_match = re.search(r'(\d[\d,]*)\s*followers', html, re.IGNORECASE)
        if foll_match:
            details["followers_count"] = int(foll_match.group(1).replace(",", ""))

        # ── Profile language ────────────────────────────────────────────
        lang_match = re.search(r'"inLanguage"\s*:\s*"([^"]+)"', html, re.IGNORECASE)
        if lang_match:
            details["profile_language"] = lang_match.group(1).strip()

        # ── Sanitise all text fields (remove Hindi/non-Latin, *, #) ────
        text_fields = [
            "first_name", "last_name", "full_name", "title", "organization",
            "location", "city", "state", "country", "education",
            "education_degree", "summary", "industry",
        ]
        for field in text_fields:
            if field in details and isinstance(details[field], str):
                details[field] = self._clean_text(details[field])

        # Clean skills list
        if "skills" in details and isinstance(details["skills"], list):
            details["skills"] = [self._clean_text(s) for s in details["skills"] if self._clean_text(s)]

        return details

    # ── Tavily helpers ───────────────────────────────────────────────────

    async def _tavily_search(
        self, query: str, max_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Run an advanced Tavily search and return results."""
        if not self.tavily_api_key:
            return []

        payload = {
            "api_key": self.tavily_api_key,
            "query": query,
            "search_depth": "advanced",
            "max_results": max_results,
            "include_answer": False,
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://api.tavily.com/search", json=payload
                )
                if resp.status_code != 200:
                    logger.warning(f"Tavily returned {resp.status_code}")
                    return []
                data = resp.json()
                return data.get("results", [])
        except Exception as e:
            logger.warning(f"Tavily search failed: {e}")
            return []

    async def _get_company_signals(
        self, company_name: str, location: str = ""
    ) -> List[Dict[str, str]]:
        """Fetch company signals via Tavily."""
        query = f'"{company_name}" {location} company news updates funding'.strip()
        results = await self._tavily_search(query, max_results=5)
        return [
            {
                "title": self._clean_text(r.get("title", "")),
                "url": r.get("url", ""),
                "content": self._clean_text(r.get("content", "")),
                "score": str(r.get("score", 0)),
                "source": "tavily_company",
            }
            for r in results
        ]

    async def _get_person_signals(
        self, person_name: str, company_name: str = "", location: str = ""
    ) -> List[Dict[str, str]]:
        """Fetch person signals via Tavily (3 queries, deduplicated)."""
        queries = [
            f'"{person_name}" professional executive leader',
            f'"{person_name}" {company_name} representative contact',
            f'"{person_name}" {location} news announcement article',
        ]

        all_results: List[Dict[str, Any]] = []
        for q in queries:
            results = await self._tavily_search(q.strip(), max_results=3)
            all_results.extend(results)

        # Deduplicate by title
        seen: set = set()
        unique: List[Dict[str, str]] = []
        for r in all_results:
            t = r.get("title", "")
            if t not in seen:
                seen.add(t)
                unique.append(
                    {
                        "title": self._clean_text(t),
                        "url": r.get("url", ""),
                        "content": self._clean_text(r.get("content", "")),
                        "score": str(r.get("score", 0)),
                        "source": "tavily_person",
                    }
                )
        return unique[:5]

    # ── Main search ──────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        location: str = "United States",
        limit: int = 20,
        include_signals: bool = True,
    ) -> Dict[str, Any]:
        """
        Search for leads using ZenRows + Tavily.

        Returns:
            {
                "leads": [...],
                "meta": { total, returned, execution_time_ms }
            }
        """
        start = datetime.now(timezone.utc)

        # Step 1: Google→LinkedIn URL discovery
        try:
            urls = await self._search_google_linkedin(query, location, limit)
        except DatabaseFinderError as e:
            logger.warning(f"ZenRows search failed ({e.message}), falling back to Tavily")
            urls = []
        if len(urls) < limit:
            fallback = await self._search_tavily_linkedin(query, location, limit - len(urls))
            for u in fallback:
                if u not in urls:
                    urls.append(u)
                if len(urls) >= limit:
                    break

        if not urls:
            return {
                "leads": [],
                "meta": {
                    "total_results": 0,
                    "returned_results": 0,
                    "execution_time_ms": int(
                        (datetime.now(timezone.utc) - start).total_seconds() * 1000
                    ),
                    "query": query,
                    "location": location,
                },
            }

        # Step 2: Scrape each profile (concurrently, max 5 at a time)
        sem = asyncio.Semaphore(5)

        async def scrape_with_limit(url: str) -> Dict[str, Any]:
            async with sem:
                return await self._scrape_linkedin_profile(url)

        profile_tasks = [scrape_with_limit(u) for u in urls]
        raw_profiles = await asyncio.gather(*profile_tasks, return_exceptions=True)

        profiles = [p for p in raw_profiles if isinstance(p, dict)]

        # Step 3: Enrich with Tavily signals (concurrent)
        if include_signals and self.tavily_api_key:
            # Collect company signals (deduplicated by company name)
            companies_seen: Dict[str, List[Dict]] = {}
            person_signal_tasks = []

            for prof in profiles:
                org = prof.get("organization", "") or query
                if org and org not in companies_seen:
                    companies_seen[org] = []

                full_name = prof.get("full_name", "")
                if full_name:
                    person_signal_tasks.append(
                        (full_name, self._get_person_signals(full_name, org, location))
                    )

            # Fetch company signals
            company_tasks = {
                name: self._get_company_signals(name, location)
                for name in companies_seen
            }
            company_results = {}
            if company_tasks:
                results = await asyncio.gather(
                    *company_tasks.values(), return_exceptions=True
                )
                for name, result in zip(company_tasks.keys(), results):
                    company_results[name] = result if isinstance(result, list) else []

            # Fetch person signals (limit to first 10 to avoid API overuse)
            person_results: Dict[str, List[Dict]] = {}
            if person_signal_tasks:
                limited = person_signal_tasks[:10]
                results = await asyncio.gather(
                    *[t[1] for t in limited], return_exceptions=True
                )
                for (name, _), result in zip(limited, results):
                    person_results[name] = result if isinstance(result, list) else []

            # Merge signals into profiles
            for prof in profiles:
                org = prof.get("organization", "") or query
                prof["company_signals"] = company_results.get(org, [])

                full_name = prof.get("full_name", "")
                prof["person_signals"] = person_results.get(full_name, [])

                # Flatten signals into summary text
                all_sigs = prof.get("company_signals", []) + prof.get("person_signals", [])
                sig_texts = [self._clean_text(s.get("content", "")[:200]) for s in all_sigs if s.get("content")]
                prof["signals_summary"] = " | ".join(sig_texts[:5]) if sig_texts else ""
                prof["signals_count"] = len(all_sigs)

        # Step 4: Build final lead records with 30-40 fields
        leads = []
        for i, prof in enumerate(profiles):
            lead = self._build_lead_record(prof, query, location, i)
            leads.append(lead)

        elapsed = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)

        return {
            "leads": leads,
            "meta": {
                "total_results": len(leads),
                "returned_results": len(leads),
                "execution_time_ms": elapsed,
                "query": query,
                "location": location,
            },
        }

    def _build_lead_record(
        self,
        profile: Dict[str, Any],
        query: str,
        location: str,
        index: int,
    ) -> Dict[str, Any]:
        """Build a standardized lead record with 30-40 fields."""
        first_name = profile.get("first_name", "")
        last_name = profile.get("last_name", "")
        full_name = profile.get("full_name", f"{first_name} {last_name}".strip())
        org = profile.get("organization", "") or query
        linkedin_url = profile.get("linkedin_url", "")

        # Generate a deterministic ID
        id_seed = f"{linkedin_url}:{full_name}:{org}"
        lead_id = hashlib.sha256(id_seed.encode()).hexdigest()[:16]

        # Infer seniority from title
        title = profile.get("title", "")
        seniority = self._infer_seniority(title)

        # Infer department from title
        department = self._infer_department(title)

        # Derive domain from company LinkedIn
        domain = ""
        company_li = profile.get("company_linkedin_url", "")
        if company_li:
            slug = company_li.rstrip("/").split("/")[-1]
            domain = f"{slug}.com"

        return {
            # Identity (9 fields)
            "id": lead_id,
            "first_name": first_name,
            "last_name": last_name,
            "full_name": full_name,
            "email": profile.get("email", ""),
            "phone": profile.get("phone", ""),
            "linkedin_url": linkedin_url,
            "twitter_url": profile.get("twitter_url", ""),
            "website": profile.get("website", ""),
            # Professional (10 fields)
            "title": title,
            "seniority_level": seniority,
            "department": department,
            "organization_name": org,
            "company_domain": domain,
            "company_linkedin_url": company_li,
            "industry": profile.get("industry", ""),
            "education": profile.get("education", ""),
            "education_degree": profile.get("education_degree", ""),
            "summary": profile.get("summary", ""),
            # Skills (1 field)
            "skills": profile.get("skills", []),
            # Location (5 fields)
            "location": profile.get("location", location),
            "city": profile.get("city", ""),
            "state": profile.get("state", ""),
            "country": profile.get("country", location),
            "profile_language": profile.get("profile_language", ""),
            # Network (3 fields)
            "connections_count": profile.get("connections_count", 0),
            "followers_count": profile.get("followers_count", 0),
            "mutual_connections": 0,
            # Signals (6 fields)
            "signals_count": profile.get("signals_count", 0),
            "signals_summary": profile.get("signals_summary", ""),
            "company_signals": profile.get("company_signals", []),
            "person_signals": profile.get("person_signals", []),
            "recent_activity": "",
            "engagement_score": self._calc_engagement_score(profile),
            # Metadata (5 fields)
            "source": "zenrows_tavily",
            "search_query": query,
            "quality_score": self._calc_quality_score(profile),
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "data_completeness": self._calc_completeness(profile),
            # Status (2 fields)
            "status": "new",
            "enrichment_status": "scraped",
        }

    # ── Scoring helpers ──────────────────────────────────────────────────

    @staticmethod
    def _infer_seniority(title: str) -> str:
        if not title or not title.strip():
            return "Unknown"
        title_lower = title.lower().strip()
        # C-Suite — match whole words to avoid false positives
        c_suite_words = [
            r"\bceo\b", r"\bcto\b", r"\bcfo\b", r"\bcoo\b", r"\bcio\b", r"\bcmo\b", r"\bcpo\b",
            r"\bchief\b", r"\bfounder\b", r"\bco-founder\b", r"\bcofounder\b",
            r"\bpresident\b", r"\bowner\b", r"\bpartner\b", r"\bprincipal\b",
        ]
        if any(re.search(p, title_lower) for p in c_suite_words):
            return "C-Suite"
        vp_words = [
            r"\bvp\b", r"\bvice president\b", r"\bsvp\b", r"\bevp\b", r"\bavp\b",
        ]
        if any(re.search(p, title_lower) for p in vp_words):
            return "VP"
        director_words = [
            r"\bdirector\b", r"\bhead of\b", r"\bhead,\b",
        ]
        if any(re.search(p, title_lower) for p in director_words):
            return "Director"
        manager_words = [
            r"\bmanager\b", r"\blead\b", r"\bteam lead\b", r"\bsenior\b", r"\bsr\.\b",
            r"\bstaff\b", r"\bprincipal\b",
        ]
        if any(re.search(p, title_lower) for p in manager_words):
            return "Manager"
        entry_words = [
            r"\bintern\b", r"\bjunior\b", r"\bjr\.\b", r"\bassociate\b", r"\bentry\b",
            r"\btrainee\b", r"\bapprentice\b",
        ]
        if any(re.search(p, title_lower) for p in entry_words):
            return "Entry Level"
        # If title exists but no keywords matched — still a contributor
        return "Individual Contributor"

    @staticmethod
    def _infer_department(title: str) -> str:
        if not title or not title.strip():
            return ""
        title_lower = title.lower().strip()
        dept_map = {
            "Engineering": [
                "engineer", "developer", "software", "devops", "sre", "architect",
                "cto", "tech", "programming", "backend", "frontend", "fullstack",
                "full-stack", "data engineer", "ml ", "machine learning", "cloud",
                "infrastructure", "platform", "qa", "test", "automation",
            ],
            "Sales": [
                "sales", "account executive", "business development", "bdr", "sdr",
                "revenue", "account manager", "client", "partnerships", "deals",
                "commercial", "quota",
            ],
            "Marketing": [
                "marketing", "growth", "brand", "content", "seo", "cmo",
                "demand gen", "digital marketing", "social media", "communications",
                "pr ", "public relations", "advertising", "creative",
            ],
            "Product": [
                "product", "ux", "design", "ui", "user experience", "user interface",
                "product manager", "product owner", "scrum",
            ],
            "Operations": [
                "operations", "coo", "supply chain", "logistics", "procurement",
                "facilities", "admin", "office manager",
            ],
            "Finance": [
                "finance", "cfo", "accounting", "controller", "treasury",
                "audit", "tax", "financial", "bookkeep", "investment",
            ],
            "HR": [
                "hr", "human resources", "people", "talent", "recruiting",
                "recruiter", "hiring", "staffing", "culture", "employee",
                "workforce", "benefits", "payroll",
            ],
            "Legal": [
                "legal", "counsel", "compliance", "attorney", "lawyer",
                "regulatory", "policy", "governance",
            ],
            "Data & Analytics": [
                "data scientist", "data analyst", "analytics", "bi ", "business intelligence",
                "data science", "statistician", "insights",
            ],
            "Customer Success": [
                "customer success", "customer support", "support", "helpdesk",
                "service", "customer experience", "cx ", "onboarding",
            ],
            "IT": [
                "it ", "information technology", "sysadmin", "system admin",
                "network", "security", "cybersecurity", "infosec",
            ],
            "Education": [
                "professor", "teacher", "instructor", "lecturer", "academic",
                "education", "training", "coach",
            ],
            "Healthcare": [
                "doctor", "nurse", "physician", "medical", "health", "clinical",
                "pharma", "biotech",
            ],
            "Executive": [
                "ceo", "founder", "co-founder", "cofounder", "president",
                "managing director", "general manager", "owner", "chairman",
                "board", "chief executive",
            ],
            "Consulting": [
                "consultant", "advisory", "advisor", "consulting", "strategy",
                "strategist",
            ],
        }
        for dept, keywords in dept_map.items():
            if any(k in title_lower for k in keywords):
                return dept
        return ""

    @staticmethod
    def _calc_quality_score(profile: Dict[str, Any]) -> int:
        """0-100 score based on data completeness and signals."""
        score = 0
        if profile.get("full_name"):
            score += 15
        if profile.get("title"):
            score += 15
        if profile.get("organization"):
            score += 10
        if profile.get("email"):
            score += 20
        if profile.get("location"):
            score += 5
        if profile.get("education"):
            score += 5
        if profile.get("industry"):
            score += 5
        if profile.get("connections_count", 0) > 0:
            score += 5
        if profile.get("signals_count", 0) > 0:
            score += min(20, profile["signals_count"] * 4)
        return min(100, score)

    @staticmethod
    def _calc_engagement_score(profile: Dict[str, Any]) -> int:
        """0-100 engagement potential score."""
        score = 30  # Base
        if profile.get("signals_count", 0) > 3:
            score += 20
        if profile.get("connections_count", 0) > 500:
            score += 15
        elif profile.get("connections_count", 0) > 100:
            score += 10
        if profile.get("followers_count", 0) > 1000:
            score += 15
        if profile.get("twitter_url"):
            score += 10
        if profile.get("email"):
            score += 10
        return min(100, score)

    @staticmethod
    def _calc_completeness(profile: Dict[str, Any]) -> float:
        """Percentage of key fields populated."""
        fields = [
            "first_name", "last_name", "title", "organization",
            "email", "phone", "location", "industry", "education",
            "linkedin_url", "twitter_url", "website", "summary", "skills",
        ]
        filled = sum(1 for f in fields if profile.get(f))
        return round(filled / len(fields) * 100, 1)


    # ── Single-lead enrichment ───────────────────────────────────────────

    async def enrich_lead(self, linkedin_url: str) -> Dict[str, Any]:
        """Enrich a single lead by scraping their LinkedIn profile + signals."""
        profile = await self._scrape_linkedin_profile(linkedin_url)

        full_name = profile.get("full_name", "")
        org = profile.get("organization", "")

        if full_name:
            profile["person_signals"] = await self._get_person_signals(full_name, org)
        if org:
            profile["company_signals"] = await self._get_company_signals(org)

        all_sigs = profile.get("company_signals", []) + profile.get("person_signals", [])
        profile["signals_count"] = len(all_sigs)
        sig_texts = [self._clean_text(s.get("content", "")[:200]) for s in all_sigs if s.get("content")]
        profile["signals_summary"] = " | ".join(sig_texts[:5])

        return self._build_lead_record(profile, org, "", 0)
