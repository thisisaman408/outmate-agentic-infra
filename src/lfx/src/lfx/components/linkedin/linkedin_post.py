"""LinkedIn Post Component.

Create posts on LinkedIn and retrieve profile information using the LinkedIn API.

API Reference: https://learn.microsoft.com/en-us/linkedin/
Auth: OAuth 2.0 Bearer token
"""

from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data


class LinkedInPostComponent(LCToolComponent):
    """Create posts on LinkedIn and retrieve profile information.

    Provide your LinkedIn OAuth 2.0 access token to create posts or fetch
    your profile data. Connect this tool to any social-media agent.
    """

    display_name = "LinkedIn Post"
    description = "Create posts on LinkedIn and retrieve profile information."
    icon = "Linkedin"
    name = "LinkedInPost"

    inputs = [
        SecretStrInput(
            name="access_token",
            display_name="LinkedIn Access Token",
            info="Your LinkedIn OAuth 2.0 access token.",
            required=True,
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            info="The operation to perform.",
            options=["create_post", "get_profile"],
            value="create_post",
        ),
        MessageTextInput(
            name="input_value",
            display_name="Post Content",
            info=(
                "Text content for the LinkedIn post, or leave empty for profile retrieval. "
                "When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
        StrInput(
            name="author_urn",
            display_name="Author URN",
            info='Your LinkedIn person URN (e.g., "urn:li:person:YOUR_ID").',
            required=False,
        ),
        DropdownInput(
            name="visibility",
            display_name="Visibility",
            info="Post visibility setting.",
            options=["PUBLIC", "CONNECTIONS"],
            value="PUBLIC",
            advanced=True,
        ),
    ]

    PROFILE_URL = "https://api.linkedin.com/v2/me"
    POSTS_URL = "https://api.linkedin.com/rest/posts"

    def _build_headers(self) -> dict[str, str]:
        """Build request headers for LinkedIn API calls."""
        return {
            "Authorization": f"Bearer {self.access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Linkedin-Version": "202603",
            "Content-Type": "application/json",
        }

    def _get_profile(self) -> dict[str, Any]:
        """Fetch the authenticated user's LinkedIn profile."""
        try:
            with httpx.Client(timeout=30) as client:
                response = client.get(self.PROFILE_URL, headers=self._build_headers())
        except httpx.RequestError as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 401:
            return {"error": "Invalid or expired access token. Check your LinkedIn OAuth token.", "status": 401}
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}

        try:
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict):
                return {
                    "error": f"Unexpected API response format (expected JSON object, got {type(data).__name__})",
                    "status": response.status_code,
                }
            return data
        except Exception as e:
            return {"error": f"API error: {e}", "status": response.status_code}

    def _create_post(self, content: str, author_urn: str, visibility: str) -> dict[str, Any]:
        """Create a post on LinkedIn."""
        if not content:
            return {"error": "Post content cannot be empty.", "status": 0}
        if not author_urn:
            return {"error": "Author URN is required to create a post.", "status": 0}

        body = {
            "author": author_urn,
            "commentary": content,
            "visibility": visibility,
            "distribution": {"feedDistribution": "MAIN_FEED"},
            "lifecycleState": "PUBLISHED",
        }

        try:
            with httpx.Client(timeout=30) as client:
                response = client.post(self.POSTS_URL, headers=self._build_headers(), json=body)
        except httpx.RequestError as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 401:
            return {"error": "Invalid or expired access token. Check your LinkedIn OAuth token.", "status": 401}
        if response.status_code == 429:
            return {"error": "Rate limit exceeded. Please wait and try again.", "status": 429}

        try:
            response.raise_for_status()
            # LinkedIn returns 201 with a x-restli-id header for the created post
            post_id = response.headers.get("x-restli-id", "unknown")
            return {"success": True, "post_id": post_id, "status": response.status_code}
        except Exception as e:
            error_detail = ""
            try:
                error_detail = response.text
            except Exception:
                pass
            return {"error": f"API error: {e}. {error_detail}".strip(), "status": response.status_code}

    def _format_profile_result(self, data: dict[str, Any]) -> str:
        """Format profile data into readable text."""
        lines = []
        lines.append(f"**Name:** {data.get('localizedFirstName', '')} {data.get('localizedLastName', '')}")
        lines.append(f"**ID:** {data.get('id', 'N/A')}")
        lines.append(f"**Person URN:** urn:li:person:{data.get('id', 'N/A')}")

        headline = data.get("localizedHeadline")
        if headline:
            lines.append(f"**Headline:** {headline}")

        return "\n".join(lines)

    def _format_post_result(self, data: dict[str, Any]) -> str:
        """Format post creation result into readable text."""
        if data.get("success"):
            return f"**Post created successfully.**\n**Post ID:** {data.get('post_id', 'N/A')}"
        return f"Failed to create post: {data.get('error', 'Unknown error')}"

    def run_model(self) -> list[Data]:
        """Run the LinkedIn operation with the configured inputs."""
        operation = getattr(self, "operation", "create_post")

        if operation == "get_profile":
            result = self._get_profile()
            if "error" in result:
                return [Data(text=f"LinkedIn API Error: {result['error']}", data=result)]
            formatted = self._format_profile_result(result)
            data = [Data(text=formatted, data=result)]
            self.status = data
            return data

        # create_post
        content = getattr(self, "input_value", "") or ""
        author_urn = getattr(self, "author_urn", "") or ""
        visibility = getattr(self, "visibility", "PUBLIC") or "PUBLIC"

        result = self._create_post(content, author_urn, visibility)
        if "error" in result:
            return [Data(text=f"LinkedIn API Error: {result['error']}", data=result)]

        formatted = self._format_post_result(result)
        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        access_token = self.access_token
        component = self

        def linkedin_action(
            operation: str = "create_post",
            content: str = "",
            author_urn: str = "",
            visibility: str = "PUBLIC",
        ) -> str:
            """Interact with LinkedIn. Create posts or retrieve profile information.

            Args:
                operation: The operation to perform: "create_post" or "get_profile".
                content: Text content for the LinkedIn post (required for create_post).
                author_urn: LinkedIn person URN (e.g., "urn:li:person:YOUR_ID"). Required for create_post.
                visibility: Post visibility: "PUBLIC" or "CONNECTIONS". Defaults to "PUBLIC".
            """
            if operation == "get_profile":
                result = component._get_profile()
                if "error" in result:
                    return f"LinkedIn API Error: {result['error']}"
                return component._format_profile_result(result)

            # create_post
            if not author_urn:
                author_urn_attr = getattr(component, "author_urn", "") or ""
                if author_urn_attr:
                    author_urn = author_urn_attr

            if not visibility:
                visibility = "PUBLIC"

            result = component._create_post(content, author_urn, visibility)
            if "error" in result:
                return f"LinkedIn API Error: {result['error']}"
            return component._format_post_result(result)

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=linkedin_action,
                name="linkedin_post",
                description=(
                    "Interact with LinkedIn. Create posts on LinkedIn or retrieve profile information. "
                    "Best for: Social media posting, LinkedIn automation, profile data retrieval."
                ),
            ),
        )
