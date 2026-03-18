"""Entry point for running the outmate Agentic MCP server.

This allows running the server with:
    python -m outmate.agentic.mcp
"""

from outmate.agentic.mcp.server import mcp

if __name__ == "__main__":
    mcp.run()
