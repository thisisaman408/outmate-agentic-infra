"""Practical end-to-end tests for all 9 GTM data provider integrations.

Tests:
1. Component instantiation
2. Query parsing logic
3. Request parameter building
4. API call construction (mocked HTTP)
5. Response formatting
6. LangChain Tool building & invocation
7. Agent connectivity (Tool type compatibility)
8. Error handling (401, 429, 404)
"""

import json
from unittest.mock import MagicMock, patch

import pytest

# ─── Apollo ───────────────────────────────────────────────────────────────────

class TestApolloPeopleEnrichment:
    def setup_method(self):
        from lfx.components.apollo.apollo_people_enrichment import ApolloPeopleEnrichmentComponent
        self.comp = ApolloPeopleEnrichmentComponent()
        self.comp.api_key = "test-apollo-key"

    def test_instantiation(self):
        assert self.comp.display_name == "Apollo People Enrichment"
        assert self.comp.name == "ApolloPeopleEnrichment"

    def test_parse_email(self):
        result = self.comp._parse_query_string("john@stripe.com")
        assert result == {"email": "john@stripe.com"}

    def test_parse_linkedin(self):
        result = self.comp._parse_query_string("https://linkedin.com/in/johndoe")
        assert result == {"linkedin_url": "https://linkedin.com/in/johndoe"}

    def test_parse_name_at_domain(self):
        result = self.comp._parse_query_string("John Doe @ stripe.com")
        assert result == {"first_name": "John", "last_name": "Doe", "domain": "stripe.com"}

    def test_parse_name_at_keyword(self):
        result = self.comp._parse_query_string("John Doe at stripe.com")
        assert result == {"first_name": "John", "last_name": "Doe", "domain": "stripe.com"}

    def test_format_person_result(self):
        data = {
            "person": {
                "name": "John Doe",
                "title": "VP of Sales",
                "email": "john@stripe.com",
                "email_status": "verified",
                "seniority": "vp",
                "linkedin_url": "https://linkedin.com/in/johndoe",
                "city": "San Francisco",
                "state": "CA",
                "country": "US",
                "departments": ["sales"],
                "organization": {
                    "name": "Stripe",
                    "industry": "Financial Technology",
                    "website_url": "https://stripe.com",
                },
                "employment_history": [
                    {"title": "VP of Sales", "organization_name": "Stripe", "current": True},
                    {"title": "Director", "organization_name": "Square", "current": False},
                ],
            }
        }
        text = self.comp._format_person_result(data)
        assert "John Doe" in text
        assert "VP of Sales" in text
        assert "Stripe" in text
        assert "Financial Technology" in text
        assert "(Current)" in text

    def test_format_no_person(self):
        text = self.comp._format_person_result({})
        assert "No person data found" in text

    @patch("lfx.components.apollo.apollo_people_enrichment.requests.post")
    def test_api_call_headers(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"person": {"name": "Test"}}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        self.comp._enrich_person("my-api-key", {"email": "test@example.com"})

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        headers = call_kwargs.kwargs.get("headers") or call_kwargs[1].get("headers")
        assert headers["x-api-key"] == "my-api-key"
        assert headers["Content-Type"] == "application/json"

    @patch("lfx.components.apollo.apollo_people_enrichment.requests.post")
    def test_api_rate_limit(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_post.return_value = mock_response

        result = self.comp._enrich_person("key", {"email": "test@example.com"})
        assert "error" in result
        assert "Rate limit" in result["error"]

    @patch("lfx.components.apollo.apollo_people_enrichment.requests.post")
    def test_api_unauthorized(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_post.return_value = mock_response

        result = self.comp._enrich_person("bad-key", {"email": "test@example.com"})
        assert result["status"] == 401

    @patch("lfx.components.apollo.apollo_people_enrichment.requests.post")
    def test_run_model(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "person": {"name": "Jane Smith", "title": "CTO", "email": "jane@example.com",
                       "email_status": "verified", "seniority": "c_suite",
                       "city": "", "state": "", "country": "", "departments": [],
                       "organization": {"name": "Acme", "industry": "SaaS", "website_url": "acme.com"}}
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        self.comp.input_value = "jane@example.com"
        data = self.comp.run_model()
        assert len(data) == 1
        assert "Jane Smith" in data[0].text
        assert "CTO" in data[0].text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "apollo_people_enrichment"
        assert "Apollo" in tool.description
        assert callable(tool.func)

    @patch("lfx.components.apollo.apollo_people_enrichment.requests.post")
    def test_tool_invocation(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "person": {"name": "Test User", "title": "Engineer", "email": "t@x.com",
                       "email_status": "ok", "seniority": "senior",
                       "city": "", "state": "", "country": "", "departments": []}
        }
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        tool = self.comp.build_tool()
        result = tool.invoke({"email": "t@x.com"})
        assert "Test User" in result


class TestApolloOrgEnrichment:
    def setup_method(self):
        from lfx.components.apollo.apollo_org_enrichment import ApolloOrgEnrichmentComponent
        self.comp = ApolloOrgEnrichmentComponent()
        self.comp.api_key = "test-key"

    def test_parse_domain(self):
        result = self.comp._parse_query_string("stripe.com")
        assert result == {"domain": "stripe.com"}

    def test_parse_url(self):
        result = self.comp._parse_query_string("https://www.stripe.com/pricing")
        assert result == {"domain": "stripe.com"}

    def test_parse_linkedin(self):
        result = self.comp._parse_query_string("https://linkedin.com/company/stripe")
        assert result == {"linkedin_url": "https://linkedin.com/company/stripe"}

    def test_parse_company_name(self):
        result = self.comp._parse_query_string("Stripe Inc")
        assert result == {"organization_name": "Stripe Inc"}

    @patch("lfx.components.apollo.apollo_org_enrichment.requests.get")
    def test_api_call_uses_get(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"organization": {"name": "Stripe"}}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._enrich_org("key", {"domain": "stripe.com"})
        mock_get.assert_called_once()

    def test_format_result(self):
        data = {
            "organization": {
                "name": "Stripe", "website_url": "stripe.com", "industry": "FinTech",
                "estimated_num_employees": 8000, "founded_year": 2010,
                "annual_revenue": 14000000000, "total_funding": 2200000000,
                "latest_funding_stage": "Series I", "linkedin_url": "linkedin.com/company/stripe",
                "city": "SF", "state": "CA", "country": "US", "phone": "N/A",
                "technologies": ["React", "Python", "AWS", "Kubernetes"],
            }
        }
        text = self.comp._format_org_result(data)
        assert "Stripe" in text
        assert "FinTech" in text
        assert "8000" in text
        assert "React" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "apollo_org_enrichment"
        assert "company" in tool.description.lower()


# ─── People Data Labs ─────────────────────────────────────────────────────────

class TestPDLPersonEnrichment:
    def setup_method(self):
        from lfx.components.peopledatalabs.pdl_person_enrichment import PDLPersonEnrichmentComponent
        self.comp = PDLPersonEnrichmentComponent()
        self.comp.api_key = "test-pdl-key"
        self.comp.min_likelihood = 5

    def test_parse_email(self):
        result = self.comp._parse_query_string("john@stripe.com")
        assert result == {"email": "john@stripe.com"}

    def test_parse_linkedin(self):
        result = self.comp._parse_query_string("https://linkedin.com/in/johndoe")
        assert result == {"profile": "https://linkedin.com/in/johndoe"}

    def test_parse_phone(self):
        result = self.comp._parse_query_string("+1 555-123-4567")
        assert result == {"phone": "+1 555-123-4567"}

    def test_parse_name_at_company(self):
        result = self.comp._parse_query_string("John Doe at Stripe")
        assert result["first_name"] == "John"
        assert result["last_name"] == "Doe"
        assert result["company"] == "Stripe"

    @patch("lfx.components.peopledatalabs.pdl_person_enrichment.requests.get")
    def test_api_auth_header(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": 200, "likelihood": 8, "data": {"full_name": "Test"}}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._enrich_person("my-pdl-key", {"email": "test@example.com"})
        headers = mock_get.call_args.kwargs.get("headers") or mock_get.call_args[1].get("headers")
        assert headers["X-Api-Key"] == "my-pdl-key"

    @patch("lfx.components.peopledatalabs.pdl_person_enrichment.requests.get")
    def test_api_404_no_match(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = self.comp._enrich_person("key", {"email": "nobody@example.com"})
        assert "error" in result
        assert "No matching person" in result["error"]

    @patch("lfx.components.peopledatalabs.pdl_person_enrichment.requests.get")
    def test_api_402_credits(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 402
        mock_get.return_value = mock_response

        result = self.comp._enrich_person("key", {"email": "test@example.com"})
        assert result["status"] == 402

    def test_format_result(self):
        data = {
            "status": 200, "likelihood": 9,
            "data": {
                "full_name": "Jane Doe", "job_title": "VP Engineering",
                "job_title_levels": ["vp"], "job_company_name": "Stripe",
                "job_company_industry": "fintech", "job_company_size": "1001-5000",
                "job_company_employee_count": 3000, "location_name": "San Francisco, CA",
                "linkedin_url": "linkedin.com/in/janedoe",
                "emails": [{"address": "jane@stripe.com"}],
                "phone_numbers": ["+14155551234"],
                "experience": [
                    {"title": "VP Engineering", "company": {"name": "Stripe"}, "is_primary": True},
                ],
                "education": [
                    {"school": {"name": "MIT"}, "degrees": ["BS Computer Science"]},
                ],
            }
        }
        text = self.comp._format_person_result(data)
        assert "Jane Doe" in text
        assert "VP Engineering" in text
        assert "Stripe" in text
        assert "jane@stripe.com" in text
        assert "MIT" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "pdl_person_enrichment"
        assert "People Data Labs" in tool.description


class TestPDLCompanyEnrichment:
    def setup_method(self):
        from lfx.components.peopledatalabs.pdl_company_enrichment import PDLCompanyEnrichmentComponent
        self.comp = PDLCompanyEnrichmentComponent()
        self.comp.api_key = "test-key"

    def test_parse_domain(self):
        assert self.comp._parse_query_string("stripe.com") == {"website": "stripe.com"}

    def test_parse_ticker(self):
        assert self.comp._parse_query_string("AAPL") == {"ticker": "AAPL"}

    def test_parse_linkedin(self):
        result = self.comp._parse_query_string("https://linkedin.com/company/stripe")
        assert result == {"profile": "https://linkedin.com/company/stripe"}

    def test_parse_company_name(self):
        assert self.comp._parse_query_string("Stripe Inc") == {"name": "Stripe Inc"}

    def test_format_result(self):
        data = {
            "status": 200, "likelihood": 8,
            "display_name": "Stripe", "name": "stripe", "website": "stripe.com",
            "industry": "financial services", "type": "private",
            "employee_count": 8000, "size": "5001-10000", "founded": 2010,
            "total_funding_raised": 2200000000, "latest_funding_stage": "series i",
            "inferred_revenue": "$1B-$10B",
            "location": {"name": "San Francisco, California, United States"},
            "linkedin_url": "linkedin.com/company/stripe",
            "headline": "Financial infrastructure for the internet",
            "employee_growth_rate": {"12_month": 0.15},
            "recent_exec_hires": [{"job_title": "CFO", "joined_date": "2024-06"}],
            "tags": ["fintech", "payments", "saas"],
        }
        text = self.comp._format_company_result(data)
        assert "Stripe" in text
        assert "financial services" in text
        assert "8000" in text
        assert "CFO" in text
        assert "fintech" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "pdl_company_enrichment"


# ─── Hunter.io ────────────────────────────────────────────────────────────────

class TestHunterDomainSearch:
    def setup_method(self):
        from lfx.components.hunter.hunter_domain_search import HunterDomainSearchComponent
        self.comp = HunterDomainSearchComponent()
        self.comp.api_key = "test-hunter-key"

    def test_parse_domain(self):
        assert self.comp._parse_query("stripe.com") == {"domain": "stripe.com"}

    def test_parse_url_strips_prefix(self):
        assert self.comp._parse_query("https://www.stripe.com") == {"domain": "stripe.com"}

    def test_parse_company_name(self):
        assert self.comp._parse_query("Stripe Inc") == {"company": "Stripe Inc"}

    @patch("lfx.components.hunter.hunter_domain_search.requests.get")
    def test_api_key_as_param(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": {"domain": "stripe.com", "emails": []}, "meta": {}}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._search_domain("my-hunter-key", {"domain": "stripe.com"})
        params = mock_get.call_args.kwargs.get("params") or mock_get.call_args[1].get("params")
        assert params["api_key"] == "my-hunter-key"

    def test_format_result(self):
        data = {
            "data": {
                "domain": "stripe.com", "organization": "Stripe",
                "pattern": "{first}.{last}", "accept_all": False,
                "emails": [
                    {"value": "john@stripe.com", "confidence": 95, "first_name": "John",
                     "last_name": "Doe", "position": "CTO", "seniority": "executive",
                     "department": "it", "verification": {"status": "valid"}},
                ]
            },
            "meta": {"results": 150}
        }
        text = self.comp._format_result(data)
        assert "stripe.com" in text
        assert "john@stripe.com" in text
        assert "95%" in text
        assert "CTO" in text
        assert "valid" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "hunter_domain_search"


class TestHunterEmailFinder:
    def setup_method(self):
        from lfx.components.hunter.hunter_email_finder import HunterEmailFinderComponent
        self.comp = HunterEmailFinderComponent()
        self.comp.api_key = "test-key"

    def test_parse_name_at_domain(self):
        result = self.comp._parse_query_string("John Doe at stripe.com")
        assert result["first_name"] == "John"
        assert result["last_name"] == "Doe"
        assert result["domain"] == "stripe.com"

    def test_parse_name_at_symbol(self):
        result = self.comp._parse_query_string("John Doe @ stripe.com")
        assert result["first_name"] == "John"
        assert result["domain"] == "stripe.com"

    def test_parse_name_at_company(self):
        result = self.comp._parse_query_string("John Doe @ Stripe Inc")
        assert result["first_name"] == "John"
        assert result["company"] == "Stripe Inc"

    @patch("lfx.components.hunter.hunter_email_finder.requests.get")
    def test_gdpr_451(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 451
        mock_get.return_value = mock_response

        result = self.comp._find_email("key", {"first_name": "John", "last_name": "Doe", "domain": "x.com"})
        assert result["status"] == 451
        assert "GDPR" in result["error"]

    def test_format_result(self):
        data = {
            "data": {
                "email": "john.doe@stripe.com", "score": 92,
                "first_name": "John", "last_name": "Doe",
                "position": "CTO", "company": "Stripe", "domain": "stripe.com",
                "accept_all": False,
                "verification": {"status": "valid", "date": "2024-01-15"},
                "sources": [{"uri": "https://stripe.com/about", "domain": "stripe.com"}],
            },
            "meta": {}
        }
        text = self.comp._format_result(data)
        assert "john.doe@stripe.com" in text
        assert "92%" in text
        assert "valid" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "hunter_email_finder"

    @patch("lfx.components.hunter.hunter_email_finder.requests.get")
    def test_tool_invocation(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {"email": "found@x.com", "score": 90, "first_name": "A",
                     "last_name": "B", "position": "", "company": "X", "domain": "x.com",
                     "accept_all": False, "verification": {"status": "valid"}},
            "meta": {}
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        tool = self.comp.build_tool()
        result = tool.invoke({"first_name": "A", "last_name": "B", "domain": "x.com"})
        assert "found@x.com" in result


class TestHunterEmailVerifier:
    def setup_method(self):
        from lfx.components.hunter.hunter_email_verifier import HunterEmailVerifierComponent
        self.comp = HunterEmailVerifierComponent()
        self.comp.api_key = "test-key"

    @patch("lfx.components.hunter.hunter_email_verifier.requests.get")
    def test_verify_valid(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "email": "test@stripe.com", "status": "valid", "score": 95,
                "regexp": True, "gibberish": False, "disposable": False,
                "webmail": False, "mx_records": True, "smtp_server": True,
                "smtp_check": True, "accept_all": False, "block": False,
            }
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = self.comp._verify_email("key", "test@stripe.com")
        assert result["data"]["status"] == "valid"

    @patch("lfx.components.hunter.hunter_email_verifier.requests.get")
    def test_verify_in_progress_202(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 202
        mock_get.return_value = mock_response

        result = self.comp._verify_email("key", "test@example.com")
        assert "error" in result
        assert "in progress" in result["error"]

    def test_format_result(self):
        data = {
            "data": {
                "email": "test@stripe.com", "status": "valid", "score": 95,
                "regexp": True, "gibberish": False, "disposable": False,
                "webmail": False, "mx_records": True, "smtp_server": True,
                "smtp_check": True, "accept_all": False, "block": False,
            }
        }
        text = self.comp._format_result(data)
        assert "valid" in text.lower()
        assert "95" in text
        assert "MX Records" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "hunter_email_verifier"


# ─── NeverBounce ──────────────────────────────────────────────────────────────

class TestNeverBounceVerify:
    def setup_method(self):
        from lfx.components.neverbounce.neverbounce_verify import NeverBounceVerifyComponent
        self.comp = NeverBounceVerifyComponent()
        self.comp.api_key = "secret_test123"

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_api_key_passed_correctly(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success", "result": "valid",
            "flags": ["has_dns", "has_dns_mx", "smtp_connectable"],
            "suggested_correction": "", "execution_time": 500,
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._verify_email("secret_mykey", "test@example.com", address_info=True)
        params = mock_get.call_args.kwargs.get("params") or mock_get.call_args[1].get("params")
        assert params["key"] == "secret_mykey"
        assert params["email"] == "test@example.com"
        assert params["address_info"] == 1

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_valid_email(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success", "result": "valid",
            "flags": ["has_dns", "has_dns_mx", "smtp_connectable"],
            "suggested_correction": "",
            "address_info": {
                "original_email": "test@gmail.com", "normalized_email": "test@gmail.com",
                "addr": "test", "alias": "", "host": "gmail.com", "fqdn": "gmail.com",
                "domain": "gmail", "subdomain": "", "tld": "com",
            },
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = self.comp._verify_email("key", "test@gmail.com", address_info=True)
        assert result["result"] == "valid"

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_invalid_email(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success", "result": "invalid",
            "flags": ["has_dns", "has_dns_mx", "smtp_connectable"],
            "suggested_correction": "",
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = self.comp._verify_email("key", "fake@nonexistent.com")
        assert result["result"] == "invalid"

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_disposable_email(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success", "result": "disposable",
            "flags": ["disposable_email"], "suggested_correction": "",
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = self.comp._verify_email("key", "temp@throwaway.com")
        assert result["result"] == "disposable"

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_api_auth_failure(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"status": "auth_failure", "message": "Invalid API key"}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = self.comp._verify_email("bad_key", "test@example.com")
        assert "error" in result

    def test_format_result(self):
        data = {
            "result": "valid",
            "flags": ["has_dns", "has_dns_mx", "smtp_connectable", "free_email_host"],
            "suggested_correction": "",
            "address_info": {
                "original_email": "test@gmail.com", "normalized_email": "test@gmail.com",
                "host": "gmail.com", "domain": "gmail", "subdomain": "", "alias": "",
            },
        }
        text = self.comp._format_result(data)
        assert "VALID" in text
        assert "has_dns" in text
        assert "gmail.com" in text

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "neverbounce_email_verify"
        assert "NeverBounce" in tool.description

    @patch("lfx.components.neverbounce.neverbounce_verify.requests.get")
    def test_run_model(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success", "result": "valid",
            "flags": ["has_dns"], "suggested_correction": "",
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp.input_value = "test@gmail.com"
        self.comp.address_info = True
        self.comp.credits_info = False
        self.comp.timeout = 30
        data = self.comp.run_model()
        assert len(data) == 1
        assert "VALID" in data[0].text


# ─── BuiltWith ────────────────────────────────────────────────────────────────

class TestBuiltWithLookup:
    def setup_method(self):
        from lfx.components.builtwith.builtwith_lookup import BuiltWithLookupComponent
        self.comp = BuiltWithLookupComponent()
        self.comp.api_key = "test-bw-key"

    def test_clean_domain(self):
        assert self.comp._clean_domain("https://www.stripe.com/pricing") == "stripe.com"
        assert self.comp._clean_domain("stripe.com") == "stripe.com"
        assert self.comp._clean_domain("  http://example.org  ") == "example.org"

    @patch("lfx.components.builtwith.builtwith_lookup.requests.get")
    def test_paid_api_url(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"Results": []}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._lookup_domain("key", "stripe.com", use_free=False)
        url = mock_get.call_args.args[0] if mock_get.call_args.args else mock_get.call_args.kwargs.get("url", mock_get.call_args[0][0])
        assert "v22" in url

    @patch("lfx.components.builtwith.builtwith_lookup.requests.get")
    def test_free_api_url(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"domain": "stripe.com", "groups": []}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._lookup_domain("key", "stripe.com", use_free=True)
        url = mock_get.call_args.args[0] if mock_get.call_args.args else mock_get.call_args[0][0]
        assert "free1" in url

    @patch("lfx.components.builtwith.builtwith_lookup.requests.get")
    def test_api_key_as_param(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"Results": []}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp._lookup_domain("my-bw-key", "stripe.com")
        params = mock_get.call_args.kwargs.get("params") or mock_get.call_args[1].get("params")
        assert params["KEY"] == "my-bw-key"
        assert params["LOOKUP"] == "stripe.com"

    def test_format_paid_result(self):
        data = {
            "Results": [{
                "Lookup": "stripe.com",
                "Meta": {
                    "CompanyName": "Stripe", "Vertical": "Financial Technology",
                    "Country": "US", "Social": ["twitter.com/stripe"],
                },
                "Result": {
                    "Spend": 50000,
                    "Paths": [{
                        "Technologies": [
                            {"Name": "React", "Tag": "javascript", "Categories": ["JavaScript Frameworks"]},
                            {"Name": "Nginx", "Tag": "server", "Categories": ["Web Servers"]},
                            {"Name": "Google Analytics", "Tag": "analytics", "Categories": ["Analytics"]},
                        ]
                    }]
                }
            }]
        }
        text = self.comp._format_paid_result(data)
        assert "stripe.com" in text
        assert "Stripe" in text
        assert "React" in text
        assert "Nginx" in text
        assert "Google Analytics" in text
        assert "50,000" in text

    def test_format_free_result(self):
        data = {
            "domain": "stripe.com",
            "groups": [
                {"name": "analytics", "live": 5, "dead": 2, "categories": [
                    {"name": "Analytics", "live": 3, "dead": 1},
                    {"name": "Conversion Tracking", "live": 2, "dead": 1},
                ]},
                {"name": "javascript", "live": 8, "dead": 3, "categories": [
                    {"name": "JavaScript Frameworks", "live": 4, "dead": 1},
                ]},
            ]
        }
        text = self.comp._format_free_result(data)
        assert "stripe.com" in text
        assert "analytics" in text
        assert "13 live" in text  # 5 + 8

    def test_build_tool(self):
        tool = self.comp.build_tool()
        assert tool.name == "builtwith_tech_stack"
        assert "BuiltWith" in tool.description

    @patch("lfx.components.builtwith.builtwith_lookup.requests.get")
    def test_tool_invocation(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "Results": [{
                "Lookup": "example.com",
                "Meta": {},
                "Result": {"Spend": 0, "Paths": [{"Technologies": [
                    {"Name": "WordPress", "Tag": "cms", "Categories": ["CMS"]},
                ]}]}
            }]
        }
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        self.comp.use_free_api = False
        tool = self.comp.build_tool()
        result = tool.invoke({"domain": "example.com"})
        assert "WordPress" in result


# ─── Cross-component connectivity ─────────────────────────────────────────────

class TestToolAgentConnectivity:
    """Verify that all tool components produce outputs compatible with GTM agent inputs."""

    def test_all_tools_output_correct_type(self):
        """All tool components must have an output named 'api_build_tool' that returns Tool type."""
        from lfx.components.apollo.apollo_people_enrichment import ApolloPeopleEnrichmentComponent
        from lfx.components.apollo.apollo_org_enrichment import ApolloOrgEnrichmentComponent
        from lfx.components.peopledatalabs.pdl_person_enrichment import PDLPersonEnrichmentComponent
        from lfx.components.peopledatalabs.pdl_company_enrichment import PDLCompanyEnrichmentComponent
        from lfx.components.hunter.hunter_domain_search import HunterDomainSearchComponent
        from lfx.components.hunter.hunter_email_finder import HunterEmailFinderComponent
        from lfx.components.hunter.hunter_email_verifier import HunterEmailVerifierComponent
        from lfx.components.neverbounce.neverbounce_verify import NeverBounceVerifyComponent
        from lfx.components.builtwith.builtwith_lookup import BuiltWithLookupComponent

        components = [
            ApolloPeopleEnrichmentComponent, ApolloOrgEnrichmentComponent,
            PDLPersonEnrichmentComponent, PDLCompanyEnrichmentComponent,
            HunterDomainSearchComponent, HunterEmailFinderComponent,
            HunterEmailVerifierComponent, NeverBounceVerifyComponent,
            BuiltWithLookupComponent,
        ]

        for comp_cls in components:
            comp = comp_cls()
            output_names = [o.name for o in comp.outputs]
            assert "api_build_tool" in output_names, f"{comp_cls.__name__} missing api_build_tool output"
            assert "api_run_model" in output_names, f"{comp_cls.__name__} missing api_run_model output"

    def test_all_tools_build_valid_langchain_tools(self):
        """All tool components must return valid LangChain tools with name and description."""
        from lfx.components.apollo.apollo_people_enrichment import ApolloPeopleEnrichmentComponent
        from lfx.components.apollo.apollo_org_enrichment import ApolloOrgEnrichmentComponent
        from lfx.components.peopledatalabs.pdl_person_enrichment import PDLPersonEnrichmentComponent
        from lfx.components.peopledatalabs.pdl_company_enrichment import PDLCompanyEnrichmentComponent
        from lfx.components.hunter.hunter_domain_search import HunterDomainSearchComponent
        from lfx.components.hunter.hunter_email_finder import HunterEmailFinderComponent
        from lfx.components.hunter.hunter_email_verifier import HunterEmailVerifierComponent
        from lfx.components.neverbounce.neverbounce_verify import NeverBounceVerifyComponent
        from lfx.components.builtwith.builtwith_lookup import BuiltWithLookupComponent

        components = [
            ("Apollo People", ApolloPeopleEnrichmentComponent),
            ("Apollo Org", ApolloOrgEnrichmentComponent),
            ("PDL Person", PDLPersonEnrichmentComponent),
            ("PDL Company", PDLCompanyEnrichmentComponent),
            ("Hunter Domain", HunterDomainSearchComponent),
            ("Hunter Email", HunterEmailFinderComponent),
            ("Hunter Verify", HunterEmailVerifierComponent),
            ("NeverBounce", NeverBounceVerifyComponent),
            ("BuiltWith", BuiltWithLookupComponent),
        ]

        for label, comp_cls in components:
            comp = comp_cls()
            comp.api_key = "test-key"
            if hasattr(comp, "min_likelihood"):
                comp.min_likelihood = 5
            if hasattr(comp, "use_free_api"):
                comp.use_free_api = False

            tool = comp.build_tool()
            assert tool.name, f"{label}: tool.name is empty"
            assert tool.description, f"{label}: tool.description is empty"
            assert callable(tool.func), f"{label}: tool.func is not callable"
            print(f"  OK: {label} -> tool '{tool.name}'")

    def test_base_class_inheritance(self):
        """All components must inherit from LCToolComponent."""
        from lfx.base.langchain_utilities.model import LCToolComponent
        from lfx.components.apollo.apollo_people_enrichment import ApolloPeopleEnrichmentComponent
        from lfx.components.builtwith.builtwith_lookup import BuiltWithLookupComponent

        assert issubclass(ApolloPeopleEnrichmentComponent, LCToolComponent)
        assert issubclass(BuiltWithLookupComponent, LCToolComponent)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
