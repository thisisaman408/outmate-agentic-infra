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
    DEFAULT_TIMEOUT = 60.0  # LinkedIn via mode=auto can take 30-50s

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
        mode: Optional[str] = None,
        js_render: bool = False,
        premium_proxy: bool = False,
        antibot: bool = False,
        proxy_country: Optional[str] = None,
        autoparse: bool = False,
        retries: int = 3,
    ) -> str:
        """Fetch a page through ZenRows proxy.

        Retry policy:
        - 429 (rate limit): retry with longer backoff (plan concurrency limit)
        - 5xx / ReadTimeout / ConnectError: retry with backoff
        - 422/400 (param conflict or unscrapable): fail immediately (permanent)
        - 402 (credits): fail immediately
        """
        if not self.zenrows_api_key:
            raise DatabaseFinderError("ZENROWS_API_KEY is not configured", 503)

        params: Dict[str, Any] = {
            "apikey": self.zenrows_api_key,
            "url": url,
        }

        if mode:
            params["mode"] = mode
        elif not any([js_render, premium_proxy, antibot, proxy_country, autoparse]):
            params["mode"] = "auto"

        if js_render:
            params["js_render"] = "true"
            params["wait"] = 5000
        if premium_proxy:
            params["premium_proxy"] = "true"
        if antibot:
            params["antibot"] = "true"
        if proxy_country:
            params["proxy_country"] = proxy_country.upper()
        if autoparse:
            params["autoparse"] = "true"

        last_error: Optional[Exception] = None
        for attempt in range(retries):
            try:
                async with httpx.AsyncClient(timeout=self.DEFAULT_TIMEOUT) as client:
                    resp = await client.get(self.ZENROWS_BASE, params=params)

                    if resp.status_code == 402:
                        raise DatabaseFinderError(
                            "ZenRows credits exhausted (402). Top up your account.", 402
                        )

                    # 422/400 = permanent failure (URL unscrapable or bad params) — don't retry
                    if resp.status_code in (422, 400):
                        logger.warning(f"ZenRows {resp.status_code} (permanent) for {url[:70]}")
                        raise DatabaseFinderError(
                            f"ZenRows {resp.status_code}: {resp.text[:80]}", 502
                        )

                    if resp.status_code == 429:
                        wait = (attempt + 1) * 10  # longer backoff — plan concurrency limit
                        logger.warning(f"ZenRows 429 for {url[:50]}. Retry in {wait}s ({attempt+1}/{retries})")
                        await asyncio.sleep(wait)
                        continue

                    if resp.status_code >= 500:
                        wait = (attempt + 1) * 2
                        logger.warning(f"ZenRows {resp.status_code} for {url[:50]}. Retry in {wait}s ({attempt+1}/{retries})")
                        await asyncio.sleep(wait)
                        continue

                    if resp.status_code >= 400:
                        raise DatabaseFinderError(
                            f"ZenRows {resp.status_code}: {resp.text[:80]}", 502
                        )

                    return resp.text

            except httpx.ReadTimeout:
                last_error = httpx.ReadTimeout("")
                logger.warning(f"ZenRows timeout for {url[:50]} ({attempt+1}/{retries})")
                await asyncio.sleep((attempt + 1) * 2)
            except httpx.RequestError as e:
                last_error = e
                logger.warning(f"ZenRows connection error for {url[:50]}: {type(e).__name__} ({attempt+1}/{retries})")
                await asyncio.sleep((attempt + 1) * 2)
            except DatabaseFinderError:
                raise

        raise DatabaseFinderError(f"ZenRows failed after {retries} attempts: {last_error}", 502)

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

        # Extract LinkedIn profile URLs (more lenient regex to capture in.uk. etc subdomains)
        pattern = r'href="(https://[a-z]{0,3}\.?linkedin\.com/in/[^"&?]+)"'
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
            # mode=auto lets ZenRows pick the optimal proxy/rendering config for LinkedIn
            html = await self._zenrows_get(profile_url, mode="auto", retries=3)
        except Exception as e:
            logger.warning(f"Failed to scrape {profile_url[:60]}: {type(e).__name__}")
            return {"linkedin_url": profile_url, "_scrape_failed": True}

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

    # ── Tavily enrichment fallback ──────────────────────────────────────

    async def _tavily_extract_linkedin(self, urls: List[str]) -> Dict[str, Dict[str, Any]]:
        """Extract LinkedIn profile content via Tavily Extract API.

        Sends up to 5 URLs per request (1 credit per 5 URLs).
        Returns {url: parsed_fields_dict} for each successfully extracted URL.
        """
        if not self.tavily_api_key or not urls:
            return {}

        payload = {
            "api_key": self.tavily_api_key,
            "urls": urls[:5],
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post("https://api.tavily.com/extract", json=payload)
                if resp.status_code != 200:
                    logger.warning(f"Tavily Extract returned {resp.status_code}")
                    return {}
                data = resp.json()
        except Exception as e:
            logger.warning(f"Tavily Extract failed: {e}")
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        for item in data.get("results", []):
            url = item.get("url", "")
            raw = item.get("raw_content", "")
            if not url or not raw or len(raw) < 50:
                logger.debug(f"Skipping extract for {url}: content too short ({len(raw)} chars)")
                continue

            logger.debug(f"Extracting from {url[:80]}... ({len(raw)} chars)")
            parsed = self._parse_extract_content(raw, url)
            if parsed:
                parsed["_enrichment_source"] = "tavily_enriched"
                results[url] = parsed
                logger.debug(f"  → Parsed: {parsed.get('full_name', 'N/A')} | {parsed.get('title', 'N/A')} @ {parsed.get('organization', 'N/A')}")

        if results:
            logger.info(f"Tavily Extract enriched {len(results)}/{len(urls)} profiles")
        return results

    def _parse_extract_content(self, raw_content: str, linkedin_url: str) -> Dict[str, Any]:
        """Parse Tavily Extract raw_content (text/markdown) into profile fields."""
        details: Dict[str, Any] = {}
        content = raw_content.strip()
        lines = [l.strip() for l in content.split("\n") if l.strip()]

        if not lines:
            return details

        # ── Name from URL slug (baseline) ──
        name_match = re.search(r"/in/([A-Za-z0-9\-%]+)", linkedin_url)
        if name_match:
            slug = self._strip_linkedin_slug_suffix(name_match.group(1))
            name = slug.replace("-", " ").title()
            name_words = [w for w in name.split() if re.match(r"^[A-Za-z]+$", w)]
            if name_words:
                details["first_name"] = name_words[0]
                details["last_name"] = " ".join(name_words[1:]) if len(name_words) > 1 else ""
                details["full_name"] = " ".join(name_words)

        # ── Scan first 20 lines for name override + headline + location ──
        for i, line in enumerate(lines[:20]):
            clean = self._clean_text(line)
            if not clean or len(clean) < 2:
                continue

            # Check if this line is a headline (contains role/company patterns)
            role, company = self._split_headline(clean)
            is_headline = bool(role) and bool(company) and ("at" in clean.lower() or "-" in clean or "|" in clean)

            # If looks like headline with BOTH role and company, extract them
            if is_headline and role and company:
                fname = details.get("first_name", "")
                lname = details.get("last_name", "")
                if not self._looks_like_name(role, fname, lname):
                    if not details.get("title"):
                        details["title"] = self._clean_text(role)
                if not details.get("organization"):
                    details["organization"] = self._clean_text(company)

            # Location pattern: "City, State" or "City, Country" or "City, Country Code"
            loc_match = re.match(r"^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)*)$", clean)
            if loc_match and not details.get("location"):
                details["location"] = clean
                details["city"] = loc_match.group(1)
                details["state"] = loc_match.group(2)

        # ── Section-based extraction from full text ──
        full_text = "\n".join(lines)
        full_lower = full_text.lower()

        # About / Summary (more flexible patterns)
        about_patterns = [
            r"(?:about|summary)\s*:?\s*\n([\s\S]{20,800}?)(?:\n\n|\n(?:experience|education|skills|activity|$))",
            r"(?:about|summary)\s*:?\s*([\s\S]{20,500}?)(?:\n(?:experience|education|skills)|\Z)",
        ]
        for pattern in about_patterns:
            about_match = re.search(pattern, full_lower)
            if about_match:
                summary_text = full_text[about_match.start(1):about_match.end(1)]
                summary_clean = self._clean_text(summary_text)
                if len(summary_clean) > 20:
                    details["summary"] = summary_clean[:500]
                    break

        # Experience - extract first role details more thoroughly
        exp_match = re.search(r"(?:experience|employment)\s*:?\s*\n([\s\S]{20,600}?)(?:\n\n|\n(?:education|skills)|\Z)", full_lower)
        if exp_match:
            exp_text = full_text[exp_match.start(1):exp_match.end(1)]
            exp_lines = [l.strip() for l in exp_text.split("\n") if l.strip()]
            # First line often has role/company
            for exp_line in exp_lines[:3]:
                role, company = self._split_headline(exp_line)
                if role and not details.get("title"):
                    details["title"] = self._clean_text(role)
                if company and not details.get("organization"):
                    details["organization"] = self._clean_text(company)

        # Education (more flexible)
        edu_patterns = [
            r"(?:education|university|school)\s*:?\s*\n([\s\S]{10,400}?)(?:\n\n|\n(?:skills|experience)|\Z)",
            r"(?:education|university|school)\s*:?\s*([\s\S]{10,200}?)(?:\n(?:skills)|\Z)",
        ]
        for pattern in edu_patterns:
            edu_match = re.search(pattern, full_lower)
            if edu_match:
                edu_text = full_text[edu_match.start(1):edu_match.end(1)]
                edu_clean = self._clean_text(edu_text)
                if edu_clean and not details.get("education"):
                    # First line/sentence is usually the school name
                    first_line = edu_clean.split("\n")[0] or edu_clean.split(".")[0]
                    details["education"] = first_line[:100]

                # Extract degree
                degree_patterns = [
                    r"\b(B\.?[AS]\.?|B\.?E\.?|B\.?Tech|M\.?[AS]\.?|M\.?[CS]\.?|M\.?Tech|MBA|PGDM|Ph\.?D\.?|D\.?M\.?|Bachelor|Master|Doctor|Associate)\b",
                    r"\b(Bachelor of|Master of|Doctor of)\s+[A-Za-z\s]+",
                ]
                for deg_pattern in degree_patterns:
                    degree_match = re.search(deg_pattern, edu_clean, re.IGNORECASE)
                    if degree_match and not details.get("education_degree"):
                        details["education_degree"] = degree_match.group(1)
                        break
                break

        # Skills (multi-format support)
        skills_match = re.search(r"skills\s*:?\s*\n([\s\S]{10,800}?)(?:\n(?:experience|education|activity|interests|$))", full_lower)
        if not skills_match:
            # Fallback: skills on same line or followed by text
            skills_match = re.search(r"skills[:\s]+([\s\S]{10,400}?)(?:\n(?:contact|experience|about|education|$)|\Z)", full_lower)

        if skills_match:
            skills_text = full_text[skills_match.start(1):skills_match.end(1)]
            # Split by newline, comma, semicolon, bullet
            skill_items = [self._clean_text(s)
                          for s in re.split(r"[\n,;•\-]+", skills_text)
                          if self._clean_text(s) and 2 < len(self._clean_text(s)) < 50]
            if skill_items:
                details["skills"] = skill_items[:30]

        # Industry/Work area from content
        industry_patterns = [
            r"(?:industry|sector|field|specialization|focus)\s*:?\s*([^\n]{3,80})",
            r"works at|works in|industry[:\s]+([A-Za-z\s&]{3,50})",
        ]
        for pattern in industry_patterns:
            industry_match = re.search(pattern, full_text, re.IGNORECASE)
            if industry_match:
                ind_text = industry_match.group(1)
                details["industry"] = self._clean_text(ind_text)
                break

        # Email (multiple patterns)
        email_patterns = [
            r"[a-zA-Z0-9][a-zA-Z0-9._%+\-]*[@](?:[a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}",
            r"email[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
        ]
        for pattern in email_patterns:
            email_match = re.search(pattern, full_text, re.IGNORECASE)
            if email_match and not details.get("email"):
                details["email"] = email_match.group(0).lower() if "@" in email_match.group(0) else email_match.group(1).lower()
                break

        # Phone (multiple patterns)
        phone_patterns = [
            r"phone[:\s]+([\+\d\s\(\)\-\.]{10,25})",
            r"(\+?[0-9]{1,3}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{0,4})",
        ]
        for pattern in phone_patterns:
            phone_match = re.search(pattern, full_text, re.IGNORECASE)
            if phone_match and not details.get("phone"):
                phone_str = phone_match.group(1) if phone_match.lastindex == 1 else phone_match.group(0)
                # Verify it has enough digits (at least 7)
                digits = re.sub(r"\D", "", phone_str)
                if len(digits) >= 7:
                    details["phone"] = phone_str.strip()
                    break

        # Connections & Followers
        conn_patterns = [
            r"(\d{1,3}(?:,\d{3})*)\s*\+?\s*(?:connections|linked)",
            r"connections\s*:?\s*(\d{1,3}(?:,\d{3})*)",
        ]
        for pattern in conn_patterns:
            conn_match = re.search(pattern, full_text, re.IGNORECASE)
            if conn_match and not details.get("connections_count"):
                try:
                    count = int(conn_match.group(1).replace(",", ""))
                    details["connections_count"] = count
                except:
                    pass
                break

        follower_match = re.search(r"(\d{1,3}(?:,\d{3})*)\s*\+?\s*followers", full_text, re.IGNORECASE)
        if follower_match and not details.get("followers_count"):
            try:
                details["followers_count"] = int(follower_match.group(1).replace(",", ""))
            except:
                pass

        # Company LinkedIn URL
        company_li_match = re.search(r"(https://(?:www\.)?linkedin\.com/company/[A-Za-z0-9\-]+)", full_text)
        if company_li_match and not details.get("company_linkedin_url"):
            details["company_linkedin_url"] = company_li_match.group(1).rstrip("/")

        logger.debug(f"Extract parsed: name={details.get('full_name', 'N/A')}, title={details.get('title', 'N/A')}, org={details.get('organization', 'N/A')}")
        return details

    async def _enrich_via_tavily_search(
        self,
        name: str,
        linkedin_url: str,
        query: str,
        location: str,
    ) -> Dict[str, Any]:
        """Use Tavily Search to fill identity/professional fields for a person.

        Runs 3 targeted searches to maximize field coverage:
        1. Professional identity (title, company)
        2. Education & university background
        3. Contact info & social media
        Returns a dict of populated fields.
        """
        if not self.tavily_api_key or not name:
            return {}

        details: Dict[str, Any] = {"_enrichment_source": "tavily_enriched"}

        # Search 1: Professional identity
        identity_query = f'"{name}" {query} title company role location'.strip()
        identity_results = await self._tavily_search(identity_query, max_results=5)

        # Search 2: Education + University background
        education_query = f'"{name}" {query} university college education degree alumni'.strip()
        education_results = await self._tavily_search(education_query, max_results=4)

        # Search 3: Contact + Email + Social media (prioritize contact info)
        contact_query = f'"{name}" {query} email contact phone social media linkedin'.strip()
        contact_results = await self._tavily_search(contact_query, max_results=5)

        all_results = identity_results + education_results + contact_results
        if not all_results:
            return details

        self._extract_fields_from_results(details, all_results, name, query)
        return details

    async def _search_decision_makers(
        self,
        company_name: str,
        location: str = "",
    ) -> List[str]:
        """Search for decision makers (executives, leaders) in a company.

        Returns list of decision maker names found for the company.
        """
        if not self.tavily_api_key or not company_name:
            return []

        search_query = f'{company_name} executives leadership team CEO CTO CFO VP director'.strip()
        try:
            results = await self._tavily_search(search_query, max_results=8)
            decision_makers = set()

            for r in results:
                title = r.get("title", "")
                content = r.get("content", "")
                combined = f"{title} {content}"

                # Extract names that appear with decision maker titles
                # Pattern: "Name - Title" or "Name, Title at Company"
                patterns = [
                    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:-|,)\s*(?:CEO|CTO|CFO|COO|VP|President|Director|Head)",
                    r"([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:is|was|serves as|as)\s+(?:the\s+)?(?:CEO|CTO|CFO|COO|VP|President|Director|Head)",
                ]

                for pattern in patterns:
                    matches = re.findall(pattern, combined, re.IGNORECASE)
                    for name in matches:
                        name_clean = name.strip()
                        if len(name_clean) > 3 and len(name_clean) < 50:
                            decision_makers.add(name_clean)

            logger.debug(f"Found {len(decision_makers)} decision makers for {company_name}")
            return list(decision_makers)[:10]  # Return top 10

        except Exception as e:
            logger.warning(f"Decision maker search failed for {company_name}: {e}")
            return []

    def _extract_fields_from_results(
        self,
        details: Dict[str, Any],
        results: List[Dict[str, Any]],
        name: str,
        query: str,
    ) -> None:
        """Extract structured fields from Tavily search results."""
        all_content = ""
        company_mentions: Dict[str, int] = {}
        linkedin_urls: List[str] = []

        # Extract full_name from search results (from title or content)
        if not details.get("full_name") and name:
            # Try to find full name in search results
            for r in results:
                title = r.get("title", "")
                content = r.get("content", "")
                url = r.get("url", "")

                # LinkedIn titles often have format: "Name - Title - Company | LinkedIn"
                if "linkedin.com" in url.lower():
                    # Extract name from LinkedIn title
                    parts = title.split("-")
                    if parts:
                        potential_name = parts[0].strip()
                        # Filter out just junk like "LinkedIn" or single words
                        name_parts = potential_name.split()
                        if len(name_parts) >= 2:
                            details["full_name"] = potential_name
                            details["first_name"] = name_parts[0]
                            details["last_name"] = " ".join(name_parts[1:])
                            break

            # If not found in title, use the search query name
            if not details.get("full_name"):
                details["full_name"] = name
                name_parts = name.split()
                if name_parts:
                    details["first_name"] = name_parts[0]
                    if len(name_parts) > 1:
                        details["last_name"] = " ".join(name_parts[1:])

        for r in results:
            title = r.get("title", "")
            content = r.get("content", "")
            url = r.get("url", "")
            all_content += f" {title} {content}"

            # Collect LinkedIn URLs (for company_linkedin_url)
            if "linkedin.com/company" in url.lower():
                linkedin_urls.append(url)
            elif "linkedin.com" in url.lower() and "/in/" not in url.lower():
                linkedin_urls.append(url)

            # Parse result titles — often "Name - Title - Company | LinkedIn"
            if "linkedin" in url.lower() and title:
                # Try _parse_title_tag format first
                role, company = self._parse_title_tag(title)
                if role and not details.get("title"):
                    clean_role = self._clean_text(role)
                    if not self._looks_like_name(clean_role, name.split()[0] if name else "", name.split()[-1] if len((name or "").split()) > 1 else ""):
                        details["title"] = clean_role
                if company and not details.get("organization"):
                    details["organization"] = self._clean_text(company)

                # Also try headline split as fallback
                if not details.get("title"):
                    role, company = self._split_headline(title.split("|")[0].strip())
                    if role:
                        clean_role = self._clean_text(role)
                        # Only skip if it's definitely a name
                        fname = details.get("first_name", "").split()[0] if details.get("first_name") else ""
                        lname = details.get("last_name", "").split()[-1] if details.get("last_name") else ""
                        if not self._looks_like_name(clean_role, fname, lname):
                            details["title"] = clean_role
                    if company and not details.get("organization"):
                        details["organization"] = self._clean_text(company)

                # Third fallback: extract first reasonable token from title (usually the job title)
                if not details.get("title"):
                    # Remove "| LinkedIn" and similar junk
                    clean_title = re.sub(r"\|\s*LinkedIn.*$", "", title, flags=re.IGNORECASE).strip()
                    # Try to get word clusters separated by dashes
                    segments = [s.strip() for s in clean_title.split("-") if s.strip()]
                    for segment in segments[1:]:  # Skip first segment (likely name)
                        if segment and len(segment) > 2 and segment.lower() != "linkedin":
                            # Check this segment has job-like keywords
                            if any(kw in segment.lower() for kw in ["manager", "director", "engineer", "developer",
                                                                     "vp", "ceo", "cto", "analyst", "consultant",
                                                                     "lead", "head", "officer", "president", "sales",
                                                                     "marketing", "senior", "junior", "architect"]):
                                details["title"] = self._clean_text(segment)
                                break
                            # Or if it looks like a reasonable title (capitalized, not too long)
                            elif 3 <= len(segment) <= 60 and segment[0].isupper() and " at " not in segment.lower():
                                details["title"] = self._clean_text(segment)
                                break

            # Count company mentions in content
            if content:
                # Look for "at {Company}" patterns
                at_matches = re.findall(r"(?:at|@|for)\s+([A-Z][A-Za-z0-9\s&.\-,]+?)(?:\s*[,.|;\n]|$)", content)
                for m in at_matches:
                    c = m.strip()
                    if c and len(c) > 2 and c.lower() != (name or "").lower():
                        company_mentions[c] = company_mentions.get(c, 0) + 1

            # Extract social/website URLs
            if url and "linkedin.com" not in url.lower():
                if "twitter.com" in url.lower() or "x.com" in url.lower():
                    if not details.get("twitter_url"):
                        details["twitter_url"] = url
                elif "github.com" in url.lower():
                    if not details.get("website"):
                        details["website"] = url
                elif not details.get("website") and not any(d in url.lower() for d in ["google.", "bing.", "tavily.", "facebook.", "youtube."]):
                    details["website"] = url

        # Organization: most-mentioned company, or use query as fallback
        if not details.get("organization") and company_mentions:
            best = max(company_mentions, key=company_mentions.get)
            details["organization"] = self._clean_text(best)

        # Company LinkedIn URL from collected URLs
        if linkedin_urls and not details.get("company_linkedin_url"):
            # Prefer company URLs over personal unless we have nothing else
            company_url = next((u for u in linkedin_urls if "linkedin.com/company" in u.lower()), None)
            if company_url:
                details["company_linkedin_url"] = company_url.rstrip("/")
            elif linkedin_urls:
                details["company_linkedin_url"] = linkedin_urls[0].rstrip("/")

        # Location: scan all content for "City, State/Country" patterns with more context
        if not details.get("location"):
            loc_patterns = [
                r"(?:based in|located in|from|lives in|working in|at)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)*)?)",
                r"([A-Z][a-z]+),\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)",
            ]
            for pattern in loc_patterns:
                loc = re.search(pattern, all_content)
                if loc:
                    if len(loc.groups()) == 1:
                        details["location"] = loc.group(1)
                        parts = loc.group(1).split(",")
                        details["city"] = parts[0].strip()
                        if len(parts) > 1:
                            details["state"] = parts[1].strip()
                    else:
                        details["location"] = f"{loc.group(1)}, {loc.group(2)}"
                        details["city"] = loc.group(1)
                        details["state"] = loc.group(2)
                    break

        # Email (multiple patterns for different formats)
        if not details.get("email"):
            email_patterns = [
                # Direct email format
                r"[a-zA-Z0-9][a-zA-Z0-9._%+\-]*@[a-zA-Z0-9\-]+(?:\.[a-zA-Z0-9\-]+)+",
                # "email: xxx@yyy.com" or "contact at xxx@yyy"
                r"(?:email|contact|reach|email address)[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
                # Look for name@company pattern
                r"(\w+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})",
            ]
            for pattern in email_patterns:
                email_match = re.search(pattern, all_content, re.IGNORECASE)
                if email_match:
                    if email_match.lastindex and email_match.lastindex >= 1:
                        email_str = email_match.group(1)
                    else:
                        email_str = email_match.group(0)

                    if "@" in email_str and email_str.count("@") == 1:
                        details["email"] = email_str.lower()
                        logger.debug(f"Email extracted: {email_str}")
                        break

        # Education (aggressive extraction - look for many patterns)
        if not details.get("education"):
            edu_patterns = [
                # "studied at/graduated from/attended X"
                r"(?:studied at|graduated from|attended|alumni of|alumni of|attends|alumnus|alumna of)\s+([A-Z][A-Za-z\s&.',-]{4,100}?)(?:\s*[,.|;\n]|$)",
                # "University/College of X" or just "X University"
                r"((?:University|Institute|College|School|Academy|Business School)\s+(?:of\s+)?[A-Z][A-Za-z\s&.',-]*?)(?:\s*[,.|;\n]|$)",
                # Common top universities (explicit list for better accuracy)
                r"\b(Stanford|Harvard|MIT|Berkeley|Yale|Princeton|Oxford|Cambridge|Carnegie Mellon|Northwestern|Duke|University of Pennsylvania|Penn|Cornell|Columbia|NYU|Texas|UCLA|Michigan|Illinois|Ohio State|Wisconsin)\b",
                # "Bachelor/Master/PhD from X"
                r"(?:Bachelor|Master|PhD|Doctorate|Associate)\s+(?:of|in|from)\s+([A-Za-z\s&,'.-]{5,100}?)(?:\s*[,.|;\n]|$)",
            ]
            for pattern in edu_patterns:
                edu = re.search(pattern, all_content, re.IGNORECASE)
                if edu:
                    # Handle group properly
                    if edu.lastindex and edu.lastindex >= 1:
                        edu_name = self._clean_text(edu.group(1))
                    else:
                        edu_name = self._clean_text(edu.group(0))

                    if len(edu_name) > 3 and len(edu_name) < 200:
                        details["education"] = edu_name[:100]
                        logger.debug(f"Education extracted: {edu_name}")
                        break

        # Summary (multiple aggressive strategies)
        if not details.get("summary"):
            summaries = []
            fname = (name.split()[0] if name else "").lower()

            # Strategy 1: Content that mentions the person's first name
            if fname:
                for r in results:
                    content = r.get("content", "")
                    if fname in content.lower() and len(content) > 80:
                        summaries.append(content)

            # Strategy 2: Look for paragraphs with professional keywords
            professional_keywords = [
                "experienced", "leads", "manages", "specializes", "focused on",
                "expertise in", "works with", "passionate about", "skilled in",
                "proficient in", "background in", "years of experience",
                "role as", "position as", "works as", "employed as"
            ]
            for r in results:
                content = r.get("content", "")
                if any(kw in content.lower() for kw in professional_keywords) and len(content) > 80:
                    summaries.append(content)

            # Strategy 3: Just use content from LinkedIn search results
            for r in results:
                if "linkedin.com" in r.get("url", "").lower():
                    content = r.get("content", "")
                    if len(content) > 100:
                        summaries.append(content)

            # Strategy 4: Use any substantial content from results
            for r in results:
                content = r.get("content", "")
                if len(content) > 120:
                    summaries.append(content)

            # Pick the best summary (longest that's reasonable)
            if summaries:
                best = max(summaries, key=len)
                clean_summary = self._clean_text(best[:550])
                if len(clean_summary) > 30:
                    details["summary"] = clean_summary
                    logger.debug(f"Summary extracted: {clean_summary[:100]}...")

        # Skills extraction from content (look for "skills include", "expertise", etc)
        if not details.get("skills"):
            skills_match = re.search(r"(?:skills|expertise|proficiencies|specialties)[:\s]+([^\n]{20,300})", all_content, re.IGNORECASE)
            if skills_match:
                skills_text = skills_match.group(1)
                skill_items = [self._clean_text(s) for s in re.split(r"[,;•]+", skills_text) if self._clean_text(s) and 2 < len(self._clean_text(s)) < 50]
                if skill_items:
                    details["skills"] = skill_items[:20]

        logger.debug(f"Search parsed: title={details.get('title', 'N/A')}, org={details.get('organization', 'N/A')}, email={details.get('email', 'N/A')}, edu={details.get('education', 'N/A')}")

    @staticmethod
    def _merge_profile_data(
        primary: Dict[str, Any],
        secondary: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Merge two profile dicts. Primary (ZenRows) values take precedence.

        String fields: use primary if non-empty, else secondary.
        List fields: merge and deduplicate.
        Int fields: use primary if > 0, else secondary.
        """
        merged = dict(primary)

        string_fields = [
            "first_name", "last_name", "full_name", "email", "phone",
            "twitter_url", "website", "title", "organization", "industry",
            "education", "education_degree", "summary", "location",
            "city", "state", "country", "profile_language",
            "company_linkedin_url", "company_domain",
        ]
        for field in string_fields:
            if not merged.get(field) and secondary.get(field):
                merged[field] = secondary[field]

        # List fields: merge
        for field in ["skills"]:
            primary_list = merged.get(field, []) or []
            secondary_list = secondary.get(field, []) or []
            combined = list(dict.fromkeys(primary_list + secondary_list))
            if combined:
                merged[field] = combined

        # Int fields
        for field in ["connections_count", "followers_count"]:
            if not merged.get(field, 0) and secondary.get(field, 0):
                merged[field] = secondary[field]

        # Track enrichment source
        if secondary.get("_enrichment_source"):
            merged["_enrichment_source"] = secondary["_enrichment_source"]

        # Clear scrape_failed if we now have real data
        if merged.get("title") and merged.get("organization"):
            merged.pop("_scrape_failed", None)

        return merged

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

        logger.info(f"[STEP 1] Found {len(urls)} URLs from Google search")

        if len(urls) < limit:
            fallback = await self._search_tavily_linkedin(query, location, limit - len(urls))
            for u in fallback:
                if u not in urls:
                    urls.append(u)
                if len(urls) >= limit:
                    break

        logger.info(f"[STEP 1 COMPLETE] Total URLs: {len(urls)}")

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

        # Step 2: Scrape profiles sequentially (ZenRows plan has 1 concurrent request limit)
        logger.info(f"[STEP 2] Scraping {len(urls)} profiles...")
        sem = asyncio.Semaphore(1)

        async def scrape_with_limit(url: str) -> Dict[str, Any]:
            async with sem:
                result = await self._scrape_linkedin_profile(url)
                await asyncio.sleep(2)  # pause between scrapes to avoid 429s
                return result

        profile_tasks = [scrape_with_limit(u) for u in urls]
        raw_profiles = await asyncio.gather(*profile_tasks, return_exceptions=True)

        profiles = [p for p in raw_profiles if isinstance(p, dict)]
        logger.info(f"[STEP 2 COMPLETE] Scraped {len(profiles)} profiles (from {len(raw_profiles)} attempts)")

        # Step 2.5: Tavily enrichment for profiles missing key data
        logger.info(f"[STEP 2.5] Starting enrichment (Tavily API available: {bool(self.tavily_api_key)})")

        if self.tavily_api_key:
            needs_enrichment = [
                p for p in profiles
                if p.get("_scrape_failed") or not p.get("title")
            ]

            logger.info(f"[STEP 2.5] {len(needs_enrichment)} profiles need enrichment (out of {len(profiles)})")

                # (a) Tavily Extract — batch of 5 URLs = 1 credit
                enrichment_urls = [p["linkedin_url"] for p in needs_enrichment if p.get("linkedin_url")]
                extract_results: Dict[str, Dict] = {}
                for i in range(0, len(enrichment_urls), 5):
                    batch = enrichment_urls[i:i + 5]
                    batch_result = await self._tavily_extract_linkedin(batch)
                    extract_results.update(batch_result)

                # Merge extract results
                for p in needs_enrichment:
                    url = p.get("linkedin_url", "")
                    if url in extract_results:
                        merged = self._merge_profile_data(p, extract_results[url])
                        p.update(merged)

                # (b) Tavily Search — only for profiles STILL missing title or org
                still_needs = [
                    p for p in needs_enrichment
                    if not p.get("title") or not p.get("organization")
                ]

                if still_needs:
                    logger.info(f"Tavily Search enriching {len(still_needs)} remaining profiles")
                    search_tasks = [
                        self._enrich_via_tavily_search(
                            name=p.get("full_name", ""),
                            linkedin_url=p.get("linkedin_url", ""),
                            query=query,
                            location=location,
                        )
                        for p in still_needs
                    ]
                    search_results = await asyncio.gather(*search_tasks, return_exceptions=True)

                    for p, result in zip(still_needs, search_results):
                        if isinstance(result, dict):
                            merged = self._merge_profile_data(p, result)
                            p.update(merged)

        # Step 3: Enrich with Tavily signals (concurrent)
        logger.info(f"[STEP 3] Adding signals (include_signals={include_signals})")

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

        # Step 3.5: Search for decision makers in target companies (concurrent)
        if self.tavily_api_key:
            companies_to_search = {}
            for prof in profiles:
                org = prof.get("organization", "").strip()
                if org and org not in companies_to_search:
                    companies_to_search[org] = []

            if companies_to_search:
                logger.info(f"Searching decision makers for {len(companies_to_search)} companies")
                dm_tasks = {
                    org: self._search_decision_makers(org, location)
                    for org in companies_to_search
                }

                dm_results = {}
                if dm_tasks:
                    results = await asyncio.gather(
                        *dm_tasks.values(), return_exceptions=True
                    )
                    for org, result in zip(dm_tasks.keys(), results):
                        dm_list = result if isinstance(result, list) else []
                        dm_results[org] = dm_list
                        if dm_list:
                            logger.info(f"Found {len(dm_list)} decision makers for {org}")

                # Add decision maker info to profiles
                for prof in profiles:
                    org = prof.get("organization", "").strip()
                    if org in dm_results:
                        prof["_company_decision_makers"] = dm_results[org]

        # Step 4: Build final lead records with 30-40 fields
        # Ensure all profiles have mandatory fields (Name and Title)
        # AGGRESSIVE FALLBACKS: Never return empty name or title
        logger.info(f"[STEP 4] Processing {len(profiles)} profiles for mandatory fields")

        for i, p in enumerate(profiles):
            orig_name = p.get("full_name", "")
            orig_title = p.get("title", "")

            # Ensure full_name exists - CRITICAL FIELD
            if not p.get("full_name", "").strip():
                first = p.get("first_name", "").strip() or ""
                last = p.get("last_name", "").strip() or ""
                if first or last:
                    p["full_name"] = f"{first} {last}".strip()
                    logger.debug(f"[{i}] Set full_name from names: {p['full_name']}")

                # If no parts available, try to extract from LinkedIn URL
                if not p.get("full_name"):
                    linkedin_url = p.get("linkedin_url", "")
                    if linkedin_url:
                        name_match = re.search(r"/in/([A-Za-z0-9\-%]+)", linkedin_url)
                        if name_match:
                            slug = name_match.group(1)
                            # Remove common suffixes like -1, -2, etc.
                            slug = re.sub(r"-\d+$", "", slug)
                            # Clean up and titlecase
                            name = slug.replace("-", " ").title()
                            p["full_name"] = name
                            logger.debug(f"[{i}] Set full_name from URL: {p['full_name']}")

                # FINAL FALLBACK: Generate from index
                if not p.get("full_name"):
                    p["full_name"] = f"Profile {i+1}"
                    logger.debug(f"[{i}] Using generic name: {p['full_name']}")

            # Ensure title exists - CRITICAL FIELD
            if not p.get("title", "").strip():
                # Strategy 1: Use organization if available
                org = p.get("organization", "").strip()
                if org:
                    p["title"] = f"Professional at {org}"
                    logger.debug(f"[{i}] Set title from org: {p['title']}")
                # Strategy 2: Use query keyword (the search role/title)
                elif query and query != p.get("full_name"):
                    p["title"] = query
                    logger.debug(f"[{i}] Set title from query: {p['title']}")
                # Strategy 3: Use seniority level if available
                elif p.get("seniority_level"):
                    p["title"] = f"{p.get('seniority_level')} Professional"
                    logger.debug(f"[{i}] Set title from seniority: {p['title']}")
                # FINAL FALLBACK: Just mark as professional
                else:
                    p["title"] = "Professional"
                    logger.debug(f"[{i}] Using generic title: Professional")

            # Force set organization if missing
            if not p.get("organization", "").strip():
                p["organization"] = query or "Unknown Company"
                logger.debug(f"[{i}] Set organization: {p['organization']}")

            # Log the result
            logger.info(f"[{i}] {p.get('full_name')} | {p.get('title')} @ {p.get('organization')}")

        logger.info(f"[STEP 4 COMPLETE] All {len(profiles)} profiles have name + title")

        # IMPORTANT: Don't filter! Return all profiles that have been enriched
        # We've added fallbacks above, so all profiles should have name + title now
        valid_profiles = profiles  # Return ALL profiles, not just complete ones

        if not profiles:
            logger.warning(f"No profiles found after scraping/enrichment. Total retrieved: {len(profiles)}")
        else:
            logger.info(f"Returning {len(valid_profiles)} profiles (all have fallback name + title)")

        leads = []
        for i, prof in enumerate(valid_profiles):
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
        title = self._clean_title(title)  # Remove years and junk
        seniority = self._infer_seniority(title)

        # Infer department from title
        department = self._infer_department(title)

        # Derive domain from company LinkedIn or use extracted domain
        domain = profile.get("company_domain", "")
        if not domain:
            company_li = profile.get("company_linkedin_url", "")
            if company_li:
                slug = company_li.rstrip("/").split("/")[-1]
                domain = f"{slug}.com"
        else:
            company_li = profile.get("company_linkedin_url", "")

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
            # Decision Making (1 field)
            "is_decision_maker": self._is_decision_maker(title, seniority),
            # Company Info (1 field)
            "company_decision_makers": profile.get("_company_decision_makers", []),
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
            "source": profile.get("_enrichment_source", "zenrows_tavily"),
            "search_query": query,
            "quality_score": self._calc_quality_score(profile),
            "discovered_at": datetime.now(timezone.utc).isoformat(),
            "data_completeness": self._calc_completeness(profile),
            # Status (2 fields)
            "status": "new",
            "enrichment_status": (
                "scraped" if not profile.get("_scrape_failed") and title
                else "tavily_enriched" if profile.get("_enrichment_source") == "tavily_enriched" and title
                else "partial"
            ),
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

    @staticmethod
    def _clean_title(title: str) -> str:
        """Remove years, numbers, and junk from title."""
        if not title:
            return ""
        # Remove 4-digit years (2020, 2024, etc.)
        cleaned = re.sub(r'\b(19|20)\d{2}\b', '', title)
        # Remove leading/trailing numbers and special chars
        cleaned = re.sub(r'^[\d\s\-.,|]+', '', cleaned)
        cleaned = re.sub(r'[\d\s\-.,|]+$', '', cleaned)
        # Clean up whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned if cleaned else title

    @staticmethod
    def _is_decision_maker(title: str, seniority: str) -> bool:
        """Determine if person is likely a decision maker based on title/seniority.

        Decision makers include:
        - C-Suite (CEO, CTO, CFO, etc.)
        - VPs and SVPs
        - Directors and above
        - Heads of departments
        - Founders and co-founders
        - Board members
        """
        if not title:
            return False

        decision_maker_keywords = [
            # C-Suite
            r"\bceo\b", r"\bcto\b", r"\bcfo\b", r"\bcoo\b", r"\bcio\b", r"\bcmo\b", r"\bcpo\b",
            r"\bchief\b", r"\bfounder\b", r"\bco-founder\b", r"\bcofounder\b",
            # President, Owner, Partner
            r"\bpresident\b", r"\bowner\b", r"\bpartner\b",
            # VP and above
            r"\bvp\b", r"\bvice president\b", r"\bsvp\b", r"\bevp\b", r"\bavp\b",
            # Director and Head roles
            r"\bdirector\b", r"\bhead of\b", r"\bhead,\b", r"\bgeneral manager\b",
            r"\bmanaging director\b", r"\bd\s*i\b",  # Director of...
            # Board and governance
            r"\bboard\b", r"\bchairman\b", r"\bchairwoman\b", r"\bchairperson\b",
            # Senior management (manager+ with senior/lead)
            r"\bsenior\s+manager\b", r"\blead\b", r"\bteam lead\b",
        ]

        title_lower = title.lower()
        is_keyword_match = any(re.search(p, title_lower) for p in decision_maker_keywords)
        is_senior = seniority in ["C-Suite", "VP", "Director"]

        # More inclusive: either keyword match OR senior seniority level
        return is_keyword_match or is_senior

    # ── Single-lead enrichment ───────────────────────────────────────────

    async def enrich_lead(self, linkedin_url: str) -> Dict[str, Any]:
        """Enrich a single lead by scraping their LinkedIn profile + signals."""
        profile = await self._scrape_linkedin_profile(linkedin_url)

        # Tavily enrichment fallback if scrape failed
        if profile.get("_scrape_failed") or not profile.get("title"):
            if self.tavily_api_key:
                # Try Extract first
                extract_result = await self._tavily_extract_linkedin([linkedin_url])
                if linkedin_url in extract_result:
                    profile = self._merge_profile_data(profile, extract_result[linkedin_url])

                # If still missing key fields, use Search
                if not profile.get("title") or not profile.get("organization"):
                    tavily_data = await self._enrich_via_tavily_search(
                        name=profile.get("full_name", ""),
                        linkedin_url=linkedin_url,
                        query=profile.get("organization", ""),
                        location="",
                    )
                    profile = self._merge_profile_data(profile, tavily_data)

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
