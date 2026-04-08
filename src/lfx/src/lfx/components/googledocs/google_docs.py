"""Google Docs Integration Component.

Read content from Google Docs documents using the Google Docs API.

API Reference: https://developers.google.com/docs/api/reference/rest/v1/documents/get
Endpoint: GET https://docs.googleapis.com/v1/documents/{documentId}
Auth: API key query parameter
"""

from typing import Any, cast

import httpx
from langchain_core.tools import StructuredTool

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import MessageTextInput, SecretStrInput, StrInput
from lfx.schema.data import Data


class GoogleDocsComponent(LCToolComponent):
    """Read content from Google Docs documents.

    Provide a Google API key and document ID to fetch and extract
    the text content of a Google Docs document.
    """

    display_name = "Google Docs"
    description = "Read content from Google Docs documents."
    icon = "Googledocs"
    name = "GoogleDocs"

    inputs = [
        SecretStrInput(
            name="api_key",
            display_name="Google API Key",
            info="Your Google API key with the Google Docs API enabled.",
            required=True,
        ),
        StrInput(
            name="document_id",
            display_name="Document ID",
            info=(
                "The document ID from the Google Docs URL. "
                "For example, in 'https://docs.google.com/document/d/DOCUMENT_ID/edit', "
                "the document ID is the DOCUMENT_ID portion."
            ),
            required=True,
        ),
        MessageTextInput(
            name="input_value",
            display_name="Search Query",
            info=(
                "Query or search term to filter the document content. "
                "When used as a tool, the agent will pass this automatically."
            ),
            tool_mode=True,
        ),
    ]

    API_URL = "https://docs.googleapis.com/v1/documents/{document_id}"

    def _fetch_document(self, api_key: str, document_id: str) -> dict[str, Any]:
        """Fetch a Google Docs document via the API."""
        url = self.API_URL.format(document_id=document_id.strip())
        params = {"key": api_key.strip()}

        try:
            response = httpx.get(url, params=params, timeout=30)
        except httpx.RequestError as e:
            return {"error": f"Network error: {e}", "status": 0}

        if response.status_code == 403:
            return {"error": "Access denied. Check your API key and document sharing settings.", "status": 403}
        if response.status_code == 404:
            return {"error": "Document not found. Verify the document ID is correct.", "status": 404}
        if response.status_code == 401:
            return {"error": "Invalid API key. Check your Google API key.", "status": 401}

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

    def _extract_text(self, data: dict[str, Any]) -> str:
        """Extract readable text from Google Docs API response.

        The response body contains structural elements with paragraph
        elements that hold the actual text runs.
        """
        title = data.get("title", "Untitled Document")
        body = data.get("body", {})
        content = body.get("content", [])

        paragraphs: list[str] = []

        for element in content:
            paragraph = element.get("paragraph")
            if not paragraph:
                continue

            text_parts: list[str] = []
            for para_element in paragraph.get("elements", []):
                text_run = para_element.get("textRun")
                if text_run:
                    text_content = text_run.get("content", "")
                    text_parts.append(text_content)

            line = "".join(text_parts).rstrip("\n")
            if line:
                paragraphs.append(line)

        document_text = "\n\n".join(paragraphs)
        return f"**{title}**\n\n{document_text}" if document_text else f"**{title}**\n\n(No text content found)"

    def _filter_by_query(self, text: str, query: str) -> str:
        """Filter document text by a search query, returning matching paragraphs."""
        if not query or not query.strip():
            return text

        query_lower = query.strip().lower()
        lines = text.split("\n\n")

        # Always keep the title (first line)
        matching = [lines[0]] if lines else []

        for line in lines[1:]:
            if query_lower in line.lower():
                matching.append(line)

        if len(matching) <= 1:
            return text + f"\n\n(No paragraphs matched the query '{query}'. Showing full document.)"

        return "\n\n".join(matching)

    def run_model(self) -> list[Data]:
        """Run the Google Docs reader with the configured inputs."""
        document_id = self.document_id
        if not document_id:
            return [Data(text="No document ID provided. Provide the document ID from the Google Docs URL.")]

        result = self._fetch_document(self.api_key, document_id)

        if "error" in result:
            return [Data(text=f"Google Docs API Error: {result['error']}", data=result)]

        text = self._extract_text(result)

        query = getattr(self, "input_value", None)
        if query:
            text = self._filter_by_query(text, query)

        data = [Data(text=text, data=result)]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        """Build a LangChain tool for agent use."""
        api_key = self.api_key
        document_id = self.document_id

        def read_google_doc(query: str = "") -> str:
            """Read content from a Google Docs document.

            Args:
                query: Optional search term to filter the document content.
                    If provided, only paragraphs containing this term are returned.
            """
            if not document_id:
                return "No document ID configured. Set the document ID in the component settings."

            result = self._fetch_document(api_key, document_id)

            if "error" in result:
                return f"Google Docs API Error: {result['error']}"

            text = self._extract_text(result)

            if query:
                text = self._filter_by_query(text, query)

            return text

        return cast(
            "Tool",
            StructuredTool.from_function(
                func=read_google_doc,
                name="google_docs_reader",
                description=(
                    "Read and search content from a Google Docs document. "
                    "Returns the full document text or paragraphs matching a search query. "
                    "Best for: Reading documents, extracting information, searching document content."
                ),
            ),
        )
