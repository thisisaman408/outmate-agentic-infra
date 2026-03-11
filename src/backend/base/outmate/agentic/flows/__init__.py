"""Outmate Agentic Flows.

This package contains Python flow definitions for the Outmate Assistant feature.
Python flows are preferred over JSON flows for better maintainability and type safety.

Available flows:
- outmate_assistant: Main assistant flow for Q&A and component generation
- translation_flow: Intent classification and translation flow
"""

from outmate.agentic.flows.outmate_assistant import get_graph as get_outmate_assistant_graph
from outmate.agentic.flows.translation_flow import get_graph as get_translation_flow_graph

__all__ = [
    "get_outmate_assistant_graph",
    "get_translation_flow_graph",
]
