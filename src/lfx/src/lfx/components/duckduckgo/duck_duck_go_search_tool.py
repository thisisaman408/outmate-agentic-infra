from typing import cast

from langchain_community.tools import DuckDuckGoSearchRun

from lfx.base.langchain_utilities.model import LCToolComponent
from lfx.field_typing import Tool
from lfx.inputs.inputs import IntInput, MessageTextInput
from lfx.schema.data import Data


class DuckDuckGoSearchToolComponent(LCToolComponent):
    """DuckDuckGo web search as a Tool — no API key required.

    Connect this to any agent's Tools input to give it free web search capabilities.
    """

    display_name = "DuckDuckGo Search Tool"
    description = "Free web search tool using DuckDuckGo. No API key required. Connect to any agent's Tools input."
    icon = "DuckDuckGo"
    name = "DuckDuckGoSearchTool"

    inputs = [
        MessageTextInput(
            name="input_value",
            display_name="Search Query",
            info="The search query (used when running this component directly, not needed when used as a tool)",
            tool_mode=True,
        ),
        IntInput(
            name="max_results",
            display_name="Max Results",
            value=5,
            required=False,
            advanced=True,
            info="Maximum number of search results to return",
        ),
    ]

    def run_model(self) -> list[Data]:
        wrapper = DuckDuckGoSearchRun()
        result = wrapper.run(self.input_value or "")
        snippets = [s.strip() for s in result.split("\n") if s.strip()][: self.max_results]
        data = [Data(text=snippet, data={"content": snippet}) for snippet in snippets]
        self.status = data
        return data

    def build_tool(self) -> Tool:
        return cast("Tool", DuckDuckGoSearchRun())
