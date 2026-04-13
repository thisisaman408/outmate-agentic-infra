import { useState, useMemo } from "react";
import { Search, ArrowRight, Eye } from "lucide-react";

/* ═══════════════════════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════════════════════ */

interface Agent {
  id: number;
  name: string;
  emoji: string;
  category: string;
  hint: string;
  desc: string;
  color: string;
  trending?: boolean;
  isNew?: boolean;
}

const CATEGORIES = [
  { label: "All agents", count: 52 },
  { label: "Signal Detection", count: 12 },
  { label: "Outbound", count: 10 },
  { label: "Research & Enrichment", count: 8 },
  { label: "Sales Enablement", count: 5 },
  { label: "RevOps", count: 4 },
  { label: "Content & Brand", count: 7 },
  { label: "Strategy & Planning", count: 6 },
];

const QUICK_CATS = [
  { name: "Signal Detection", icons: ["📡", "💎", "👁", "📊"], tags: "Intent · Funding · Job change · Visitor ID", color: "hsl(0,72%,50%)" },
  { name: "Outbound Execution", icons: ["✉️", "💬", "🔄", "🤖"], tags: "Email · LinkedIn · Sequences · AI SDR", color: "hsl(239,84%,67%)" },
  { name: "Research & Enrichment", icons: ["📋", "🔍", "🌿", "🏛"], tags: "Prospect brief · ICP score · Tech stack", color: "hsl(142,71%,45%)" },
  { name: "Sales Enablement", icons: ["✅", "📄", "🛡", "📁"], tags: "Demo qualify · Proposals · Objection handling", color: "hsl(271,91%,65%)" },
];

const AGENTS: Agent[] = [
  // Signal Detection (12)
  { id: 1, name: "Intent Radar", emoji: "📡", category: "Signal Detection", hint: "Alert me when target accounts show buying signals", desc: "Monitors G2, Capterra, and review sites for ICP accounts researching your category. Triggers outreach within minutes of detected intent.", color: "hsl(0,72%,50%)", trending: true },
  { id: 2, name: "Job Switch Tracker", emoji: "🔄", category: "Signal Detection", hint: "Notify me when a prospect changes company or gets promoted", desc: "Detects when ICP contacts switch companies, get promoted, or take new leadership roles. Auto-updates CRM records.", color: "hsl(25,95%,53%)", trending: true },
  { id: 3, name: "Funding Scout", emoji: "💎", category: "Signal Detection", hint: "Find funded ICP companies and reach out immediately", desc: "Scrapes Crunchbase and TechCrunch for freshly funded companies matching your ICP. Triggers personalised outreach within 24h.", color: "hsl(239,84%,67%)", trending: true },
  { id: 4, name: "Hiring Pulse", emoji: "📊", category: "Signal Detection", hint: "Track companies hiring for roles that indicate buying intent", desc: "Monitors job boards for GTM, engineering, and leadership hires that correlate with tool purchasing decisions.", color: "hsl(142,71%,45%)", isNew: true },
  { id: 5, name: "Tech Stack Spy", emoji: "🔧", category: "Signal Detection", hint: "Detect when target accounts adopt or drop competitor tools", desc: "Tracks technology changes across target accounts using BuiltWith and Wappalyzer data. Flags competitor installs and removals.", color: "hsl(173,80%,40%)" },
  { id: 6, name: "Website Visitor ID", emoji: "👁", category: "Signal Detection", hint: "Identify anonymous companies visiting your website", desc: "De-anonymises website traffic to reveal company names, pages visited, and time spent. Scores visitors by ICP fit.", color: "hsl(200,80%,50%)", isNew: true },
  { id: 7, name: "Pricing Page Watcher", emoji: "💰", category: "Signal Detection", hint: "Alert when ICP accounts view your pricing page", desc: "Tracks pricing page visits from identified accounts and triggers immediate SDR notification with context.", color: "hsl(45,93%,47%)" },
  { id: 8, name: "News & PR Monitor", emoji: "📰", category: "Signal Detection", hint: "Catch company news that creates outreach opportunities", desc: "Monitors news feeds for product launches, partnerships, expansions, and leadership changes at target accounts.", color: "hsl(330,70%,55%)" },
  { id: 9, name: "Social Listener", emoji: "📢", category: "Signal Detection", hint: "Track social posts that reveal pain points or buying intent", desc: "Monitors LinkedIn, Twitter, and Reddit for posts by ICP contacts expressing frustration or exploring solutions.", color: "hsl(280,60%,55%)", trending: true },
  { id: 10, name: "Contract Renewal Radar", emoji: "📅", category: "Signal Detection", hint: "Predict when competitors' contracts come up for renewal", desc: "Uses public data and hiring patterns to estimate competitor contract renewal windows at target accounts.", color: "hsl(15,80%,55%)" },
  { id: 11, name: "Event Attendee Tracker", emoji: "🎪", category: "Signal Detection", hint: "Find and reach out to attendees of relevant industry events", desc: "Scrapes event registrations and speaker lists to identify ICP contacts attending conferences and webinars.", color: "hsl(160,60%,45%)", isNew: true },
  { id: 12, name: "Board Change Alert", emoji: "🏛", category: "Signal Detection", hint: "Track C-suite and board changes at target companies", desc: "Monitors SEC filings, LinkedIn, and press releases for executive leadership changes that create entry points.", color: "hsl(210,70%,50%)" },

  // Outbound (10)
  { id: 13, name: "AI SDR", emoji: "🤖", category: "Outbound", hint: "Run fully autonomous outbound prospecting end-to-end", desc: "Fully autonomous SDR — prospects, enriches, personalises, sends, follows up, and handles replies 24/7.", color: "hsl(239,84%,67%)", trending: true },
  { id: 14, name: "Cold Email Writer", emoji: "✉️", category: "Outbound", hint: "Write hyper-personalised cold emails at scale", desc: "Generates unique cold emails for each prospect using their LinkedIn, company data, and recent activity.", color: "hsl(142,71%,45%)" },
  { id: 15, name: "LinkedIn Connector", emoji: "💼", category: "Outbound", hint: "Send personalised LinkedIn connection requests automatically", desc: "Crafts tailored connection requests and DMs based on mutual connections, shared interests, and recent posts.", color: "hsl(200,80%,50%)", trending: true },
  { id: 16, name: "Follow-up Sequencer", emoji: "🔄", category: "Outbound", hint: "Build multi-touch follow-up sequences that convert", desc: "Creates intelligent follow-up sequences across email and LinkedIn with dynamic timing and content variation.", color: "hsl(25,95%,53%)" },
  { id: 17, name: "Reply Classifier", emoji: "📨", category: "Outbound", hint: "Auto-classify and route email replies by intent", desc: "Uses NLP to classify replies as interested, not now, unsubscribe, or meeting request. Routes to appropriate workflow.", color: "hsl(271,91%,65%)", isNew: true },
  { id: 18, name: "Meeting Booker", emoji: "📅", category: "Outbound", hint: "Convert interested replies into booked meetings automatically", desc: "Detects positive intent in replies and immediately sends calendar links with personalised meeting agendas.", color: "hsl(173,80%,40%)" },
  { id: 19, name: "A/B Test Engine", emoji: "⚖️", category: "Outbound", hint: "Test subject lines, CTAs, and messaging frameworks", desc: "Runs structured A/B tests on email components and automatically shifts volume to winning variants.", color: "hsl(45,93%,47%)", isNew: true },
  { id: 20, name: "Warm Intro Finder", emoji: "🤝", category: "Outbound", hint: "Find the best path for warm introductions to prospects", desc: "Maps your network to find mutual connections who can introduce you to target prospects. Drafts intro request emails.", color: "hsl(0,72%,50%)" },
  { id: 21, name: "Multi-channel Orchestrator", emoji: "🎯", category: "Outbound", hint: "Coordinate outreach across email, LinkedIn, and phone", desc: "Orchestrates touchpoints across channels with intelligent timing, ensuring no overlap and maximum engagement.", color: "hsl(330,70%,55%)" },
  { id: 22, name: "Bounce Handler", emoji: "🔙", category: "Outbound", hint: "Automatically handle bounced emails and find alternatives", desc: "Catches bounced emails, finds alternative addresses via waterfall enrichment, and re-queues outreach.", color: "hsl(160,60%,45%)" },

  // Research & Enrichment (8)
  { id: 23, name: "Prospect Researcher", emoji: "🔍", category: "Research & Enrichment", hint: "Deep-research any prospect in under 60 seconds", desc: "Compiles a comprehensive prospect brief from LinkedIn, company website, news, and social media in one click.", color: "hsl(239,84%,67%)", trending: true },
  { id: 24, name: "ICP Scorer", emoji: "🎯", category: "Research & Enrichment", hint: "Score every lead against your ideal customer profile", desc: "Scores leads 0–100 based on firmographic, technographic, and behavioral data. Surfaces top matches instantly.", color: "hsl(0,72%,50%)" },
  { id: 25, name: "Email Waterfall", emoji: "💧", category: "Research & Enrichment", hint: "Find verified emails using 6+ data providers", desc: "Cascades through Apollo, Hunter, Dropcontact, and more to find and verify work email addresses.", color: "hsl(200,80%,50%)" },
  { id: 26, name: "Phone Finder", emoji: "📞", category: "Research & Enrichment", hint: "Find direct dial and mobile numbers for prospects", desc: "Searches across phone data providers to find direct dials and mobile numbers with confidence scoring.", color: "hsl(142,71%,45%)", isNew: true },
  { id: 27, name: "Company Profiler", emoji: "🏢", category: "Research & Enrichment", hint: "Generate comprehensive company intelligence reports", desc: "Builds detailed company profiles including funding, tech stack, competitors, hiring trends, and org structure.", color: "hsl(271,91%,65%)" },
  { id: 28, name: "Competitor Mapper", emoji: "🗺️", category: "Research & Enrichment", hint: "Map out who your prospects are currently using", desc: "Identifies current vendor relationships at target accounts using job postings, tech detection, and case studies.", color: "hsl(25,95%,53%)", trending: true },
  { id: 29, name: "Org Chart Builder", emoji: "🌳", category: "Research & Enrichment", hint: "Map the decision-making unit at target accounts", desc: "Builds org charts for target accounts identifying economic buyers, champions, and blockers.", color: "hsl(173,80%,40%)" },
  { id: 30, name: "Lookalike Finder", emoji: "🔮", category: "Research & Enrichment", hint: "Find companies that look like your best customers", desc: "Analyses your best customers' attributes and finds similar companies you haven't targeted yet.", color: "hsl(45,93%,47%)", isNew: true },

  // Sales Enablement (5)
  { id: 31, name: "Demo Qualifier", emoji: "✅", category: "Sales Enablement", hint: "Pre-qualify demo requests with AI before they hit your calendar", desc: "Scores and qualifies inbound demo requests. Asks smart follow-up questions and routes to the right AE.", color: "hsl(142,71%,45%)", trending: true },
  { id: 32, name: "Proposal Generator", emoji: "📄", category: "Sales Enablement", hint: "Generate custom proposals in minutes, not hours", desc: "Creates tailored proposals using company research, pricing rules, and case study matching. Exports to PDF.", color: "hsl(239,84%,67%)" },
  { id: 33, name: "Objection Handler", emoji: "🛡", category: "Sales Enablement", hint: "Get real-time objection handling suggestions during calls", desc: "Provides battle cards and objection responses based on prospect company, role, and competitive landscape.", color: "hsl(0,72%,50%)" },
  { id: 34, name: "Case Study Matcher", emoji: "📚", category: "Sales Enablement", hint: "Find the perfect case study for every sales conversation", desc: "Matches prospects to relevant case studies based on industry, company size, use case, and pain points.", color: "hsl(200,80%,50%)", isNew: true },
  { id: 35, name: "Deal Coach", emoji: "🏆", category: "Sales Enablement", hint: "Get AI coaching to advance and close deals faster", desc: "Analyses deal context and provides actionable next steps, risk flags, and coaching tips for every opportunity.", color: "hsl(25,95%,53%)" },

  // RevOps (4)
  { id: 36, name: "CRM Hygiene Bot", emoji: "🧹", category: "RevOps", hint: "Keep your CRM clean with automated data maintenance", desc: "Detects duplicates, fills missing fields, standardises formats, and flags stale records across your CRM.", color: "hsl(173,80%,40%)", trending: true },
  { id: 37, name: "Pipeline Forecaster", emoji: "📈", category: "RevOps", hint: "Get AI-powered pipeline forecasts with confidence intervals", desc: "Analyses historical patterns, deal velocity, and engagement signals to predict close rates and revenue.", color: "hsl(239,84%,67%)" },
  { id: 38, name: "Lead Router", emoji: "🔀", category: "RevOps", hint: "Route leads to the right rep based on smart matching", desc: "Routes inbound leads using territory, industry, company size, and rep capacity rules. Supports round-robin.", color: "hsl(45,93%,47%)", isNew: true },
  { id: 39, name: "Attribution Tracker", emoji: "📊", category: "RevOps", hint: "Track which channels and campaigns drive real revenue", desc: "Multi-touch attribution across marketing and sales touchpoints. Connects campaigns to closed revenue.", color: "hsl(330,70%,55%)" },

  // Content & Brand (7)
  { id: 40, name: "Blog Writer", emoji: "✍️", category: "Content & Brand", hint: "Write SEO-optimised blog posts from a brief", desc: "Generates long-form blog content with keyword optimisation, internal linking suggestions, and meta descriptions.", color: "hsl(271,91%,65%)", trending: true },
  { id: 41, name: "Social Post Creator", emoji: "📱", category: "Content & Brand", hint: "Create engaging social posts for LinkedIn and Twitter", desc: "Generates platform-native social content with hooks, hashtags, and visual suggestions. Supports batch creation.", color: "hsl(200,80%,50%)" },
  { id: 42, name: "Email Newsletter Builder", emoji: "📧", category: "Content & Brand", hint: "Build personalised newsletters that drive engagement", desc: "Creates segmented newsletter content with dynamic blocks, A/B subject lines, and engagement predictions.", color: "hsl(142,71%,45%)", isNew: true },
  { id: 43, name: "Case Study Writer", emoji: "📖", category: "Content & Brand", hint: "Turn customer interviews into polished case studies", desc: "Transforms raw interview notes and data into structured, compelling case studies with metrics and quotes.", color: "hsl(0,72%,50%)" },
  { id: 44, name: "Ad Copy Generator", emoji: "📢", category: "Content & Brand", hint: "Generate high-converting ad copy for any platform", desc: "Creates ad copy for Google, LinkedIn, Facebook, and Twitter with multiple variations and CTA options.", color: "hsl(25,95%,53%)" },
  { id: 45, name: "Brand Voice Guardian", emoji: "🎨", category: "Content & Brand", hint: "Ensure all content matches your brand voice and guidelines", desc: "Reviews and scores content against your brand guidelines. Suggests edits for tone, terminology, and style.", color: "hsl(330,70%,55%)" },
  { id: 46, name: "Video Script Writer", emoji: "🎬", category: "Content & Brand", hint: "Write scripts for demos, webinars, and social videos", desc: "Creates video scripts with timing cues, visual suggestions, and speaker notes for various video formats.", color: "hsl(160,60%,45%)" },

  // Strategy & Planning (6)
  { id: 47, name: "TAM Calculator", emoji: "🌍", category: "Strategy & Planning", hint: "Calculate your total addressable market with AI", desc: "Estimates TAM, SAM, and SOM using firmographic filters, market data, and your ICP definition.", color: "hsl(239,84%,67%)" },
  { id: 48, name: "Territory Planner", emoji: "🗺️", category: "Strategy & Planning", hint: "Design balanced sales territories with AI assistance", desc: "Creates territory plans based on account potential, rep capacity, geography, and historical performance.", color: "hsl(142,71%,45%)", trending: true },
  { id: 49, name: "Win/Loss Analyser", emoji: "📉", category: "Strategy & Planning", hint: "Understand why you win and lose deals with AI analysis", desc: "Analyses CRM data, call recordings, and email threads to identify patterns in won and lost deals.", color: "hsl(0,72%,50%)" },
  { id: 50, name: "Quota Modeler", emoji: "🎯", category: "Strategy & Planning", hint: "Model quota scenarios based on pipeline and capacity", desc: "Builds quota models using historical attainment, pipeline coverage ratios, and seasonal trends.", color: "hsl(200,80%,50%)", isNew: true },
  { id: 51, name: "ICP Refiner", emoji: "🔬", category: "Strategy & Planning", hint: "Continuously refine your ICP based on closed-won data", desc: "Analyses your best customers to identify patterns and refine your ideal customer profile over time.", color: "hsl(271,91%,65%)" },
  { id: 52, name: "Competitive Playbook", emoji: "⚔️", category: "Strategy & Planning", hint: "Build and maintain competitive battle cards with AI", desc: "Monitors competitors and auto-updates battle cards with latest positioning, pricing, and feature comparisons.", color: "hsl(25,95%,53%)", isNew: true },
];

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All agents");
  const [activeFilter, setActiveFilter] = useState<"All" | "Trending" | "New" | "Most used">("All");

  const filtered = useMemo(() => {
    let list = AGENTS;
    if (activeCategory !== "All agents") {
      list = list.filter(a => a.category === activeCategory);
    }
    if (activeFilter === "Trending") list = list.filter(a => a.trending);
    if (activeFilter === "New") list = list.filter(a => a.isNew);
    if (activeFilter === "Most used") list = list.filter(a => a.trending); // reuse trending as proxy
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.desc.toLowerCase().includes(q) ||
        a.hint.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, activeFilter, searchQuery]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, Agent[]>();
    filtered.forEach(a => {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    });
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── HERO ── */}
      <section className="bg-[hsl(222,47%,11%)] relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6 py-14 flex gap-10 items-start">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[.1em] text-[hsl(239,84%,67%)] font-bold mb-4">
              Agent Marketplace
            </p>
            <h1 className="text-[32px] font-semibold leading-[1.2] mb-4">
              <span className="text-white">Discover the world's top </span>
              <span className="text-[hsl(239,84%,67%)]">GTM AI agents</span>
              <span className="text-white"> built for Outmate</span>
            </h1>
            <p className="text-[13px] text-[hsl(215,20%,65%)] leading-[1.7] mb-7 max-w-[420px]">
              52 pre-built agents for signal detection, outbound, research, sales, RevOps, and content. Deploy in one click.
            </p>
            {/* Search */}
            <div className="relative max-w-[440px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,20%,45%)]" strokeWidth={2.5} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by use case, category, or integration..."
                className="w-full pl-10 pr-[90px] py-3 bg-[rgba(255,255,255,.06)] border border-[rgba(255,255,255,.11)] rounded-[10px] text-[12px] text-white placeholder:text-[hsl(215,20%,40%)] focus:outline-none focus:border-[hsl(239,84%,67%)] transition-colors"
              />
              <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-[hsl(239,84%,67%)] text-white text-[11px] font-bold px-4 py-1.5 rounded-[7px] hover:bg-[hsl(239,70%,55%)] transition-colors">
                Search
              </button>
            </div>
          </div>

          {/* Right — 3 Hero Cards */}
          <div className="hidden lg:flex flex-col gap-3 w-[320px] shrink-0">
            {[
              { ...AGENTS[0], tag: "Trending" },
              { ...AGENTS[2], tag: "Most used" },
              { ...AGENTS[12], tag: "Top agent" },
            ].map(card => (
              <div
                key={card.id}
                className="bg-[rgba(255,255,255,.05)] border border-[rgba(255,255,255,.09)] rounded-[12px] px-4 py-3.5 hover:bg-[rgba(255,255,255,.08)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-[34px] h-[34px] rounded-[8px] flex items-center justify-center text-[16px] shrink-0"
                    style={{ backgroundColor: "rgba(255,255,255,.07)" }}
                  >
                    {card.emoji}
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-white">{card.name}</div>
                    <div className="text-[10px] text-[hsl(215,20%,55%)]">
                      {card.category} · <span className="text-[hsl(239,84%,67%)]">{card.tag}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-[hsl(215,20%,55%)] leading-[1.5]">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MAIN AREA ── */}
      <section className="bg-[hsl(210,40%,98%)] flex-1">
        <div className="max-w-[1200px] mx-auto px-6 py-8">

          {/* Quick Category Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {QUICK_CATS.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className="bg-white border border-[hsl(220,13%,91%)] rounded-[12px] px-4 py-4 text-left hover:-translate-y-[1px] hover:border-[hsl(239,84%,67%)] hover:shadow-[0_2px_8px_rgba(79,70,229,.06)] transition-all group"
              >
                <div className="flex gap-1.5 mb-3">
                  {cat.icons.map((ic, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[13px]"
                      style={{ backgroundColor: `${cat.color}15` }}
                    >
                      {ic}
                    </div>
                  ))}
                </div>
                <div className="text-[12px] font-bold text-foreground">{cat.name}</div>
                <div className="text-[10px] text-[hsl(239,84%,67%)] mt-0.5">{cat.tags}</div>
              </button>
            ))}
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CATEGORIES.map(c => (
              <button
                key={c.label}
                onClick={() => setActiveCategory(c.label)}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeCategory === c.label
                    ? "bg-[hsl(239,84%,67%)] text-white border-[hsl(239,84%,67%)]"
                    : "bg-white text-foreground border-[hsl(220,13%,91%)] hover:border-[hsl(239,84%,67%)] hover:text-[hsl(239,84%,67%)]"
                }`}
              >
                {c.label} ({c.count})
              </button>
            ))}
          </div>

          {/* Filter Row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">Filter:</span>
              {(["All", "Trending", "New", "Most used"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    activeFilter === f
                      ? "bg-[hsl(239,84%,67%)] text-white border-[hsl(239,84%,67%)]"
                      : "bg-white text-muted-foreground border-[hsl(220,13%,91%)] hover:text-foreground"
                  }`}
                >
                  {f === "Trending" ? "🔥 " : f === "New" ? "✨ " : ""}{f}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">{filtered.length} agents</span>
          </div>

          {/* Agent Grid — grouped by category */}
          {Array.from(grouped.entries()).map(([cat, agents]) => (
            <div key={cat} className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground">{cat}</span>
                  <span className="text-[11px] text-muted-foreground">{agents.length} agents</span>
                </div>
                <button className="text-[11px] text-[hsl(239,84%,67%)] font-medium hover:underline flex items-center gap-0.5">
                  View all <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {agents.map(agent => (
                  <div
                    key={agent.id}
                    className="bg-white border border-[hsl(220,13%,91%)] rounded-[12px] overflow-hidden hover:-translate-y-[2px] hover:border-[hsl(239,84%,67%)] hover:shadow-[0_4px_12px_rgba(79,70,229,.08)] transition-all group"
                  >
                    {/* Colored top strip */}
                    <div className="h-1" style={{ backgroundColor: agent.color }} />

                    <div className="p-3.5">
                      {/* Header */}
                      <div className="flex items-center gap-2.5 mb-2">
                        <div
                          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-[18px] shrink-0"
                          style={{ backgroundColor: `${agent.color}18` }}
                        >
                          {agent.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold text-foreground">{agent.name}</span>
                            {agent.trending && (
                              <span className="text-[8px] font-bold bg-[hsl(0,86%,97%)] text-[hsl(0,72%,51%)] px-1.5 py-[1px] rounded">
                                Trending
                              </span>
                            )}
                            {agent.isNew && (
                              <span className="text-[8px] font-bold bg-[hsl(142,76%,94%)] text-[hsl(142,71%,29%)] px-1.5 py-[1px] rounded">
                                New
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{agent.category}</div>
                        </div>
                      </div>

                      {/* Use case hint */}
                      <p className="text-[10px] text-[hsl(239,84%,67%)] italic mb-1.5 leading-[1.4]">
                        "{agent.hint}"
                      </p>

                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground leading-[1.5] mb-3 line-clamp-2">
                        {agent.desc}
                      </p>

                      {/* CTA Row */}
                      <div className="flex gap-2">
                        <button className="flex-1 bg-[hsl(239,84%,56%)] text-white text-[11px] font-bold py-[9px] rounded-[8px] hover:bg-[hsl(239,70%,48%)] transition-colors flex items-center justify-center gap-1">
                          Use now <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                        </button>
                        <button className="bg-[hsl(210,40%,98%)] border border-[hsl(220,13%,91%)] text-muted-foreground text-[11px] font-medium px-3.5 py-[9px] rounded-[8px] hover:border-[hsl(239,84%,67%)] hover:text-[hsl(239,84%,67%)] transition-colors flex items-center gap-1">
                          <Eye className="w-3 h-3" strokeWidth={2.5} /> Preview
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
