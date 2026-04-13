import { useState, useMemo, useCallback } from "react";
import { Search, Lock, Check, Mic, Sparkles, ChevronRight } from "lucide-react";

/* ═══════════════════════════════════════════════════
   SIGNAL DATA
   ═══════════════════════════════════════════════════ */

interface Signal {
  id: string;
  name: string;
  description: string;
  category: string;
  strength: "High" | "Med" | "Low";
  tier: "Free" | "Starter" | "Growth" | "Scale";
  isNew?: boolean;
  isTrending?: boolean;
  source?: string;
}

const SIGNALS: Signal[] = [
  // ── Job change ──
  { id: "jc1", name: "New VP Sales hired", description: "Detect when a company hires a new VP of Sales — strong buying signal", category: "Job change", strength: "High", tier: "Free", isTrending: true },
  { id: "jc2", name: "New CRO appointed", description: "Chief Revenue Officer change signals budget re-allocation", category: "Job change", strength: "High", tier: "Free" },
  { id: "jc3", name: "First GTM hire", description: "Early-stage company makes their first go-to-market hire", category: "Job change", strength: "High", tier: "Starter", isNew: true },
  { id: "jc4", name: "Head of AI hired", description: "Company investing in AI capabilities — potential buyer", category: "Job change", strength: "Med", tier: "Starter", isNew: true },
  { id: "jc5", name: "CMO replacement", description: "New CMO typically reviews all martech within 90 days", category: "Job change", strength: "High", tier: "Free" },
  { id: "jc6", name: "VP Engineering hired", description: "Engineering leadership change may shift tool adoption", category: "Job change", strength: "Med", tier: "Starter" },
  { id: "jc7", name: "Head of Ops appointed", description: "Operations leader evaluating workflow and automation tools", category: "Job change", strength: "Med", tier: "Free" },
  { id: "jc8", name: "CFO departure", description: "Finance leadership transition — budget uncertainty", category: "Job change", strength: "Low", tier: "Growth" },
  { id: "jc9", name: "Board member added", description: "New board member may influence strategic direction", category: "Job change", strength: "Low", tier: "Growth" },
  { id: "jc10", name: "Sales team restructure", description: "Major sales re-org signals process change", category: "Job change", strength: "High", tier: "Starter", isTrending: true },
  { id: "jc11", name: "Founder steps down", description: "Founder transition to new CEO — strategy shift", category: "Job change", strength: "Med", tier: "Growth" },
  { id: "jc12", name: "VP Customer Success hired", description: "CS leadership hire signals retention focus", category: "Job change", strength: "Med", tier: "Starter" },
  { id: "jc13", name: "Champion left company", description: "Your internal champion has moved — re-engage or follow", category: "Job change", strength: "High", tier: "Free", isTrending: true },
  { id: "jc14", name: "Champion joined new company", description: "Follow your champion to their new role", category: "Job change", strength: "High", tier: "Free" },

  // ── Funding events ──
  { id: "fe1", name: "Series A raised", description: "Company raised Series A — scaling phase begins", category: "Funding events", strength: "High", tier: "Free", isTrending: true },
  { id: "fe2", name: "Series B raised", description: "Series B signals growth-stage investment in tools", category: "Funding events", strength: "High", tier: "Free" },
  { id: "fe3", name: "Series C raised", description: "Late-stage funding — enterprise tool adoption likely", category: "Funding events", strength: "High", tier: "Free" },
  { id: "fe4", name: "Seed round closed", description: "Early-stage companies forming their initial stack", category: "Funding events", strength: "Med", tier: "Starter" },
  { id: "fe5", name: "Acquisition announced", description: "M&A activity creates tool consolidation opportunities", category: "Funding events", strength: "High", tier: "Starter", isTrending: true },
  { id: "fe6", name: "IPO filed", description: "IPO preparation requires enterprise-grade tooling", category: "Funding events", strength: "Med", tier: "Growth" },
  { id: "fe7", name: "Bridge round raised", description: "Bridge funding indicates pivot or extended runway", category: "Funding events", strength: "Low", tier: "Growth" },
  { id: "fe8", name: "Debt financing secured", description: "Non-dilutive funding for operational expansion", category: "Funding events", strength: "Low", tier: "Growth" },
  { id: "fe9", name: "Down round detected", description: "Down round signals budget pressure — offer ROI narrative", category: "Funding events", strength: "Med", tier: "Scale" },
  { id: "fe10", name: "Grant funding awarded", description: "Government or institutional grant received", category: "Funding events", strength: "Low", tier: "Scale" },
  { id: "fe11", name: "PE buyout", description: "Private equity acquisition — operational efficiency focus", category: "Funding events", strength: "High", tier: "Growth" },
  { id: "fe12", name: "Revenue milestone press", description: "Company announced ARR or revenue milestone publicly", category: "Funding events", strength: "Med", tier: "Starter" },

  // ── Hiring signals ──
  { id: "hs1", name: "10+ sales roles open", description: "Aggressive sales hiring signals growth investment", category: "Hiring signals", strength: "High", tier: "Free", isTrending: true },
  { id: "hs2", name: "SDR team scaling", description: "SDR hiring surge indicates outbound investment", category: "Hiring signals", strength: "High", tier: "Free" },
  { id: "hs3", name: "Engineering hiring spree", description: "20%+ engineering growth — building something big", category: "Hiring signals", strength: "Med", tier: "Starter" },
  { id: "hs4", name: "RevOps role posted", description: "RevOps hire signals tooling evaluation", category: "Hiring signals", strength: "High", tier: "Starter", isNew: true },
  { id: "hs5", name: "Marketing team growing", description: "Marketing headcount increase — martech needs follow", category: "Hiring signals", strength: "Med", tier: "Free" },
  { id: "hs6", name: "Customer Success hiring", description: "CS expansion signals post-sale tool needs", category: "Hiring signals", strength: "Med", tier: "Starter" },
  { id: "hs7", name: "Hiring freeze detected", description: "Company paused hiring — tighten pitch to ROI", category: "Hiring signals", strength: "Low", tier: "Growth" },
  { id: "hs8", name: "Data team expansion", description: "Data/analytics hiring signals BI tool evaluation", category: "Hiring signals", strength: "Med", tier: "Starter" },
  { id: "hs9", name: "Layoffs announced", description: "Reduction in force — approach with efficiency narrative", category: "Hiring signals", strength: "Med", tier: "Growth" },
  { id: "hs10", name: "Remote-first shift", description: "Company going remote-first — collaboration tools needed", category: "Hiring signals", strength: "Low", tier: "Growth" },
  { id: "hs11", name: "New office opened", description: "Physical expansion into new market", category: "Hiring signals", strength: "Low", tier: "Scale" },
  { id: "hs12", name: "International expansion hiring", description: "Hiring in new geographies signals global growth", category: "Hiring signals", strength: "Med", tier: "Growth" },

  // ── Buying intent ──
  { id: "bi1", name: "Pricing page visited", description: "Prospect visited your pricing page — high intent", category: "Buying intent", strength: "High", tier: "Free", isTrending: true },
  { id: "bi2", name: "G2 category research", description: "Prospect researching your category on G2", category: "Buying intent", strength: "High", tier: "Starter" },
  { id: "bi3", name: "ROI calculator used", description: "Prospect used ROI calculator — evaluating budget", category: "Buying intent", strength: "High", tier: "Starter", isNew: true },
  { id: "bi4", name: "Comparison page viewed", description: "Prospect viewing competitor comparison pages", category: "Buying intent", strength: "High", tier: "Starter" },
  { id: "bi5", name: "Demo request (competitor)", description: "Prospect requested demo from a competitor", category: "Buying intent", strength: "High", tier: "Growth" },
  { id: "bi6", name: "Multiple stakeholders visiting", description: "3+ people from same company on your site", category: "Buying intent", strength: "High", tier: "Starter", isTrending: true },
  { id: "bi7", name: "Whitepaper downloaded", description: "Content download signals education phase", category: "Buying intent", strength: "Med", tier: "Free" },
  { id: "bi8", name: "Webinar registered", description: "Prospect signed up for industry webinar", category: "Buying intent", strength: "Med", tier: "Free" },
  { id: "bi9", name: "Case study viewed", description: "Prospect reading customer success stories", category: "Buying intent", strength: "Med", tier: "Starter" },
  { id: "bi10", name: "RFP published", description: "Formal request for proposal in your category", category: "Buying intent", strength: "High", tier: "Growth" },
  { id: "bi11", name: "Budget cycle timing", description: "Fiscal year planning window detected", category: "Buying intent", strength: "Med", tier: "Scale" },
  { id: "bi12", name: "Anonymous company identified", description: "De-anonymized company visiting your website", category: "Buying intent", strength: "Med", tier: "Starter", isNew: true },

  // ── Tech stack ──
  { id: "ts1", name: "Competitor tool removed", description: "Company uninstalled a competitor's product", category: "Tech stack", strength: "High", tier: "Starter", isTrending: true },
  { id: "ts2", name: "HubSpot installed", description: "CRM adoption signals sales process maturity", category: "Tech stack", strength: "Med", tier: "Starter" },
  { id: "ts3", name: "Old CRM replaced", description: "CRM migration signals evaluation window", category: "Tech stack", strength: "High", tier: "Growth" },
  { id: "ts4", name: "Salesforce added", description: "Enterprise CRM adoption — ready for add-ons", category: "Tech stack", strength: "Med", tier: "Starter" },
  { id: "ts5", name: "Marketing automation change", description: "Switched MAP — stack consolidation opportunity", category: "Tech stack", strength: "High", tier: "Growth" },
  { id: "ts6", name: "Data warehouse adopted", description: "Snowflake/BigQuery adoption — data maturity", category: "Tech stack", strength: "Med", tier: "Growth" },
  { id: "ts7", name: "SEO tool installed", description: "Investing in organic — content tooling follows", category: "Tech stack", strength: "Low", tier: "Growth" },
  { id: "ts8", name: "Chat widget added", description: "Added Intercom/Drift — conversational selling", category: "Tech stack", strength: "Low", tier: "Scale" },
  { id: "ts9", name: "ABM platform adopted", description: "Account-based motion signals enterprise readiness", category: "Tech stack", strength: "High", tier: "Growth", isNew: true },
  { id: "ts10", name: "CDP implemented", description: "Customer data platform signals data unification", category: "Tech stack", strength: "Med", tier: "Scale" },
  { id: "ts11", name: "Contract renewal window", description: "Existing tool contract coming up for renewal", category: "Tech stack", strength: "High", tier: "Scale" },
  { id: "ts12", name: "Tech stack audit detected", description: "Company reviewing all tools — consolidation risk/opp", category: "Tech stack", strength: "High", tier: "Scale" },

  // ── Company growth ──
  { id: "cg1", name: "Employee count +20%", description: "Rapid headcount growth signals tool scaling needs", category: "Company growth", strength: "High", tier: "Free" },
  { id: "cg2", name: "Revenue doubled YoY", description: "Revenue growth drives tool investment", category: "Company growth", strength: "High", tier: "Starter" },
  { id: "cg3", name: "Office expansion", description: "New office signals geographic expansion", category: "Company growth", strength: "Med", tier: "Growth" },
  { id: "cg4", name: "New market entry", description: "Expanding into new vertical or geography", category: "Company growth", strength: "Med", tier: "Starter" },
  { id: "cg5", name: "Product launch", description: "New product line requires GTM support", category: "Company growth", strength: "High", tier: "Starter", isNew: true },
  { id: "cg6", name: "Partnership announced", description: "Strategic partnership signals growth trajectory", category: "Company growth", strength: "Med", tier: "Growth" },
  { id: "cg7", name: "Award or recognition", description: "Industry award signals company momentum", category: "Company growth", strength: "Low", tier: "Growth" },
  { id: "cg8", name: "Website traffic spike", description: "Significant traffic increase detected", category: "Company growth", strength: "Med", tier: "Scale" },
  { id: "cg9", name: "App store ranking jump", description: "Mobile app climbing rankings rapidly", category: "Company growth", strength: "Med", tier: "Scale" },
  { id: "cg10", name: "Customer count milestone", description: "Public announcement of customer milestone", category: "Company growth", strength: "Med", tier: "Starter" },

  // ── News & events ──
  { id: "ne1", name: "CEO keynote at conference", description: "Executive visibility at major industry event", category: "News & events", strength: "Med", tier: "Free" },
  { id: "ne2", name: "Press release published", description: "Company making public announcements", category: "News & events", strength: "Low", tier: "Free" },
  { id: "ne3", name: "Industry event sponsorship", description: "Sponsoring events signals marketing investment", category: "News & events", strength: "Low", tier: "Starter" },
  { id: "ne4", name: "Regulatory change impact", description: "New regulations affecting the company", category: "News & events", strength: "Med", tier: "Growth" },
  { id: "ne5", name: "Data breach reported", description: "Security incident — compliance tool opportunity", category: "News & events", strength: "High", tier: "Growth", isTrending: true },
  { id: "ne6", name: "Earnings beat/miss", description: "Quarterly earnings diverged from expectations", category: "News & events", strength: "Med", tier: "Scale" },
  { id: "ne7", name: "Lawsuit filed", description: "Legal action may shift priorities and budgets", category: "News & events", strength: "Low", tier: "Scale" },
  { id: "ne8", name: "ESG initiative launched", description: "Sustainability commitment signals new priorities", category: "News & events", strength: "Low", tier: "Scale" },

  // ── Leadership change ──
  { id: "lc1", name: "CEO replaced", description: "New CEO brings new strategy — tool audit likely", category: "Leadership change", strength: "High", tier: "Free" },
  { id: "lc2", name: "CTO appointed", description: "New CTO evaluates entire tech stack", category: "Leadership change", strength: "High", tier: "Free" },
  { id: "lc3", name: "Board shake-up", description: "Multiple board changes signal strategic pivot", category: "Leadership change", strength: "Med", tier: "Growth" },
  { id: "lc4", name: "Interim leadership", description: "Temporary leadership signals uncertainty and opportunity", category: "Leadership change", strength: "Med", tier: "Growth" },
  { id: "lc5", name: "VP Marketing replaced", description: "Marketing leadership change — martech review incoming", category: "Leadership change", strength: "High", tier: "Starter" },
  { id: "lc6", name: "New Head of Procurement", description: "Procurement lead evaluates vendor contracts", category: "Leadership change", strength: "Med", tier: "Growth" },

  // ── Email engagement ──
  { id: "ee1", name: "Email opened 3+ times", description: "Repeated opens signal strong interest", category: "Email engagement", strength: "High", tier: "Free" },
  { id: "ee2", name: "CTA clicked", description: "Prospect clicked your email CTA — warm lead", category: "Email engagement", strength: "High", tier: "Free" },
  { id: "ee3", name: "Positive reply sentiment", description: "AI detected positive sentiment in reply", category: "Email engagement", strength: "High", tier: "Starter", isNew: true },
  { id: "ee4", name: "Forwarded to colleague", description: "Email was forwarded internally — multi-threading", category: "Email engagement", strength: "High", tier: "Starter" },
  { id: "ee5", name: "Unsubscribe after interest", description: "Previously engaged contact unsubscribed", category: "Email engagement", strength: "Low", tier: "Growth" },
  { id: "ee6", name: "Re-engaged after cold", description: "Contact re-opened emails after 30+ days", category: "Email engagement", strength: "High", tier: "Starter" },
  { id: "ee7", name: "Link clicked multiple times", description: "Same link clicked repeatedly — deep interest", category: "Email engagement", strength: "Med", tier: "Free" },
  { id: "ee8", name: "Reply with question", description: "Prospect asked a question — buying signal", category: "Email engagement", strength: "High", tier: "Starter" },

  // ── Website behavior ──
  { id: "wb1", name: "Pricing page visit", description: "High-intent page visit detected", category: "Website behavior", strength: "High", tier: "Free" },
  { id: "wb2", name: "Anonymous company ID", description: "De-anonymized company from IP/fingerprint", category: "Website behavior", strength: "Med", tier: "Starter" },
  { id: "wb3", name: "Comparison page view", description: "Viewing competitor comparisons on your site", category: "Website behavior", strength: "High", tier: "Starter" },
  { id: "wb4", name: "Return visitor (3+ sessions)", description: "Multiple sessions indicate evaluation phase", category: "Website behavior", strength: "High", tier: "Free" },
  { id: "wb5", name: "API docs visited", description: "Technical evaluation underway", category: "Website behavior", strength: "Med", tier: "Starter" },
  { id: "wb6", name: "Careers page viewed", description: "Prospect checking your team — trust building", category: "Website behavior", strength: "Low", tier: "Growth" },
  { id: "wb7", name: "Integration page viewed", description: "Checking compatibility with their stack", category: "Website behavior", strength: "Med", tier: "Starter" },
  { id: "wb8", name: "Security/compliance page", description: "Enterprise buyer checking security posture", category: "Website behavior", strength: "Med", tier: "Growth" },

  // ── Social signals ──
  { id: "ss1", name: "LinkedIn post engagement", description: "Prospect liked/commented on industry content", category: "Social signals", strength: "Med", tier: "Free" },
  { id: "ss2", name: "Twitter mention", description: "Prospect mentioned your brand or category", category: "Social signals", strength: "Med", tier: "Starter" },
  { id: "ss3", name: "Followed your company page", description: "LinkedIn company page follow — awareness signal", category: "Social signals", strength: "Low", tier: "Free" },
  { id: "ss4", name: "Shared competitor content", description: "Prospect amplifying competitor content", category: "Social signals", strength: "Med", tier: "Growth" },
  { id: "ss5", name: "Published pain-point post", description: "Prospect posted about a problem you solve", category: "Social signals", strength: "High", tier: "Starter", isNew: true },
  { id: "ss6", name: "Job posted on LinkedIn", description: "Hiring for a role your tool supports", category: "Social signals", strength: "Med", tier: "Free" },

  // ── CRM signals ──
  { id: "cr1", name: "Deal went dark 30d", description: "Open deal with no activity for 30 days", category: "CRM signals", strength: "High", tier: "Free" },
  { id: "cr2", name: "Demo no-show", description: "Scheduled demo was missed — re-engage", category: "CRM signals", strength: "Med", tier: "Free" },
  { id: "cr3", name: "Deal lost to competitor", description: "Closed-lost to named competitor — plan win-back", category: "CRM signals", strength: "High", tier: "Starter" },
  { id: "cr4", name: "Contract expiring in 60d", description: "Existing contract renewal window approaching", category: "CRM signals", strength: "High", tier: "Free" },
  { id: "cr5", name: "Engagement score dropped", description: "Lead score decreased significantly", category: "CRM signals", strength: "Med", tier: "Starter" },
  { id: "cr6", name: "Multi-thread stalled", description: "Multiple contacts gone cold on same deal", category: "CRM signals", strength: "High", tier: "Growth" },
  { id: "cr7", name: "Re-opened closed deal", description: "Previously closed deal re-activated", category: "CRM signals", strength: "High", tier: "Starter", isNew: true },
  { id: "cr8", name: "Stage regression", description: "Deal moved backward in pipeline", category: "CRM signals", strength: "High", tier: "Growth" },

  // ── Expansion & churn ──
  { id: "ec1", name: "Usage spike detected", description: "Existing customer usage increased 50%+", category: "Expansion & churn", strength: "High", tier: "Starter" },
  { id: "ec2", name: "NPS score dropped", description: "Customer satisfaction declining — churn risk", category: "Expansion & churn", strength: "High", tier: "Starter" },
  { id: "ec3", name: "Support tickets surging", description: "3x support tickets in 30 days — risk signal", category: "Expansion & churn", strength: "High", tier: "Growth" },
  { id: "ec4", name: "New department adoption", description: "Different department started using your product", category: "Expansion & churn", strength: "High", tier: "Starter", isNew: true },
  { id: "ec5", name: "Feature request pattern", description: "Consistent feature requests in expansion area", category: "Expansion & churn", strength: "Med", tier: "Growth" },
  { id: "ec6", name: "Login frequency declined", description: "User engagement dropping — early churn indicator", category: "Expansion & churn", strength: "High", tier: "Growth" },
  { id: "ec7", name: "Billing page visited", description: "Customer on billing page — downgrade or cancel risk", category: "Expansion & churn", strength: "High", tier: "Starter" },
  { id: "ec8", name: "API usage growing", description: "Technical integration deepening — expansion signal", category: "Expansion & churn", strength: "Med", tier: "Growth" },

  // ── Competitor signals ──
  { id: "cs1", name: "Competitor negative review", description: "Competitor received negative G2/Capterra review", category: "Competitor signals", strength: "High", tier: "Starter", isTrending: true },
  { id: "cs2", name: "Competitor price increase", description: "Competitor raised prices — displacement opportunity", category: "Competitor signals", strength: "High", tier: "Growth" },
  { id: "cs3", name: "Competitor outage reported", description: "Competitor downtime — offer reliability narrative", category: "Competitor signals", strength: "High", tier: "Growth", isTrending: true },
  { id: "cs4", name: "Competitor feature removed", description: "Competitor deprecated a key feature you offer", category: "Competitor signals", strength: "High", tier: "Scale" },
  { id: "cs5", name: "Competitor funding stall", description: "Competitor failed to raise — stability concern", category: "Competitor signals", strength: "Med", tier: "Scale" },
  { id: "cs6", name: "Competitor layoffs", description: "Competitor reducing staff — support quality risk", category: "Competitor signals", strength: "Med", tier: "Growth" },
  { id: "cs7", name: "Competitor acquisition rumor", description: "Competitor may be acquired — uncertainty for customers", category: "Competitor signals", strength: "Med", tier: "Scale" },
  { id: "cs8", name: "Lost deal reactivated", description: "Previously lost prospect showing new intent signals", category: "Competitor signals", strength: "High", tier: "Starter" },
];

/* ═══════════════════════════════════════════════════
   CATEGORY DATA
   ═══════════════════════════════════════════════════ */

interface CategoryItem {
  label: string;
  section?: string;
}

const CATEGORIES: CategoryItem[] = [
  { label: "All signals" },
  { label: "Job change", section: "Trending now" },
  { label: "Funding events", section: "Trending now" },
  { label: "Hiring signals", section: "Trending now" },
  { label: "Buying intent", section: "Trending now" },
  { label: "Tech stack", section: "Company signals" },
  { label: "Company growth", section: "Company signals" },
  { label: "News & events", section: "Company signals" },
  { label: "Leadership change", section: "Company signals" },
  { label: "Email engagement", section: "People signals" },
  { label: "Website behavior", section: "People signals" },
  { label: "Social signals", section: "People signals" },
  { label: "CRM signals", section: "Revenue signals" },
  { label: "Expansion & churn", section: "Revenue signals" },
  { label: "Competitor signals", section: "Revenue signals" },
];

/* ═══════════════════════════════════════════════════
   AI SUGGESTION MAPPING
   ═══════════════════════════════════════════════════ */

const SUGGESTION_MAP: { keywords: RegExp; signalIds: string[] }[] = [
  { keywords: /vp|hire|exec|leader/i, signalIds: ["jc1", "jc2", "jc3", "jc4"] },
  { keywords: /fund|series|raise|capital/i, signalIds: ["fe1", "fe2", "fe3", "fe5"] },
  { keywords: /competi|rival|g2|capterra/i, signalIds: ["ts1", "bi2", "cs1", "cs3"] },
  { keywords: /pricing|price|buy|intent|evaluat/i, signalIds: ["bi1", "bi2", "bi3", "wb1"] },
  { keywords: /tech|stack|tool|hubspot|crm/i, signalIds: ["ts1", "ts2", "ts3", "ts4"] },
  { keywords: /website|visit|page|anonymous/i, signalIds: ["wb1", "wb2", "wb3", "bi12"] },
  { keywords: /deal|dark|pipeline|lost/i, signalIds: ["cr1", "cr2", "cr3", "cr8"] },
  { keywords: /email|reply|open|sequence/i, signalIds: ["ee1", "ee2", "ee3", "ee4"] },
];

const EXAMPLE_CHIPS = [
  "Funded + hiring GTM",
  "Pricing page intent",
  "Competitor displacement",
  "New exec + HubSpot",
  "Series A raising",
  "Deal gone dark",
];

const FILTER_PILLS = ["All", "🔥 Trending", "High strength", "New", "|", "Free", "Starter", "Growth", "Scale"];

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function SignalsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All signals");
  const [activePill, setActivePill] = useState("All");
  const [promptInput, setPromptInput] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  /* derived */
  const signalMap = useMemo(() => {
    const m = new Map<string, Signal>();
    SIGNALS.forEach(s => m.set(s.id, s));
    return m;
  }, []);

  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = { "All signals": SIGNALS.length };
    SIGNALS.forEach(s => { m[s.category] = (m[s.category] || 0) + 1; });
    return m;
  }, []);

  const filteredSignals = useMemo(() => {
    let list = SIGNALS;
    if (activeCategory !== "All signals") list = list.filter(s => s.category === activeCategory);
    if (activePill === "🔥 Trending") list = list.filter(s => s.isTrending);
    else if (activePill === "High strength") list = list.filter(s => s.strength === "High");
    else if (activePill === "New") list = list.filter(s => s.isNew);
    else if (["Free", "Starter", "Growth", "Scale"].includes(activePill)) list = list.filter(s => s.tier === activePill);
    return list;
  }, [activeCategory, activePill]);

  const groupedSignals = useMemo(() => {
    const groups: Record<string, Signal[]> = {};
    filteredSignals.forEach(s => {
      (groups[s.category] ||= []).push(s);
    });
    return groups;
  }, [filteredSignals]);

  const suggestions = useMemo(() => {
    if (promptInput.length < 3) return [];
    const ids = new Set<string>();
    SUGGESTION_MAP.forEach(({ keywords, signalIds }) => {
      if (keywords.test(promptInput)) signalIds.forEach(id => ids.add(id));
    });
    return Array.from(ids).slice(0, 8).map(id => signalMap.get(id)!).filter(Boolean);
  }, [promptInput, signalMap]);

  const toggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearAll = () => setSelectedIds(new Set());

  const toggleExpand = (cat: string) => {
    setExpandedCategories(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  const filteredCategories = CATEGORIES.filter(c =>
    !categorySearch || c.label.toLowerCase().includes(categorySearch.toLowerCase())
  );

  /* ═══ BADGE HELPERS ═══ */
  const strengthBadge = (s: Signal) => {
    const cls = s.strength === "High"
      ? "bg-[hsl(0,93%,94%)] text-[hsl(0,72%,30%)]"
      : s.strength === "Med"
        ? "bg-[hsl(45,97%,89%)] text-[hsl(26,90%,30%)]"
        : "bg-muted text-muted-foreground";
    return <span className={`text-[9px] px-[5px] py-[2px] rounded-[3px] font-medium ${cls}`}>{s.strength}</span>;
  };

  const tierBadge = (s: Signal) => {
    if (s.tier === "Free") return null;
    const cls = s.tier === "Growth"
      ? "bg-purple-light text-purple-text"
      : s.tier === "Scale"
        ? "bg-[hsl(0,93%,94%)] text-[hsl(0,72%,30%)]"
        : "bg-muted text-muted-foreground";
    return <span className={`text-[9px] px-[5px] py-[2px] rounded-[3px] font-medium ${cls}`}>{s.tier}</span>;
  };

  const isLocked = (s: Signal) => s.tier === "Scale";

  /* ═══ RENDER ═══ */
  return (
    <div className="flex flex-col h-full min-h-screen bg-card">
      {/* ── TOP NAV ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <span className="text-[14px] font-bold text-foreground">Signals library</span>
          <span className="text-[11px] text-muted-foreground">4,000+ signals</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border">
            + Custom signal
          </button>
          <button className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md border border-border">
            Import
          </button>
          {selectedIds.size > 0 && (
            <button className="text-[11px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity">
              Apply to workflow
            </button>
          )}
        </div>
      </div>

      {/* ── HERO PROMPT ── */}
      <div className="bg-card border-b border-border text-center px-6 pt-10 pb-7">
        <div className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground font-semibold mb-2">
          AI-Powered Signal Discovery
        </div>
        <h1 className="text-[22px] font-medium text-foreground mb-1">Find signals for your GTM use case</h1>
        <p className="text-[13px] text-muted-foreground mb-6">
          Describe your ideal trigger and Outmate will suggest the best signals
        </p>

        {/* Prompt input */}
        <div className="relative max-w-[720px] mx-auto mb-4">
          <input
            type="text"
            value={promptInput}
            onChange={e => setPromptInput(e.target.value)}
            placeholder="e.g. Alert me when a VP Sales joins a Series A SaaS company in Europe..."
            className="w-full pl-[14px] pr-[140px] py-[14px] rounded-[10px] border-[1.5px] border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo focus:shadow-[0_0_0_3px_rgba(79,70,229,0.08)] transition-all"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <button className="p-2 text-muted-foreground hover:text-foreground rounded-md">
              <Mic className="w-4 h-4" />
            </button>
            <button className="text-[11px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Find signals
            </button>
          </div>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap justify-center gap-2 max-w-[720px] mx-auto">
          {EXAMPLE_CHIPS.map(c => (
            <button
              key={c}
              onClick={() => setPromptInput(c)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-muted text-muted-foreground hover:bg-indigo-light hover:text-indigo transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT SIDEBAR ── */}
        <div className="w-[220px] min-w-[220px] bg-card border-r border-border overflow-y-auto">
          <div className="px-3 pt-4 pb-2">
            <div className="text-[11px] font-semibold text-foreground mb-2 px-1">Browse by category</div>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={2.5} />
              <input
                type="text"
                value={categorySearch}
                onChange={e => setCategorySearch(e.target.value)}
                placeholder="Search categories"
                className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-md bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo"
              />
            </div>
          </div>

          <div className="px-2 pb-4">
            {(() => {
              let lastSection = "";
              return filteredCategories.map(c => {
                const showSection = c.section && c.section !== lastSection;
                if (c.section) lastSection = c.section;
                const active = activeCategory === c.label;
                return (
                  <div key={c.label}>
                    {showSection && (
                      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground px-3 pt-4 pb-1.5">
                        {c.section}
                      </div>
                    )}
                    <button
                      onClick={() => setActiveCategory(c.label)}
                      className={`w-full flex items-center justify-between px-3 py-[6px] rounded-md text-[11px] transition-colors ${
                        active
                          ? "bg-indigo-light text-indigo font-semibold border-l-2 border-indigo"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{c.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        active ? "bg-indigo-light text-indigo" : "bg-muted text-muted-foreground"
                      }`}>
                        {categoryCounts[c.label] || 0}
                      </span>
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ── RIGHT GRID AREA ── */}
        <div className="flex-1 bg-background overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>
          <div className="px-6 py-5">
            {/* Filter strip */}
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium mr-1">Show:</span>
              {FILTER_PILLS.map((p, i) =>
                p === "|" ? (
                  <div key={i} className="w-px h-4 bg-border mx-1" />
                ) : (
                  <button
                    key={p}
                    onClick={() => setActivePill(p)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
                      activePill === p
                        ? "bg-indigo text-primary-foreground border-indigo"
                        : "border-border text-muted-foreground hover:bg-indigo-light hover:text-indigo hover:border-indigo-light"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            {/* Selected banner */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-indigo-light border border-indigo">
                <span className="text-[12px] font-semibold text-indigo">{selectedIds.size} selected</span>
                <span className="text-[11px] text-muted-foreground truncate flex-1">
                  {Array.from(selectedIds).slice(0, 3).map(id => signalMap.get(id)?.name).join(", ")}
                  {selectedIds.size > 3 && ` +${selectedIds.size - 3} more`}
                </span>
                <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground">Clear all</button>
                <button className="text-[11px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity flex items-center gap-1">
                  Apply to workflow <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* AI Suggestions */}
            {suggestions.length > 0 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-semibold text-foreground">Suggested for you</span>
                  <span className="text-[9px] font-bold text-indigo bg-indigo-light px-1.5 py-0.5 rounded">AI</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map(s => {
                    const sel = selectedIds.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                          sel
                            ? "bg-indigo-light border-indigo text-indigo"
                            : "bg-card border-border text-foreground hover:border-indigo hover:bg-indigo-light"
                        }`}
                      >
                        {s.name}
                        {sel ? <Check className="w-3 h-3" /> : <span className="text-muted-foreground">+</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Signal cards grid */}
            {Object.entries(groupedSignals).map(([category, signals]) => {
              const expanded = expandedCategories.has(category);
              const visible = expanded ? signals : signals.slice(0, 6);
              return (
                <div key={category} className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[12px] font-bold text-foreground">{category}</h2>
                    {signals.length > 6 && (
                      <button
                        onClick={() => toggleExpand(category)}
                        className="text-[10px] text-indigo hover:underline flex items-center gap-0.5"
                      >
                        {expanded ? "Show less" : `View all ${signals.length}`} <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {visible.map(s => {
                      const locked = isLocked(s);
                      const sel = selectedIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => locked ? undefined : toggle(s.id)}
                          className={`text-left p-[13px] rounded-[10px] border transition-all ${
                            locked
                              ? "opacity-55 cursor-not-allowed border-border bg-card"
                              : sel
                                ? "bg-indigo-light border-indigo shadow-[0_1px_4px_rgba(79,70,229,0.06)]"
                                : "bg-card border-border hover:bg-[hsl(240,20%,99%)] hover:border-[hsl(224,76%,82%)] hover:shadow-[0_1px_4px_rgba(79,70,229,0.06)]"
                          }`}
                        >
                          {/* Top row */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="text-[11px] font-bold text-foreground leading-snug">{s.name}</span>
                            {locked ? (
                              <Lock className="w-[15px] h-[15px] text-muted-foreground shrink-0 mt-0.5" />
                            ) : (
                              <div className={`w-[15px] h-[15px] rounded border-[1.5px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                sel ? "bg-indigo border-indigo" : "border-border"
                              }`}>
                                {sel && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
                              </div>
                            )}
                          </div>
                          {/* Desc */}
                          <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{s.description}</p>
                          {/* Footer badges */}
                          <div className="flex items-center gap-1 flex-wrap">
                            {strengthBadge(s)}
                            {tierBadge(s)}
                            {s.isNew && <span className="text-[9px] px-[5px] py-[2px] rounded-[3px] font-medium bg-green-light text-green-text">New</span>}
                            {s.isTrending && <span className="text-[9px] px-[5px] py-[2px] rounded-[3px] font-medium bg-[hsl(0,93%,94%)] text-[hsl(0,72%,30%)]">🔥 Trending</span>}
                            {s.source && <span className="text-[9px] px-[5px] py-[2px] rounded-[3px] font-medium bg-muted text-muted-foreground">{s.source}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
