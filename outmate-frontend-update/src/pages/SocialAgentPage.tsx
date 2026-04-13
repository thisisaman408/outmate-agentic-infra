import { useState, useMemo } from "react";
import {
  Search, Filter, Plus, MoreVertical, Clock, SlidersHorizontal,
  ChevronLeft, Check, ExternalLink, Heart, MessageCircle,
  RefreshCw, X, Info, Link2, ChevronDown, TrendingUp,
  Users, Zap, Eye, ThumbsUp, Share2, Briefcase, Bell,
  BarChart3, ArrowUpRight, Flame, Target, UserPlus, Send
} from "lucide-react";

/* ─── types ─── */
interface SavedSearch {
  id: string;
  name: string;
  platform: "linkedin" | "x";
  frequency: string;
  updatedAt: string;
  keywords: string[];
  paused?: boolean;
  matchCount?: number;
  enrichedCount?: number;
}

type ActivityType = "post" | "comment" | "reaction" | "job_change" | "article" | "share";

interface Post {
  id: string;
  searchId: string;
  author: string;
  initials: string;
  role: string;
  company: string;
  timeAgo: string;
  body: string;
  likes: number;
  comments: number;
  shares?: number;
  avatarTint: string;
  platform: "linkedin";
  activityType: ActivityType;
  intentScore: number; // 0-100
  enriched?: boolean;
  profileUrl?: string;
}

/* ─── seed data ─── */
const INITIAL_SEARCHES: SavedSearch[] = [
  { id: "s1", name: "Founders Posting: AI Strategy", platform: "linkedin", frequency: "Daily", updatedAt: "Updated Feb 16, 12:33 PM", keywords: ["ai automation", "agentic workflows", "ai implementation", "generative ai"], matchCount: 142, enrichedCount: 89 },
  { id: "s2", name: "CTOs/VPs Posting: AI Stack", platform: "linkedin", frequency: "Daily", updatedAt: "Updated Feb 16, 12:32 PM", keywords: ["generative ai", "agentic ai", "llm implementation", "building"], matchCount: 97, enrichedCount: 61 },
  { id: "s3", name: "Product/Ops Leaders: AI Pain", platform: "linkedin", frequency: "Daily", updatedAt: "Updated Feb 16, 12:32 PM", keywords: ["ai integration", "ai agents", "llm", "challenge", "struggling"], matchCount: 68, enrichedCount: 42 },
];

const POSTS: Post[] = [
  { id: "p1", searchId: "s1", author: "Abhijith P.B", initials: "AP", role: "CEO & Founder", company: "NeuralFlow AI", timeAgo: "2 hours ago", likes: 24, comments: 8, shares: 3, avatarTint: "#EEEDFE", platform: "linkedin", activityType: "post", intentScore: 87, body: "I attended a 2 Day Generative AI Mastermind. I went in curious. I came out transformed. In just two days, I learned: How to design structured prompts that produce clear, usable outcomes — not just clever answers. How to integrate AI tools into daily workflows for real productivity gains. The difference between using AI casually and using it strategically." },
  { id: "p2", searchId: "s1", author: "Ashok Yadav", initials: "AY", role: "Asst. Manager Performance Marketing", company: "Alyf", timeAgo: "5 hours ago", likes: 12, comments: 3, avatarTint: "#EEEDFE", platform: "linkedin", activityType: "article", intentScore: 62, body: "Excited to share that I've successfully completed the AI Tools & ChatGPT Workshop by be10x and earned my Certificate of Completion! This hands-on workshop strengthened my ability to leverage AI for practical, real-world applications." },
  { id: "p7", searchId: "s1", author: "Sarah Chen", initials: "SC", role: "VP Engineering", company: "DataStack", timeAgo: "3 hours ago", likes: 45, comments: 15, shares: 8, avatarTint: "#EEEDFE", platform: "linkedin", activityType: "comment", intentScore: 91, body: "Commented on a post about AI agent frameworks: 'We've been evaluating LangChain vs CrewAI for our production pipeline. The orchestration layer is where most teams get stuck. Would love to see more real-world benchmarks.'" },
  { id: "p8", searchId: "s2", author: "Ravi Patel", initials: "RP", role: "CTO", company: "ScaleOps", timeAgo: "1 hour ago", likes: 67, comments: 23, shares: 12, avatarTint: "#E1F5EE", platform: "linkedin", activityType: "job_change", intentScore: 95, body: "🎉 Thrilled to announce that I've joined ScaleOps as CTO! After 5 years building AI infrastructure at Meta, I'm excited to bring enterprise-grade ML ops to mid-market SaaS companies. First priority: building an AI-native outbound engine." },
  { id: "p3", searchId: "s2", author: "Mohammed Amer", initials: "MA", role: "Microsoft MVP | Azure Dev Lead", company: "Atea Global", timeAgo: "6 hours ago", likes: 47, comments: 12, shares: 5, avatarTint: "#E1F5EE", platform: "linkedin", activityType: "post", intentScore: 78, body: "GitHub Agentic Workflows, now in technical preview! GitHub just dropped something big. Agentic workflows allow AI agents to independently plan, reason, and execute coding tasks within GitHub repositories. This isn't just autocomplete — it's a new paradigm." },
  { id: "p4", searchId: "s2", author: "James Francis-Love", initials: "JF", role: "Systems & Cybersecurity Manager", company: "GovTech Solutions", timeAgo: "17 hours ago", likes: 11, comments: 2, avatarTint: "#E1F5EE", platform: "linkedin", activityType: "share", intentScore: 45, body: "Quick heads-up for colleagues: the DIR now requires both Cyber Awareness and AI Awareness training — when you certify with the state this year, you're attesting to both." },
  { id: "p9", searchId: "s2", author: "Elena Vasquez", initials: "EV", role: "Head of Data", company: "Nextera", timeAgo: "4 hours ago", likes: 33, comments: 9, avatarTint: "#E1F5EE", platform: "linkedin", activityType: "reaction", intentScore: 56, body: "Reacted 👏 to an article: 'Why Your AI Outbound Strategy Needs a Human-in-the-Loop' by TechCrunch. Elena has been engaging with 12+ AI outbound posts this week." },
  { id: "p5", searchId: "s3", author: "Maya Kumar", initials: "MK", role: "VP Sales", company: "NovaPipe", timeAgo: "5 hours ago", likes: 31, comments: 12, shares: 4, avatarTint: "#FAEEDA", platform: "linkedin", activityType: "post", intentScore: 94, body: "Just approved budget for an AI outbound stack. We're a 50-person B2B SaaS — if you've built this and it works, let's talk. Not looking for demos, looking for results. We need something that can personalize at scale without sounding like a robot wrote it." },
  { id: "p6", searchId: "s3", author: "James Salter", initials: "JS", role: "Head of Revenue", company: "Velotech", timeAgo: "2 hours ago", likes: 14, comments: 7, shares: 2, avatarTint: "#FAEEDA", platform: "linkedin", activityType: "post", intentScore: 88, body: "We're scaling our outbound team and evaluating AI SDR tools. If anyone has run AI outbound at a SaaS company and can share what actually worked — especially around personalisation at scale — I'd love to connect." },
  { id: "p10", searchId: "s3", author: "Priya Sharma", initials: "PS", role: "RevOps Manager", company: "CloudBridge", timeAgo: "30 min ago", likes: 8, comments: 4, avatarTint: "#FAEEDA", platform: "linkedin", activityType: "comment", intentScore: 72, body: "Commented on Maya's post: 'We went through the same evaluation last quarter. Happy to share our scorecard. DM me — the biggest lesson was that personalisation quality > volume every single time.'" },
];

/* ─── icons ─── */
const LinkedInIcon = ({ size = 16 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: "#0A66C2", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ color: "#fff", fontSize: size * 0.5, fontWeight: 700, lineHeight: 1 }}>in</span>
  </div>
);
const XIcon = ({ size = 16 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: "#000", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <span style={{ color: "#fff", fontSize: size * 0.55, fontWeight: 700, lineHeight: 1 }}>𝕏</span>
  </div>
);

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  post: { icon: Send, label: "Posted", color: "#534AB7", bg: "#EEEDFE" },
  comment: { icon: MessageCircle, label: "Commented", color: "#0F6E56", bg: "#E1F5EE" },
  reaction: { icon: ThumbsUp, label: "Reacted", color: "#854F0B", bg: "#FAEEDA" },
  job_change: { icon: Briefcase, label: "Job Change", color: "#C2410C", bg: "#FFF7ED" },
  article: { icon: Share2, label: "Shared Article", color: "#7C3AED", bg: "#F5F3FF" },
  share: { icon: ArrowUpRight, label: "Reshared", color: "#0369A1", bg: "#E0F2FE" },
};

function IntentBadge({ score }: { score: number }) {
  const config = score >= 80 ? { label: "🔥 Hot", bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" }
    : score >= 60 ? { label: "Warm", bg: "#FAEEDA", color: "#854F0B", border: "#FDE68A" }
    : { label: "Cool", bg: "#F0F9FF", color: "#0369A1", border: "#BAE6FD" };
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: config.bg, color: config.color, border: `1px solid ${config.border}`, letterSpacing: "0.02em" }}>
      {config.label} · {score}
    </span>
  );
}

function ActivityBadge({ type }: { type: ActivityType }) {
  const c = ACTIVITY_CONFIG[type];
  const Icon = c.icon;
  return (
    <span style={{ fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: c.bg, color: c.color, display: "inline-flex", alignItems: "center", gap: 3 }}>
      <Icon size={10} /> {c.label}
    </span>
  );
}

function SearchSourceTag({ name }: { name: string }) {
  return <span style={{ background: "#F7F6FF", color: "#7F77DD", fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 500, whiteSpace: "nowrap", border: "1px solid #E8E6F9" }}>{name}</span>;
}

/* ─── Stats Cards ─── */
function StatsBar({ searches, posts }: { searches: SavedSearch[]; posts: Post[] }) {
  const totalMatches = searches.reduce((a, s) => a + (s.matchCount || 0), 0);
  const totalEnriched = searches.reduce((a, s) => a + (s.enrichedCount || 0), 0);
  const hotLeads = posts.filter(p => p.intentScore >= 80).length;
  const stats = [
    { label: "Total Signals", value: totalMatches.toLocaleString(), icon: Zap, color: "#534AB7", bg: "#EEEDFE", change: "+23%" },
    { label: "Enriched Contacts", value: totalEnriched.toLocaleString(), icon: UserPlus, color: "#0F6E56", bg: "#E1F5EE", change: "+18%" },
    { label: "Hot Intent Leads", value: hotLeads.toString(), icon: Flame, color: "#DC2626", bg: "#FEF2F2", change: "+5 today" },
    { label: "Active Searches", value: searches.filter(s => !s.paused).length.toString(), icon: Target, color: "#854F0B", bg: "#FAEEDA", change: "3 running" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 20px", background: "#fff", borderBottom: "0.5px solid #ece9f8" }}>
      {stats.map(s => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#FAFAFE", borderRadius: 10, border: "0.5px solid #ece9f8" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <s.icon size={18} color={s.color} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1a1a2e", lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 10, color: s.color, fontWeight: 500, marginTop: 1 }}>{s.change}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Post Card ─── */
function PostCard({ post, searchName }: { post: Post; searchName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [enriched, setEnriched] = useState(post.enriched || false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const truncated = post.body.length > 180 && !expanded;
  const displayBody = truncated ? post.body.slice(0, 180) + "..." : post.body;

  return (
    <div style={{ background: "#fff", border: "0.5px solid #ece9f8", borderRadius: 12, padding: 0, overflow: "hidden", transition: "border-color 200ms" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#d4d0f5")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#ece9f8")}>
      {/* Intent stripe */}
      <div style={{ height: 3, background: post.intentScore >= 80 ? "linear-gradient(90deg, #DC2626, #F97316)" : post.intentScore >= 60 ? "linear-gradient(90deg, #F59E0B, #FBBF24)" : "linear-gradient(90deg, #93C5FD, #60A5FA)", borderRadius: "12px 12px 0 0" }} />
      <div style={{ padding: 16 }}>
        {/* header */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: post.avatarTint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#534AB7", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 0 0 1px #ece9f8" }}>
            {post.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{post.author}</span>
              <LinkedInIcon size={14} />
              <ActivityBadge type={post.activityType} />
              <IntentBadge score={post.intentScore} />
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{post.role} · <span style={{ color: "#534AB7", fontWeight: 500 }}>{post.company}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: "#aaa" }}>{post.timeAgo}</span>
              <SearchSourceTag name={searchName} />
            </div>
          </div>
        </div>
        {/* body */}
        <div style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.65, marginTop: 12, paddingLeft: 50 }}>
          {displayBody}
          {truncated && <span onClick={() => setExpanded(true)} style={{ fontSize: 12, color: "#534AB7", cursor: "pointer", marginLeft: 4, fontWeight: 500 }}>Read more →</span>}
        </div>
        {/* engagement bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, paddingLeft: 50 }}>
          <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#888" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ThumbsUp size={13} /> {post.likes}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MessageCircle size={13} /> {post.comments}</span>
            {post.shares && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Share2 size={13} /> {post.shares}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => !enriched && setEnriched(true)}
              style={{ background: enriched ? "#E1F5EE" : "#EEEDFE", color: enriched ? "#0F6E56" : "#534AB7", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: enriched ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 200ms" }}>
              {enriched ? <><Check size={10} /> Enriched</> : <><UserPlus size={10} /> Enrich · 3cr</>}
            </button>
            <button onClick={() => setOutreachOpen(!outreachOpen)}
              style={{ background: "#E1F5EE", color: "#0F6E56", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Send size={10} /> Outreach
            </button>
            <button style={{ background: "#FAEEDA", color: "#854F0B", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 11, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <ArrowUpRight size={10} /> CRM
            </button>
            <a href="#" style={{ color: "#aaa", display: "flex" }}><ExternalLink size={13} /></a>
          </div>
        </div>
        {/* outreach panel */}
        <div style={{ maxHeight: outreachOpen ? 350 : 0, overflow: "hidden", transition: "max-height 300ms ease, opacity 300ms ease", opacity: outreachOpen ? 1 : 0, paddingLeft: 50 }}>
          <div style={{ marginTop: 14, padding: 14, background: "#FAFAFE", border: "0.5px solid #ece9f8", borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Send size={12} color="#534AB7" /> AI-drafted outreach — {post.author}
            </div>
            <textarea defaultValue={`Hi ${post.author.split(" ")[0]},\n\nI noticed your ${post.activityType === "comment" ? "comment" : post.activityType === "job_change" ? "new role at " + post.company : "post"} about ${post.body.slice(0, 50)}...\n\nWe're helping ${post.company}-sized teams automate exactly this kind of workflow. Would love to share a quick overview.\n\nBest,\nGautam`}
              style={{ width: "100%", minHeight: 110, border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", background: "#fff" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Send · 2cr</button>
              <button style={{ background: "#E1F5EE", color: "#0F6E56", border: "none", borderRadius: 8, padding: "7px 18px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>Add to sequence</button>
              <button onClick={() => setOutreachOpen(false)} style={{ background: "transparent", color: "#aaa", border: "none", fontSize: 12, cursor: "pointer", marginLeft: "auto" }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── builder ─── */
interface BuilderState {
  name: string; source: string;
  andKeywords: string[]; orKeywords: string[]; notKeywords: string[];
  jobTitle: string; timeFrame: string; searchType: string; language: string; mediaFilter: string; country: string;
  hideRetweets: boolean; hideReplies: boolean; verifiedOnly: boolean; mustContainLinks: boolean; excludeSponsored: boolean;
  maxResults: number; frequency: string;
  enrichAuto: boolean; sendOutreach: boolean; pushCRM: boolean; slackAlert: boolean; addToSequence: boolean;
}
const defaultBuilder: BuilderState = { name: "", source: "linkedin-posts", andKeywords: [], orKeywords: [], notKeywords: [], jobTitle: "", timeFrame: "Last week", searchType: "Latest", language: "Any language", mediaFilter: "No media filter", country: "Any country", hideRetweets: true, hideReplies: true, verifiedOnly: false, mustContainLinks: false, excludeSponsored: true, maxResults: 50, frequency: "Daily", enrichAuto: true, sendOutreach: true, pushCRM: false, slackAlert: false, addToSequence: false };

function TagInput({ tags, setTags, tint, placeholder }: { tags: string[]; setTags: (t: string[]) => void; tint: string; placeholder: string }) {
  const [val, setVal] = useState("");
  const colorMap: Record<string, { bg: string; color: string }> = { purple: { bg: "#EEEDFE", color: "#534AB7" }, green: { bg: "#E1F5EE", color: "#0F6E56" }, red: { bg: "#FCEBEB", color: "#A32D2D" } };
  const c = colorMap[tint] || colorMap.purple;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "6px 10px", minHeight: 38, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
      {tags.map((t, i) => (
        <span key={i} style={{ background: c.bg, color: c.color, borderRadius: 20, padding: "2px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {t} <X size={10} style={{ cursor: "pointer" }} onClick={() => setTags(tags.filter((_, j) => j !== i))} />
        </span>
      ))}
      <input value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && val.trim()) { e.preventDefault(); setTags([...tags, val.trim()]); setVal(""); } }} placeholder={tags.length === 0 ? placeholder : ""} style={{ border: "none", outline: "none", flex: 1, minWidth: 100, fontSize: 13, background: "transparent" }} />
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 32, height: 18, borderRadius: 9, background: on ? "#534AB7" : "#ddd", border: "none", position: "relative", cursor: "pointer", transition: "background 200ms" }}>
      <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: on ? 16 : 2, transition: "left 200ms" }} />
    </button>
  );
}

function SelectInput({ value, onChange, options, width }: { value: string; onChange: (v: string) => void; options: string[]; width?: number }) {
  return (
    <div style={{ position: "relative", width: width || "100%" }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", appearance: "none", background: "#f9f8ff", border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "9px 30px 9px 12px", fontSize: 13, color: "#1a1a2e", cursor: "pointer", outline: "none" }}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#aaa", pointerEvents: "none" }} />
    </div>
  );
}

/* ─── Activity Filter Tabs ─── */
function ActivityFilterBar({ active, onChange }: { active: ActivityType | "all"; onChange: (v: ActivityType | "all") => void }) {
  const filters: { key: ActivityType | "all"; label: string; icon?: React.ElementType }[] = [
    { key: "all", label: "All Activity" },
    { key: "post", label: "Posts", icon: Send },
    { key: "comment", label: "Comments", icon: MessageCircle },
    { key: "reaction", label: "Reactions", icon: ThumbsUp },
    { key: "job_change", label: "Job Changes", icon: Briefcase },
    { key: "article", label: "Articles", icon: Share2 },
    { key: "share", label: "Reshares", icon: ArrowUpRight },
  ];
  return (
    <div style={{ display: "flex", gap: 4, padding: "8px 20px", background: "#fff", borderBottom: "0.5px solid #ece9f8", overflowX: "auto" }}>
      {filters.map(f => {
        const isActive = active === f.key;
        return (
          <button key={f.key} onClick={() => onChange(f.key)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 500, border: isActive ? "1px solid #534AB7" : "1px solid transparent", background: isActive ? "#EEEDFE" : "transparent", color: isActive ? "#534AB7" : "#888", cursor: "pointer", whiteSpace: "nowrap", transition: "all 150ms" }}>
            {f.icon && <f.icon size={12} />} {f.label}
          </button>
        );
      })}
    </div>
  );
}

/* ─── main page ─── */
export default function SocialAgentPage() {
  const [searches, setSearches] = useState<SavedSearch[]>(INITIAL_SEARCHES);
  const [selectedSearchId, setSelectedSearchId] = useState<string | null>(null);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [view, setView] = useState<"feed" | "builder">("feed");
  const [editSearchId, setEditSearchId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState("Anytime");
  const [activityFilter, setActivityFilter] = useState<ActivityType | "all">("all");
  const [builderStep, setBuilderStep] = useState(1);
  const [builder, setBuilder] = useState<BuilderState>(defaultBuilder);
  const [successBanner, setSuccessBanner] = useState(false);
  const [sortBy, setSortBy] = useState<"intent" | "recent">("intent");

  const filteredSidebarSearches = searches.filter(s => s.name.toLowerCase().includes(sidebarFilter.toLowerCase()));
  const feedPosts = useMemo(() => {
    let posts = selectedSearchId ? POSTS.filter(p => p.searchId === selectedSearchId) : [...POSTS];
    if (activityFilter !== "all") posts = posts.filter(p => p.activityType === activityFilter);
    if (sortBy === "intent") posts.sort((a, b) => b.intentScore - a.intentScore);
    return posts;
  }, [selectedSearchId, activityFilter, sortBy]);

  const currentSearchName = selectedSearchId ? searches.find(s => s.id === selectedSearchId)?.name || "All Searches" : "All Searches";
  const totalKeywords = builder.andKeywords.length + builder.orKeywords.length + builder.notKeywords.length;
  const queryPreview = (() => {
    const parts: string[] = [];
    if (builder.andKeywords.length) parts.push(builder.andKeywords.map(k => `"${k}"`).join(" AND "));
    if (builder.orKeywords.length) parts.push(`(${builder.orKeywords.map(k => `"${k}"`).join(" OR ")})`);
    if (builder.notKeywords.length) parts.push(builder.notKeywords.map(k => `-"${k}"`).join(" "));
    return parts.join(" ") || "";
  })();

  function openBuilder(search?: SavedSearch) {
    if (search) {
      setEditSearchId(search.id);
      setBuilder({ ...defaultBuilder, name: search.name, andKeywords: [...search.keywords] });
    } else { setEditSearchId(null); setBuilder(defaultBuilder); }
    setBuilderStep(1); setView("builder"); setMenuOpenId(null);
  }
  function completeBuilder() {
    if (editSearchId) {
      setSearches(prev => prev.map(s => s.id === editSearchId ? { ...s, name: builder.name || s.name, keywords: [...builder.andKeywords, ...builder.orKeywords] } : s));
    } else {
      const newS: SavedSearch = { id: "s" + Date.now(), name: builder.name || "Untitled search", platform: builder.source.includes("x") ? "x" : "linkedin", frequency: builder.frequency, updatedAt: "Updated just now", keywords: [...builder.andKeywords, ...builder.orKeywords], matchCount: 0, enrichedCount: 0 };
      setSearches(prev => [...prev, newS]); setSelectedSearchId(newS.id);
    }
    setView("feed"); setSuccessBanner(true); setTimeout(() => setSuccessBanner(false), 5000);
  }
  function duplicateSearch(s: SavedSearch) { setSearches(prev => [...prev, { ...s, id: "s" + Date.now(), name: s.name + " (copy)" }]); setMenuOpenId(null); }
  function togglePause(id: string) { setSearches(prev => prev.map(s => s.id === id ? { ...s, paused: !s.paused } : s)); setMenuOpenId(null); }
  function deleteSearch(id: string) { setSearches(prev => prev.filter(s => s.id !== id)); if (selectedSearchId === id) setSelectedSearchId(null); setMenuOpenId(null); }

  const sources = [
    { id: "linkedin-posts", name: "Monitor posts on LinkedIn", icon: "linkedin", desc: "Track keyword mentions in posts", connections: 1 },
    { id: "linkedin-profile", name: "Monitor profile activity", icon: "linkedin", desc: "Job changes, promotions, new connections", connections: 1 },
    { id: "linkedin-comments", name: "Monitor comments & reactions", icon: "linkedin", desc: "Track engagement on target topics", connections: 1 },
    { id: "x-posts", name: "Monitor posts on X", icon: "x", desc: "Track keyword mentions on X", connections: 1 },
    { id: "x-profile", name: "Monitor profile activity on X", icon: "x", desc: "Track profile changes on X", connections: 1 },
  ];
  const comingSoon = [
    { name: "Monitor Reddit threads", desc: "Track subreddit discussions" },
    { name: "Monitor G2 reviews", desc: "Track product reviews" },
    { name: "Monitor Glassdoor", desc: "Hiring signal detection" },
  ];

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", fontFamily: "Inter, system-ui, sans-serif", background: "#f7f6ff" }}>
      {/* ─── Left sidebar ─── */}
      <div style={{ width: 260, minWidth: 260, background: "#fff", borderRight: "0.5px solid #ece9f8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* sidebar header */}
        <div style={{ padding: "14px 14px 10px", borderBottom: "0.5px solid #ece9f8" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>Social Listening</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ width: 28, height: 28, background: "#f7f6ff", border: "0.5px solid #ece9f8", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Filter size={13} color="#888" /></button>
              <button onClick={() => openBuilder()} style={{ width: 28, height: 28, background: "#534AB7", border: "none", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Plus size={13} color="#fff" /></button>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} color="#aaa" style={{ position: "absolute", left: 10, top: 9 }} />
            <input value={sidebarFilter} onChange={e => setSidebarFilter(e.target.value)} placeholder="Search..." style={{ width: "100%", background: "#f7f6ff", border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "7px 12px 7px 30px", fontSize: 12, outline: "none" }} />
          </div>
        </div>

        {/* all searches pill */}
        <div style={{ padding: "8px 10px 4px" }}>
          <div onClick={() => { setSelectedSearchId(null); setView("feed"); }}
            style={{ background: selectedSearchId === null && view === "feed" ? "#EEEDFE" : "#FAFAFE", border: selectedSearchId === null && view === "feed" ? "1px solid #534AB7" : "0.5px solid #ece9f8", borderRadius: 10, padding: "10px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 150ms" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#534AB7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart3 size={14} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: selectedSearchId === null ? "#534AB7" : "#1a1a2e" }}>All searches</div>
              <div style={{ fontSize: 11, color: "#7F77DD" }}>{searches.length} active · {POSTS.length} signals</div>
            </div>
          </div>
        </div>

        {/* search cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {filteredSidebarSearches.map(s => {
            const active = selectedSearchId === s.id && view === "feed";
            return (
              <div key={s.id} onClick={() => { setSelectedSearchId(s.id); setView("feed"); }}
                style={{ background: active ? "#EEEDFE" : "#fff", border: active ? "1px solid #534AB7" : "0.5px solid #ece9f8", borderRadius: 10, padding: "10px 12px", cursor: "pointer", opacity: s.paused ? 0.55 : 1, transition: "all 200ms" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {s.platform === "linkedin" ? <LinkedInIcon size={18} /> : <XIcon size={18} />}
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: active ? "#534AB7" : "#1a1a2e" }}>{s.name}</span>
                  <div style={{ position: "relative" }}>
                    <button onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === s.id ? null : s.id); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <MoreVertical size={13} color="#aaa" />
                    </button>
                    {menuOpenId === s.id && (
                      <div style={{ position: "absolute", right: 0, top: 20, background: "#fff", border: "0.5px solid #ece9f8", borderRadius: 8, padding: 4, zIndex: 10, minWidth: 110, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
                        {["Edit", "Duplicate", s.paused ? "Resume" : "Pause", "Delete"].map(action => (
                          <div key={action} onClick={e => { e.stopPropagation(); if (action === "Edit") openBuilder(s); else if (action === "Duplicate") duplicateSearch(s); else if (action === "Pause" || action === "Resume") togglePause(s.id); else deleteSearch(s.id); }}
                            style={{ padding: "5px 10px", fontSize: 12, cursor: "pointer", borderRadius: 4, color: action === "Delete" ? "#DC2626" : "#1a1a2e" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f7f6ff")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            {action}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#888", display: "flex", alignItems: "center", gap: 2 }}><Clock size={9} /> {s.paused ? <span style={{ background: "#F3F4F6", padding: "1px 6px", borderRadius: 20, fontSize: 9, color: "#888" }}>Paused</span> : s.frequency}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, color: "#534AB7", fontWeight: 500 }}>{s.matchCount} signals</span>
                    <span style={{ fontSize: 10, color: "#0F6E56", fontWeight: 500 }}>{s.enrichedCount} enriched</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#aaa", marginTop: 3, display: "flex", alignItems: "flex-start", gap: 3, lineHeight: 1.3 }}>
                  <SlidersHorizontal size={9} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>{s.keywords.join(", ")}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* bottom */}
        <div style={{ padding: "10px 12px", borderTop: "0.5px solid #ece9f8" }}>
          <button onClick={() => openBuilder()} style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Plus size={14} /> New search
          </button>
        </div>
      </div>

      {/* ─── Right panel ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {view === "feed" ? (
          <>
            {successBanner && (
              <div style={{ background: "#E1F5EE", color: "#0F6E56", padding: "10px 20px", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "space-between", fontWeight: 500 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} /> Search created · Your agent is now monitoring</span>
                <X size={14} style={{ cursor: "pointer" }} onClick={() => setSuccessBanner(false)} />
              </div>
            )}

            {/* Stats */}
            <StatsBar searches={searches} posts={POSTS} />

            {/* feed top bar */}
            <div style={{ background: "#fff", borderBottom: "0.5px solid #ece9f8", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{currentSearchName}</span>
                <span style={{ fontSize: 11, color: "#888", background: "#F3F4F6", padding: "2px 8px", borderRadius: 20 }}>{feedPosts.length} results</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SelectInput value={sortBy === "intent" ? "Highest Intent" : "Most Recent"} onChange={v => setSortBy(v === "Highest Intent" ? "intent" : "recent")} options={["Highest Intent", "Most Recent"]} width={140} />
                <SelectInput value={timeFilter} onChange={setTimeFilter} options={["Anytime", "Today", "Last week", "Last month"]} width={120} />
                <button style={{ background: "#f7f6ff", border: "0.5px solid #e2e0f5", color: "#534AB7", borderRadius: 7, padding: "6px 12px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}><RefreshCw size={11} /> Refresh</button>
              </div>
            </div>

            {/* Activity filter */}
            <ActivityFilterBar active={activityFilter} onChange={setActivityFilter} />

            {/* posts */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10, background: "#f7f6ff" }}>
              {feedPosts.map(p => {
                const searchName = searches.find(s => s.id === p.searchId)?.name || "";
                return <PostCard key={p.id} post={p} searchName={searchName} />;
              })}
              {feedPosts.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: 40, fontSize: 13 }}>No signals found for this filter.</div>}
            </div>
          </>
        ) : (
          /* ─── BUILDER VIEW ─── */
          <>
            <div style={{ background: "#fff", borderBottom: "0.5px solid #ece9f8", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ChevronLeft size={16} color="#aaa" style={{ cursor: "pointer" }} onClick={() => setView("feed")} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{editSearchId ? `Edit: ${builder.name}` : "New search"}</span>
              </div>
              <span style={{ fontSize: 12, color: "#aaa" }}>Step {builderStep} of 3</span>
            </div>
            {/* step progress */}
            <div style={{ background: "#fff", borderBottom: "0.5px solid #ece9f8", padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
                {[{ label: "Set up", step: 1 }, { label: "Configure", step: 2 }, { label: "Actions", step: 3 }].map((s, i) => (
                  <div key={s.step} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, ...(builderStep > s.step ? { background: "#1D9E75", color: "#fff" } : builderStep === s.step ? { background: "#534AB7", color: "#fff" } : { background: "transparent", border: "1.5px solid #ddd", color: "#aaa" }) }}>
                        {builderStep > s.step ? <Check size={12} /> : s.step}
                      </div>
                      <span style={{ fontSize: 11, color: builderStep >= s.step ? "#1a1a2e" : "#aaa", fontWeight: builderStep === s.step ? 500 : 400 }}>{s.label}</span>
                    </div>
                    {i < 2 && <div style={{ width: 60, height: 2, background: builderStep > s.step ? "#1D9E75" : builderStep === s.step ? "#534AB7" : "#eee", margin: "0 8px", marginBottom: 18 }} />}
                  </div>
                ))}
              </div>
            </div>
            {/* builder body */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div style={{ width: 420, minWidth: 420, background: "#fff", borderRight: "0.5px solid #ece9f8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                  {builderStep === 1 && (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>Name your workflow</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4, lineHeight: 1.5 }}>Give your search a descriptive name. Choose which platform to monitor.</div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 500, marginTop: 16, marginBottom: 6 }}>Search name <span style={{ color: "#DC2626" }}>*</span></label>
                      <input value={builder.name} onChange={e => setBuilder(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AI SDR hiring signals" style={{ width: "100%", background: "#f9f8ff", border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }} />
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#1a1a2e", marginTop: 20 }}>Select a source to monitor</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4, marginBottom: 12 }}>We'll monitor your signal activity on your chosen schedule.</div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Social listening</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {sources.map(src => (
                          <div key={src.id} onClick={() => setBuilder(p => ({ ...p, source: src.id }))} style={{ background: builder.source === src.id ? "#EEEDFE" : "#fff", border: builder.source === src.id ? "1.5px solid #534AB7" : "0.5px solid #ece9f8", borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "all 200ms" }}>
                            <div style={{ width: 15, height: 15, borderRadius: "50%", border: builder.source === src.id ? "none" : "1.5px solid #ddd", background: builder.source === src.id ? "#534AB7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {builder.source === src.id && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                            </div>
                            {src.icon === "linkedin" ? <LinkedInIcon size={22} /> : <XIcon size={22} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{src.name}</div>
                              <div style={{ fontSize: 11, color: "#aaa" }}>{src.desc}</div>
                            </div>
                            <span style={{ fontSize: 11, color: "#aaa", display: "flex", alignItems: "center", gap: 3 }}><Link2 size={10} /> {src.connections}</span>
                          </div>
                        ))}
                        {comingSoon.map(c => (
                          <div key={c.name} style={{ background: "#fafafa", border: "0.5px solid #ece9f8", borderRadius: 10, padding: "10px 14px", opacity: 0.5, display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 15, height: 15, borderRadius: "50%", border: "1.5px solid #ddd" }} />
                            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#eee" }} />
                            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 11, color: "#aaa" }}>{c.desc}</div></div>
                            <span style={{ background: "#FAEEDA", color: "#854F0B", fontSize: 9, padding: "2px 6px", borderRadius: 3 }}>Coming soon</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {builderStep === 2 && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>Boolean Query <span style={{ color: "#DC2626" }}>*</span></div>
                        <span style={{ fontSize: 11, color: "#aaa" }}>{totalKeywords}/10 keywords</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4, lineHeight: 1.5, marginBottom: 16 }}>LinkedIn supports a maximum of 6 keywords total across all operators.</div>
                      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>AND (all must be present)</label>
                      <TagInput tags={builder.andKeywords} setTags={t => setBuilder(p => ({ ...p, andKeywords: t }))} tint="purple" placeholder="Enter keyword and press Enter..." />
                      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginTop: 14, marginBottom: 6 }}>OR (any can be present)</label>
                      <TagInput tags={builder.orKeywords} setTags={t => setBuilder(p => ({ ...p, orKeywords: t }))} tint="green" placeholder="Enter keyword and press Enter..." />
                      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginTop: 14, marginBottom: 6 }}>NOT (exclude these)</label>
                      <TagInput tags={builder.notKeywords} setTags={t => setBuilder(p => ({ ...p, notKeywords: t }))} tint="red" placeholder="Enter keyword and press Enter..." />
                      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginTop: 16, marginBottom: 6 }}>Query Preview:</label>
                      <div style={{ background: "#f4f3ff", border: "0.5px solid #ece9f8", borderRadius: 6, padding: "8px 12px", fontSize: 12, fontFamily: "monospace", color: queryPreview ? "#534AB7" : "#aaa", fontStyle: queryPreview ? "normal" : "italic" }}>
                        {queryPreview || "No keywords added yet"}
                      </div>
                      <label style={{ fontSize: 12, fontWeight: 500, display: "block", marginTop: 18, marginBottom: 6 }}>Job Title</label>
                      <input value={builder.jobTitle} onChange={e => setBuilder(p => ({ ...p, jobTitle: e.target.value }))} placeholder="Software Engineer, Product Manager..." style={{ width: "100%", background: "#f9f8ff", border: "0.5px solid #e2e0f5", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none" }} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                        <div><label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>Time frame</label><SelectInput value={builder.timeFrame} onChange={v => setBuilder(p => ({ ...p, timeFrame: v }))} options={["Last 24 hours", "Last week", "Last month", "Last 3 months"]} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>Search type</label><SelectInput value={builder.searchType} onChange={v => setBuilder(p => ({ ...p, searchType: v }))} options={["Latest", "Top", "People"]} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>Language</label><SelectInput value={builder.language} onChange={v => setBuilder(p => ({ ...p, language: v }))} options={["Any language", "English", "Spanish", "French", "German"]} /></div>
                        <div><label style={{ fontSize: 12, fontWeight: 500, display: "block", marginBottom: 6 }}>Country</label><SelectInput value={builder.country} onChange={v => setBuilder(p => ({ ...p, country: v }))} options={["Any country", "United States", "United Kingdom", "India", "Germany"]} /></div>
                      </div>
                      <div style={{ border: "0.5px solid #ece9f8", borderRadius: 10, marginTop: 18, overflow: "hidden" }}>
                        {[{ label: "Hide retweets", key: "hideRetweets" as const }, { label: "Hide replies", key: "hideReplies" as const }, { label: "Verified only", key: "verifiedOnly" as const }, { label: "Must contain links", key: "mustContainLinks" as const }, { label: "Exclude sponsored", key: "excludeSponsored" as const }].map((item, i) => (
                          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderTop: i > 0 ? "0.5px solid #ece9f8" : "none" }}>
                            <span style={{ fontSize: 12, color: "#1a1a2e" }}>{item.label}</span>
                            <Toggle on={builder[item.key]} onChange={v => setBuilder(p => ({ ...p, [item.key]: v }))} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {builderStep === 3 && (
                    <>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>Choose run frequency</div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>We'll check this signal on your selected schedule and add any new results.</div>
                      <label style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4, marginTop: 16, marginBottom: 6 }}>Frequency <Info size={11} color="#aaa" /></label>
                      <SelectInput value={builder.frequency} onChange={v => setBuilder(p => ({ ...p, frequency: v }))} options={["Hourly", "Daily", "Weekly", "Monthly"]} />
                      <div style={{ fontSize: 12, color: "#666", marginTop: 10, display: "flex", alignItems: "center", gap: 4 }}><Link2 size={11} /> Recurring cost: <strong>1 credit per signal</strong></div>
                      <div style={{ background: "#f7f6ff", border: "0.5px solid #ece9f8", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                        This agent will run {builder.frequency.toLowerCase()} and automatically enrich new contacts, send personalised outreach, and push matched leads to your CRM.
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 20, marginBottom: 10 }}>What happens on each match</div>
                      <div style={{ border: "0.5px solid #ece9f8", borderRadius: 10, overflow: "hidden" }}>
                        {[{ label: "Enrich contact automatically", key: "enrichAuto" as const }, { label: "Send AI outreach email", key: "sendOutreach" as const }, { label: "Push to CRM", key: "pushCRM" as const }, { label: "Send Slack alert", key: "slackAlert" as const }, { label: "Add to sequence", key: "addToSequence" as const }].map((item, i) => (
                          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderTop: i > 0 ? "0.5px solid #ece9f8" : "none" }}>
                            <span style={{ fontSize: 12, color: "#1a1a2e" }}>{item.label}</span>
                            <Toggle on={builder[item.key]} onChange={v => setBuilder(p => ({ ...p, [item.key]: v }))} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ padding: "14px 20px", borderTop: "0.5px solid #ece9f8", display: "flex", justifyContent: "space-between", background: "#fff" }}>
                  <button onClick={() => builderStep > 1 && setBuilderStep(s => s - 1)} style={{ background: "transparent", border: "0.5px solid #e2e0f5", color: "#666", borderRadius: 8, padding: "7px 20px", fontSize: 13, fontWeight: 500, cursor: builderStep === 1 ? "default" : "pointer", opacity: builderStep === 1 ? 0.35 : 1 }}>Previous</button>
                  {builderStep < 3 ? (
                    <button onClick={() => setBuilderStep(s => s + 1)} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Next</button>
                  ) : (
                    <button onClick={completeBuilder} style={{ background: "#534AB7", color: "#fff", border: "none", borderRadius: 8, padding: "7px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Complete</button>
                  )}
                </div>
              </div>
              {/* right preview */}
              <div style={{ flex: 1, background: "#f7f6ff", overflowY: "auto", padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>Preview</div>
                {builderStep === 1 ? (
                  <>
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>Select a source to see how signals will appear</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
                      {[
                        { icon: Send, label: "Posts & Articles", desc: "Track what your ICP is publishing", color: "#534AB7", bg: "#EEEDFE" },
                        { icon: MessageCircle, label: "Comments & Reactions", desc: "See who's engaging with relevant content", color: "#0F6E56", bg: "#E1F5EE" },
                        { icon: Briefcase, label: "Job Changes", desc: "Detect promotions, new roles & company moves", color: "#C2410C", bg: "#FFF7ED" },
                        { icon: TrendingUp, label: "Intent Scoring", desc: "AI-ranked leads by buying signals", color: "#DC2626", bg: "#FEF2F2" },
                      ].map(s => (
                        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#fff", border: "0.5px solid #ece9f8", borderRadius: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <s.icon size={18} color={s.color} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a2e" }}>{s.label}</div>
                            <div style={{ fontSize: 11, color: "#888" }}>{s.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: "#f0f0ff", border: "0.5px solid #d4d0f5", borderRadius: 8, padding: "9px 14px", marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#534AB7" }}>
                      <Info size={13} /> Preview showing sample results matching your query.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                      {POSTS.slice(0, builderStep === 3 ? 2 : 3).map(p => (
                        <PostCard key={p.id} post={p} searchName="Preview" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
