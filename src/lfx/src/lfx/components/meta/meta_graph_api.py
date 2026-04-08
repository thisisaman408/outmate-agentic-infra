"""Meta Graph API Component.

Post to Facebook Pages and read page information using the Meta Graph API.

API Reference: https://developers.facebook.com/docs/graph-api/reference
Base URL: https://graph.facebook.com/{api_version}
Auth: Page Access Token or User Access Token passed as a query parameter.
"""

import json
from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import DropdownInput, MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data


class MetaGraphAPIComponent(LCToolComponent):
    """Post to Facebook Pages and read insights using the Meta Graph API.

    Provide a Page Access Token and Page ID to publish posts, retrieve page
    information, or list recent page posts.
    """

    display_name = "Meta Graph API"
    description = "Post to Facebook Pages and read insights using the Meta Graph API."
    icon = "Meta"
    name = "MetaGraphAPI"

    inputs = [
        SecretStrInput(
            name="access_token",
            display_name="Access Token",
            info="Page Access Token (for posting) or User Access Token.",
            required=True,
        ),
        StrInput(
            name="page_id",
            display_name="Page ID",
            info="Facebook Page ID to interact with.",
            required=True,
        ),
        DropdownInput(
            name="operation",
            display_name="Operation",
            options=["post_to_page", "get_page_info", "get_page_posts"],
            value="post_to_page",
            info="The Graph API operation to perform.",
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Message Content",
            info=(
                "The message text to post to the page. "
                "When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
        StrInput(
            name="api_version",
            display_name="API Version",
            info="Graph API version to use (e.g., 'v25.0').",
            value="v25.0",
            required=False,
            advanced=True,
        ),
    ]

    def _base_url(self) -> str:
        """Return the Graph API base URL for the configured version."""
        version = getattr(self, "api_version", "v25.0") or "v25.0"
        return f"https://graph.facebook.com/{version}"

    def _post_to_page(self, token: str, page_id: str, message: str) -> dict[str, Any]:
        """Publish a post to a Facebook Page."""
        url = f"{self._base_url()}/{page_id}/feed"
        params = {"message": message, "access_token": token}

        try:
            response = httpx.post(url, params=params, timeout=30)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _get_page_info(self, token: str, page_id: str) -> dict[str, Any]:
        """Retrieve basic information about a Facebook Page."""
        url = f"{self._base_url()}/{page_id}"
        params = {
            "fields": "name,fan_count,about,website",
            "access_token": token,
        }

        try:
            response = httpx.get(url, params=params, timeout=30)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _get_page_posts(self, token: str, page_id: str) -> dict[str, Any]:
        """Retrieve recent posts from a Facebook Page."""
        url = f"{self._base_url()}/{page_id}/feed"
        params = {
            "fields": "message,created_time,permalink_url",
            "access_token": token,
        }

        try:
            response = httpx.get(url, params=params, timeout=30)
        except httpx.HTTPError as e:
            return {"error": f"Network error: {e}", "status": 0}

        return self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> dict[str, Any]:
        """Parse and validate an HTTP response from the Graph API."""
        if response.status_code == 401:  # noqa: PLR2004
            return {"error": "Invalid or expired access token.", "status": 401}
        if response.status_code == 403:  # noqa: PLR2004
            return {"error": "Insufficient permissions for this operation.", "status": 403}
        if response.status_code == 429:  # noqa: PLR2004
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

    def _format_page_info(self, data: dict[str, Any]) -> str:
        """Format page information into readable text."""
        if "error" in data:
            return f"Meta API Error: {data['error']}"

        lines = [
            f"**Page Name:** {data.get('name', 'N/A')}",
            f"**Fan Count:** {data.get('fan_count', 'N/A')}",
            f"**About:** {data.get('about', 'N/A')}",
            f"**Website:** {data.get('website', 'N/A')}",
            f"**Page ID:** {data.get('id', 'N/A')}",
        ]
        return "\n".join(lines)

    def _format_page_posts(self, data: dict[str, Any]) -> str:
        """Format page posts into readable text."""
        if "error" in data:
            return f"Meta API Error: {data['error']}"

        posts = data.get("data", [])
        if not posts:
            return "No posts found for this page."

        lines = []
        for i, post in enumerate(posts, 1):
            message = post.get("message", "(no text)")
            created = post.get("created_time", "N/A")
            permalink = post.get("permalink_url", "N/A")
            lines.append(f"**Post {i}:**")
            lines.append(f"  Message: {message}")
            lines.append(f"  Created: {created}")
            lines.append(f"  Link: {permalink}")
            lines.append("")

        return "\n".join(lines)

    def _format_post_result(self, data: dict[str, Any]) -> str:
        """Format a post creation result into readable text."""
        if "error" in data:
            return f"Meta API Error: {data['error']}"

        post_id = data.get("id", "unknown")
        return f"Post published successfully. Post ID: {post_id}"

    def run_model(self) -> list[Data]:
        """Run the selected Meta Graph API operation."""
        token = self.access_token
        page_id = self.page_id
        operation = self.operation

        if operation == "post_to_page":
            content = getattr(self, "input_value", "") or ""
            if not content.strip():
                return [Data(text="No message content provided. Please supply text to post.")]
            result = self._post_to_page(token, page_id, content)
            formatted = self._format_post_result(result)
        elif operation == "get_page_info":
            result = self._get_page_info(token, page_id)
            formatted = self._format_page_info(result)
        elif operation == "get_page_posts":
            result = self._get_page_posts(token, page_id)
            formatted = self._format_page_posts(result)
        else:
            return [Data(text=f"Unknown operation: {operation}")]

        if "error" in result:
            return [Data(text=formatted, data=result)]

        data = [Data(text=formatted, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        token = self.access_token
        page_id = self.page_id
        api_version = getattr(self, "api_version", "v25.0") or "v25.0"

        def meta_graph_api(
            message: str = "",
            operation: str = "post_to_page",
        ) -> str:
            """Interact with a Facebook Page via the Meta Graph API.

            Args:
                message: The text content to post (required for post_to_page).
                operation: One of 'post_to_page', 'get_page_info', 'get_page_posts'.
            """
            if operation == "post_to_page":
                if not message.strip():
                    return "No message content provided. Please supply text to post."
                result = self._post_to_page(token, page_id, message)
                return self._format_post_result(result)
            if operation == "get_page_info":
                result = self._get_page_info(token, page_id)
                return self._format_page_info(result)
            if operation == "get_page_posts":
                result = self._get_page_posts(token, page_id)
                return self._format_page_posts(result)
            return f"Unknown operation: {operation}"

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=meta_graph_api,
                name="meta_graph_api",
                description=(
                    "Interact with Facebook Pages via the Meta Graph API. "
                    "Publish posts, retrieve page information, or list recent posts. "
                    "Best for: Social media publishing, page analytics, content management."
                ),
            ),
        )
