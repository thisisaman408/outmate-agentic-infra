export interface LeadPost {
  url: string;
  topic: string;
  date: string;
}

export interface LeadTweet {
  text: string;
  likes: number;
  retweets: number;
  date: string;
}

export interface LeadMessage {
  text: string;
  type: string;
  tone: string;
  charCount: number;
  referencedPost: string;
}

export interface Lead {
  name: string;
  title: string;
  company: string;
  email: string;
  emailUnverified: boolean;
  linkedin: string;
  twitter: string;
  posts: LeadPost[];
  tweets: LeadTweet[];
  companyIntel: string;
  bestHook: string;
  message: LeadMessage | null;
}

export interface LeadDiscoveryData {
  leads: Lead[];
  keyword: string;
  summary: {
    totalLeads: number;
    withEmail: number;
    withLinkedIn: number;
    withPosts: number;
    withMessages: number;
  };
}

/**
 * Extract all LinkedIn post URLs with their topics from a text block.
 */
function extractAllLinkedInPosts(text: string): LeadPost[] {
  const posts: LeadPost[] = [];
  const seen = new Set<string>();

  // Match markdown links: [Title](URL)
  const mdLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+linkedin\.com\/posts\/[^\s)]+)\)/gi;
  let match;
  while ((match = mdLinkPattern.exec(text)) !== null) {
    const url = match[2];
    if (seen.has(url)) continue;
    seen.add(url);
    const afterLink = text.slice(match.index + match[0].length, match.index + match[0].length + 200);
    const topicMatch = afterLink.match(/\s*[—–\-]\s*(.+?)(?:\n|$)/);
    let topic = topicMatch?.[1]?.trim() || match[1] || "";
    // If title is generic placeholder, try to extract a better topic from surrounding text
    if (topic.match(/^(Link to Post|URL|Post|View post|LinkedIn)$/i)) {
      // Look for "— topic" or just the next line of text
      const contextMatch = afterLink.match(/(?:\)\s*[—–\-]\s*|\n\s*)([\w][\w\s,''.!?]{10,80}?)(?:\n|$)/);
      topic = contextMatch?.[1]?.trim() || topic;
    }
    posts.push({ url, topic, date: "" });
  }

  // Match raw URLs not already in markdown links
  const rawUrlPattern = /(https?:\/\/(?:www\.)?linkedin\.com\/posts\/[^\s)\]]+)/gi;
  while ((match = rawUrlPattern.exec(text)) !== null) {
    const url = match[1];
    if (seen.has(url)) continue;
    seen.add(url);
    posts.push({ url, topic: "", date: "" });
  }

  return posts;
}

/**
 * Split the full output into per-lead text blocks.
 * Handles many formats:
 *   "### Lead 1: Name"  "### Lead N: Name"
 *   "## Lead Profile: Name"
 *   "## Name"  "### **Name**"
 *   "---" separated blocks with "### LinkedIn Message for Name"
 */
function splitIntoLeadBlocks(text: string): { name: string; block: string }[] {
  const results: { name: string; block: string }[] = [];
  const seen = new Set<string>();

  // Pattern: ### Lead N: Name  OR  ## Lead Profile: Name  OR  ### Lead: Name
  const headerPattern = /^#{2,4}\s*(?:Lead\s*(?:Profile\s*)?(?:\d+\s*)?[:\-–—]\s*)(.+)/gim;
  const indices: { name: string; start: number }[] = [];
  let m;
  while ((m = headerPattern.exec(text)) !== null) {
    const name = m[1].replace(/\*\*/g, "").trim();
    if (name && name.length < 80) {
      indices.push({ name, start: m.index });
    }
  }

  // ALSO add "### LinkedIn Message for Name" headers — these may be additional leads
  // not captured by the Lead Profile headers (e.g. agent wrote profiles for some, messages for others)
  const msgHeaderPattern = /^#{2,4}\s*LinkedIn Message for\s+(.+)/gim;
  const msgSeen = new Set(indices.map((idx) => idx.name.toLowerCase()));
  while ((m = msgHeaderPattern.exec(text)) !== null) {
    const name = m[1].replace(/\*\*/g, "").trim();
    if (name && name.length < 80 && !msgSeen.has(name.toLowerCase())) {
      msgSeen.add(name.toLowerCase());
      indices.push({ name, start: m.index });
    }
  }

  // Re-sort by position in text so blocks are sliced correctly
  indices.sort((a, b) => a.start - b.start);

  // Extract blocks between consecutive headers
  for (let i = 0; i < indices.length; i++) {
    const { name, start } = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1].start : text.length;
    const block = text.slice(start, end);
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ name, block });
    }
  }

  return results;
}

/**
 * Parse a single lead block into a Lead object.
 */
function parseLeadBlock(name: string, block: string): Lead {
  // Email — many formats the LLM produces:
  //   **Email:** email                  (bold with colon inside)
  //   **Email Found:** email            (from Hunter tool output)
  //   - Email: email                    (bullet list)
  //   [email](mailto:email)             (markdown link)
  //   **Email:** email (unverified)     (Hunter low-confidence guess)
  // The key insight: "Email" keyword, then non-letter separators, then the address.
  const emailMatch = block.match(
    /Email(?:\s+Found)?[^a-zA-Z\n]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(\s*\(unverified\))?/i,
  );
  const emailRaw = emailMatch?.[1]?.trim() || "";
  const emailUnverified = !!emailMatch?.[2];
  // Filter out obvious garbage emails
  const email =
    emailRaw && !emailRaw.match(/not\s*found|n\/a|none|unknown|self-employed\.com|enterprise\.com/i)
      ? emailRaw
      : "";

  // LinkedIn URL — /in/ or /posts/
  const linkedinMatch = block.match(
    /(https?:\/\/(?:\w+\.)?linkedin\.com\/(?:in|posts)\/[^\s)\]"]+)/i,
  );
  const linkedin = linkedinMatch?.[1] || "";

  // Twitter
  const twitterMatch = block.match(
    /\*?\*?(?:Twitter|X)\*?\*?:?\s*(?:\[.*?\]\()?(https?:\/\/[^\s)\]]+|@\w+)/i,
  );
  const twitter = twitterMatch?.[1]?.replace(/not found/i, "").trim() || "";

  // Title — "**Title:** X at Company" or from **To:** line
  const titleMatch =
    block.match(/\*\*Title:\*\*\s*([^\n]+)/i) ||
    block.match(/\*\*To:\*\*\s*[^,\n]+,\s*([^\n]+)/i);
  let title = titleMatch?.[1]?.replace(/\*\*/g, "").trim() || "";

  // Company — extract from "at Company" in title line
  let company = "";
  const atMatch = title.match(/\bat\s+([A-Z][\w\s&.'-]{1,40})/i);
  if (atMatch) {
    company = atMatch[1].trim();
    // Remove "at Company" from title
    title = title.replace(/\s+at\s+.+$/i, "").trim();
  }

  // Posts
  const posts = extractAllLinkedInPosts(block);

  // Best hook
  const hookMatch = block.match(
    /\*?\*?Best Hook\*?\*?[^a-zA-Z\n]*\n?[\-\s]*(.*?)(?:\n|$)/i,
  );
  const bestHook = hookMatch?.[1]?.replace(/\*\*/g, "").trim() || "";

  // Message — handle both:
  //   "**Message:** text"  (inline)
  //   "### LinkedIn Message for Name ... **Message:** text" (section)
  const msgTextMatch = block.match(
    /\*\*Message:\*\*\s*\n?([\s\S]*?)(?=\n\*\*(?:Character|Personalization|Contact|All Post)|---|\n#{2,4}\s|$)/i,
  );
  const msgText = msgTextMatch?.[1]?.trim() || "";

  const charMatch = block.match(/\*?\*?Character Count\*?\*?:?\s*(\d+)/i);
  const typeMatch = block.match(/\*?\*?Type\*?\*?:?\s*([^|\n]+)/i);
  const toneMatch = block.match(/\*?\*?Tone\*?\*?:?\s*([^\n]+)/i);
  const refMatch = block.match(
    /Referenced\s*(?:post)?:?\s*(?:\[.*?\]\()?(https?:\/\/[^\s)\]]+)/i,
  );

  const message: LeadMessage | null = msgText
    ? {
        text: msgText,
        type: typeMatch?.[1]?.trim() || "Connection Request (300 chars)",
        tone: toneMatch?.[1]?.trim() || "",
        charCount: charMatch ? parseInt(charMatch[1], 10) : msgText.length,
        referencedPost: refMatch?.[1] || "",
      }
    : null;

  // Company intel
  const intelMatch = block.match(/\*?\*?Company Intel\*?\*?:?\s*\n?-?\s*(.+?)(?:\n|$)/i);
  const companyIntel = intelMatch?.[1]?.trim() || "";

  return {
    name,
    title,
    company,
    email,
    emailUnverified,
    linkedin,
    twitter,
    posts,
    tweets: [],
    companyIntel,
    bestHook,
    message,
  };
}

export function parseLeadDiscoveryOutput(text: string): LeadDiscoveryData {
  const blocks = splitIntoLeadBlocks(text);
  const leads = blocks.map(({ name, block }) => parseLeadBlock(name, block));

  // Extract keyword
  const keywordMatch = text.match(/\*\*Keyword(?:\/Topic)?:\*\*\s*(.+)/i);
  const keyword = keywordMatch?.[1]?.trim() || "";

  return {
    leads,
    keyword,
    summary: {
      totalLeads: leads.length,
      withEmail: leads.filter((l) => l.email).length,
      withLinkedIn: leads.filter((l) => l.linkedin || l.posts.length > 0).length,
      withPosts: leads.filter((l) => l.posts.length > 0).length,
      withMessages: leads.filter((l) => l.message !== null).length,
    },
  };
}
