/**
 * Formatting utilities for chat messages.
 * Contains functions for formatting time, tool titles, and file names.
 */

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @param showMsOnly - If true, only shows milliseconds (e.g., "250ms")
 * @returns Formatted time string
 *
 * @example
 * formatTime(2500, false) // "2.5s"
 * formatTime(2500, true) // "2500ms"
 * formatTime(125000, false) // "2m 5s"
 */
export function formatTime(ms: number, showMsOnly: boolean = false): string {
  if (showMsOnly) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Formats a duration in milliseconds to seconds with one decimal place.
 * Used for displaying "Thinking for X.Xs" or "Thought for X.Xs".
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted seconds string (e.g., "2.5s", "0.5s")
 *
 * @example
 * formatSeconds(2500) // "2.5s"
 * formatSeconds(500) // "0.5s"
 * formatSeconds(1234) // "1.3s"
 */
export function formatSeconds(ms: number): string {
  const seconds = Math.ceil((ms / 1000) * 10) / 10;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Formats a tool title by removing "Executed" prefix, replacing underscores with spaces,
 * removing markdown bold markers, and converting to uppercase.
 *
 * @param rawTitle - The raw title from the tool content
 * @returns Formatted tool title
 *
 * @example
 * formatToolTitle("Executed **my_tool**") // "MY TOOL"
 * formatToolTitle("some_tool_name") // "SOME TOOL NAME"
 */
export function formatToolTitle(rawTitle: string | undefined): string {
  if (!rawTitle) return "";

  return rawTitle
    .replace(/^Executed\s+/i, "")
    .replace(/_/g, " ")
    .replace(/\*\*/g, "")
    .trim()
    .toUpperCase();
}

/**
 * Maps a raw tool name to a friendly, human-readable label.
 * Used to replace developer-facing names like "search_web" with
 * approachable labels like "Searching the web".
 *
 * @param rawName - The raw tool name (may include "Executed", underscores, etc.)
 * @returns A friendly label string
 */
export function friendlyToolName(rawName: string | undefined): string {
  if (!rawName) return "Processing";

  // Clean the raw name first
  const cleaned = rawName
    .replace(/^Executed\s+/i, "")
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase();

  // Exact and prefix-based mappings — include provider name so users know the source
  const mappings: Array<{ match: (n: string) => boolean; label: string; icon: string }> = [
    // Web search tools
    { match: (n) => /duckduckgo|duck_duck_go/.test(n), label: "Searching the web via DuckDuckGo", icon: "Globe" },
    { match: (n) => /search[_\s]?web|web[_\s]?search/.test(n), label: "Searching the web", icon: "Globe" },
    { match: (n) => /tavily/.test(n), label: "Researching online via Tavily", icon: "Globe" },
    { match: (n) => /google[_\s]?search|serp/.test(n), label: "Searching via Google", icon: "Globe" },
    { match: (n) => /exa[_\s]?search/.test(n), label: "Searching via Exa", icon: "Globe" },
    { match: (n) => /perplexity/.test(n), label: "Researching via Perplexity", icon: "Globe" },

    // Contact / Prospect enrichment — distinguish people vs org
    { match: (n) => /apollo.*people|apollo.*person/.test(n), label: "Looking up person via Apollo.io", icon: "User" },
    { match: (n) => /apollo.*org/.test(n), label: "Looking up company via Apollo.io", icon: "Building2" },
    { match: (n) => /apollo/.test(n), label: "Enriching data via Apollo.io", icon: "User" },
    { match: (n) => /hunter.*email|hunter.*finder/.test(n), label: "Finding email via Hunter.io", icon: "Mail" },
    { match: (n) => /hunter.*domain/.test(n), label: "Searching contacts via Hunter.io", icon: "Mail" },
    { match: (n) => /hunter/.test(n), label: "Looking up via Hunter.io", icon: "Mail" },
    { match: (n) => /clearbit/.test(n), label: "Enriching via Clearbit", icon: "User" },
    { match: (n) => /pdl|peopledatalabs/.test(n), label: "Enriching via PeopleDataLabs", icon: "User" },
    { match: (n) => /linkedin/.test(n), label: "Checking LinkedIn", icon: "User" },
    { match: (n) => /neverbounce/.test(n), label: "Verifying email via NeverBounce", icon: "ShieldCheck" },
    { match: (n) => /prospect/.test(n), label: "Researching prospect", icon: "User" },

    // CRM tools
    { match: (n) => /hubspot/.test(n), label: "Accessing HubSpot", icon: "Database" },
    { match: (n) => /salesforce/.test(n), label: "Accessing Salesforce", icon: "Database" },
    { match: (n) => /zoho/.test(n), label: "Accessing Zoho CRM", icon: "Database" },

    // Document / content tools
    { match: (n) => /google[_\s]?docs/.test(n), label: "Working with Google Docs", icon: "FileText" },
    { match: (n) => /google[_\s]?sheets/.test(n), label: "Working with Google Sheets", icon: "Table" },
    { match: (n) => /notion/.test(n), label: "Accessing Notion", icon: "FileText" },

    // Communication tools
    { match: (n) => /email|send[_\s]?mail|smtp/.test(n), label: "Preparing email", icon: "Mail" },
    { match: (n) => /slack/.test(n), label: "Sending to Slack", icon: "MessageSquare" },

    // Analysis / processing
    { match: (n) => /scrape|crawl|firecrawl/.test(n), label: "Reading webpage", icon: "FileText" },
    { match: (n) => /parse|extract/.test(n), label: "Extracting information", icon: "FileSearch" },
    { match: (n) => /summarize|summary/.test(n), label: "Summarizing content", icon: "FileText" },
    { match: (n) => /translate/.test(n), label: "Translating content", icon: "Languages" },
    { match: (n) => /sentiment/.test(n), label: "Analyzing sentiment", icon: "BarChart" },
    { match: (n) => /generate|create|write/.test(n), label: "Generating content", icon: "Sparkles" },

    // Voice / call tools
    { match: (n) => /voice|call|bland|phone/.test(n), label: "Making a call", icon: "Phone" },

    // Data tools
    { match: (n) => /database|sql|query/.test(n), label: "Querying database", icon: "Database" },
    { match: (n) => /api[_\s]?call|http|fetch|request/.test(n), label: "Fetching data", icon: "Download" },
    { match: (n) => /upload/.test(n), label: "Uploading file", icon: "Upload" },
    { match: (n) => /download/.test(n), label: "Downloading file", icon: "Download" },

    // Image tools
    { match: (n) => /image|ocr|vision|screenshot/.test(n), label: "Processing image", icon: "Image" },

    // YouTube
    { match: (n) => /youtube|video/.test(n), label: "Analyzing video", icon: "Play" },
  ];

  for (const mapping of mappings) {
    if (mapping.match(cleaned)) {
      return mapping.label;
    }
  }

  // Fallback: humanize the tool name
  const humanized = cleaned
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Capitalize first letter
  return humanized.charAt(0).toUpperCase() + humanized.slice(1);
}

/**
 * Gets the icon name for a tool based on its raw name.
 */
export function getToolIcon(rawName: string | undefined): string {
  if (!rawName) return "Zap";

  const cleaned = rawName
    .replace(/^Executed\s+/i, "")
    .replace(/\*\*/g, "")
    .trim()
    .toLowerCase();

  const iconMappings: Array<{ match: (n: string) => boolean; icon: string }> = [
    { match: (n) => /duckduckgo|duck_duck_go|search|tavily|google|serp|exa|perplexity/.test(n), icon: "Globe" },
    { match: (n) => /apollo|clearbit|enrichment|prospect|linkedin|user/.test(n), icon: "UserSearch" },
    { match: (n) => /hunter|email|mail|smtp/.test(n), icon: "Mail" },
    { match: (n) => /hubspot|salesforce|zoho|crm|database|sql/.test(n), icon: "Database" },
    { match: (n) => /notion|docs|document|file|parse|extract|summary/.test(n), icon: "FileText" },
    { match: (n) => /sheets|table|csv/.test(n), icon: "Table" },
    { match: (n) => /slack|message/.test(n), icon: "MessageSquare" },
    { match: (n) => /scrape|crawl|firecrawl|webpage/.test(n), icon: "Globe" },
    { match: (n) => /translate/.test(n), icon: "Languages" },
    { match: (n) => /sentiment|analy/.test(n), icon: "BarChart3" },
    { match: (n) => /generate|create|write|sparkle/.test(n), icon: "Sparkles" },
    { match: (n) => /voice|call|bland|phone/.test(n), icon: "Phone" },
    { match: (n) => /image|ocr|vision|screenshot/.test(n), icon: "Image" },
    { match: (n) => /youtube|video/.test(n), icon: "Play" },
    { match: (n) => /upload/.test(n), icon: "Upload" },
    { match: (n) => /download|fetch|request|http|api/.test(n), icon: "Download" },
  ];

  for (const mapping of iconMappings) {
    if (mapping.match(cleaned)) {
      return mapping.icon;
    }
  }

  return "Zap";
}

/**
 * Formats a file name by truncating it if it exceeds the specified length,
 * while preserving the file extension.
 *
 * @param name - The file name to format
 * @param numberToTruncate - Maximum length before truncation (default: 25)
 * @returns Formatted file name
 *
 * @example
 * formatFileName("very-long-file-name.pdf", 10) // "very-long...pdf"
 * formatFileName("short.pdf", 10) // "short.pdf"
 */
export function formatFileName(
  name: string,
  numberToTruncate: number = 25,
): string {
  if (name[numberToTruncate] === undefined) {
    return name;
  }
  const fileExtension = name.split(".").pop(); // Get the file extension
  const baseName = name.slice(0, name.lastIndexOf(".")); // Get the base name without the extension
  if (baseName.length > 6) {
    return `${baseName.slice(0, numberToTruncate)}...${fileExtension}`;
  }
  return name;
}
