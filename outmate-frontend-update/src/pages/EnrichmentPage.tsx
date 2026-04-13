import { useState, useRef, useEffect, useCallback } from "react";
import EnrichmentModal from "@/components/EnrichmentModal";
import {
  Settings, List, Plus, X, Search, Filter, ArrowUpDown,
  History, Download, ExternalLink, Square, ChevronRight,
  ArrowUp, Sparkles, Zap, Mail, Building2, Star, PenLine,
  Send, Shield, Globe, Phone, TrendingUp, FileText, Hash,
  MessageSquare, Target, Briefcase, Award, Lock, Users, Coins,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

/* ═══════════════════════════════════════════════════
   TYPES & DATA
   ═══════════════════════════════════════════════════ */

interface Person {
  id: number;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string | null;
  emailStatus: "Verified" | "Unverified" | "Invalid" | null;
  phone: string | null;
  linkedin: string;
  icpScore: number;
  companyBrief: string;
  emailOpener?: string;
  avatarColor: string;
  companyColor: string;
}

const AVATAR_COLORS = [
  "hsl(239,84%,67%)", "hsl(142,71%,45%)", "hsl(25,95%,53%)", "hsl(271,91%,65%)",
  "hsl(173,80%,40%)", "hsl(0,84%,60%)", "hsl(45,93%,47%)", "hsl(200,80%,50%)",
  "hsl(330,70%,55%)", "hsl(160,60%,45%)", "hsl(280,60%,55%)", "hsl(15,80%,55%)",
  "hsl(210,70%,50%)", "hsl(120,50%,45%)", "hsl(350,65%,50%)", "hsl(190,75%,45%)",
];

const COMPANY_COLORS = [
  "hsl(239,70%,60%)", "hsl(142,60%,40%)", "hsl(25,85%,50%)", "hsl(271,75%,58%)",
  "hsl(173,70%,38%)", "hsl(0,70%,55%)", "hsl(45,80%,45%)", "hsl(200,70%,48%)",
  "hsl(330,60%,50%)", "hsl(160,50%,42%)", "hsl(280,55%,50%)", "hsl(15,70%,50%)",
  "hsl(210,60%,48%)", "hsl(120,45%,42%)", "hsl(350,55%,48%)", "hsl(190,65%,42%)",
];

const PEOPLE: Person[] = [
  { id: 1, firstName: "Carolyn", lastName: "Maury", company: "Accelevate Solutions", title: "VP Sales", email: "c.maury@accelevate.io", emailStatus: "Verified", phone: "+1 415 555 0121", linkedin: "linkedin.com/in/carolynmaury", icpScore: 92, companyBrief: "B2B SaaS platform for sales acceleration and pipeline management", avatarColor: AVATAR_COLORS[0], companyColor: COMPANY_COLORS[0] },
  { id: 2, firstName: "Andrés", lastName: "Peña", company: "Valiot", title: "Head of Growth", email: "andres.p@valiot.io", emailStatus: "Verified", phone: null, linkedin: "linkedin.com/in/andrespena", icpScore: 87, companyBrief: "Industrial IoT analytics platform for manufacturing optimization", avatarColor: AVATAR_COLORS[1], companyColor: COMPANY_COLORS[1] },
  { id: 3, firstName: "Steve", lastName: "Douty", company: "LYT", title: "CRO", email: "sdouty@lyt.ai", emailStatus: "Verified", phone: "+1 628 555 0088", linkedin: "linkedin.com/in/stevedouty", icpScore: 94, companyBrief: "AI-powered traffic management and smart city infrastructure", avatarColor: AVATAR_COLORS[2], companyColor: COMPANY_COLORS[2] },
  { id: 4, firstName: "Dan", lastName: "Pimentel", company: "ESP Logistics", title: "VP Operations", email: null, emailStatus: "Unverified", phone: "+1 312 555 0049", linkedin: "linkedin.com/in/danpimentel", icpScore: 71, companyBrief: "Supply chain logistics and freight management solutions", avatarColor: AVATAR_COLORS[3], companyColor: COMPANY_COLORS[3] },
  { id: 5, firstName: "Justin", lastName: "Morrison", company: "CorePlan", title: "CEO", email: "j.morrison@coreplan.io", emailStatus: "Verified", phone: "+1 512 555 0177", linkedin: "linkedin.com/in/justinmorrison", icpScore: 88, companyBrief: "Mine planning software for resource and geological modeling", avatarColor: AVATAR_COLORS[4], companyColor: COMPANY_COLORS[4] },
  { id: 6, firstName: "Calvin", lastName: "Tran", company: "ATLAS Traffic", title: "Head of RevOps", email: "c.tran@atlas.ai", emailStatus: "Verified", phone: null, linkedin: "linkedin.com/in/calvintran", icpScore: 83, companyBrief: "AI-driven traffic data analytics and urban mobility intelligence", avatarColor: AVATAR_COLORS[5], companyColor: COMPANY_COLORS[5] },
  { id: 7, firstName: "Joe", lastName: "Blair", company: "Tradeaze", title: "Co-founder", email: "joe@tradeaze.com", emailStatus: "Verified", phone: "+44 20 7946 0091", linkedin: "linkedin.com/in/joeblair", icpScore: 79, companyBrief: "B2B marketplace for construction materials procurement", avatarColor: AVATAR_COLORS[6], companyColor: COMPANY_COLORS[6] },
  { id: 8, firstName: "Nikj", lastName: "Pesce", company: "Easyship", title: "VP Marketing", email: null, emailStatus: "Invalid", phone: "+65 9123 4567", linkedin: "linkedin.com/in/nikjpesce", icpScore: 68, companyBrief: "Global shipping platform for e-commerce logistics", avatarColor: AVATAR_COLORS[7], companyColor: COMPANY_COLORS[7] },
  { id: 9, firstName: "Charmaine", lastName: "Sevilla", company: "Jayride", title: "Growth Lead", email: "c.sevilla@jayride.com", emailStatus: "Verified", phone: "+61 2 9876 5432", linkedin: "linkedin.com/in/charmainesevilla", icpScore: 76, companyBrief: "Airport transfer and ride-share comparison marketplace", avatarColor: AVATAR_COLORS[8], companyColor: COMPANY_COLORS[8] },
  { id: 10, firstName: "Nick", lastName: "Dermatas", company: "JustPark", title: "Head of Sales", email: "n.dermatas@justpark.com", emailStatus: "Verified", phone: "+44 7700 900123", linkedin: "linkedin.com/in/nickdermatas", icpScore: 81, companyBrief: "Smart parking marketplace and space management platform", avatarColor: AVATAR_COLORS[9], companyColor: COMPANY_COLORS[9] },
  { id: 11, firstName: "Craig", lastName: "Rosenberg", company: "ProCredEx", title: "VP Sales", email: "craig.r@procredex.com", emailStatus: "Verified", phone: "+1 617 555 0034", linkedin: "linkedin.com/in/craigrosenberg", icpScore: 90, companyBrief: "Healthcare credential verification and exchange platform", avatarColor: AVATAR_COLORS[10], companyColor: COMPANY_COLORS[10] },
  { id: 12, firstName: "Lavan", lastName: "Jeyamuraly", company: "HONK", title: "CRO", email: "lavan@honkmobile.com", emailStatus: "Verified", phone: "+1 416 555 0067", linkedin: "linkedin.com/in/lavanjeyamuraly", icpScore: 86, companyBrief: "Mobile parking payments and digital parking solutions", avatarColor: AVATAR_COLORS[11], companyColor: COMPANY_COLORS[11] },
  { id: 13, firstName: "Lynzi", lastName: "Clark", company: "Aetos Imaging", title: "Head of Marketing", email: null, emailStatus: "Unverified", phone: null, linkedin: "linkedin.com/in/lynziclark", icpScore: 64, companyBrief: "Drone-based aerial imaging for infrastructure inspection", avatarColor: AVATAR_COLORS[12], companyColor: COMPANY_COLORS[12] },
  { id: 14, firstName: "Marta", lastName: "Wojcik", company: "Easyship", title: "RevOps Lead", email: "m.wojcik@easyship.com", emailStatus: "Verified", phone: "+48 22 555 0099", linkedin: "linkedin.com/in/martawojcik", icpScore: 72, companyBrief: "Global shipping platform for e-commerce logistics", avatarColor: AVATAR_COLORS[13], companyColor: COMPANY_COLORS[13] },
  { id: 15, firstName: "Mitchell", lastName: "S.", company: "NFWare", title: "VP Partnerships", email: "mitchell@nfware.com", emailStatus: "Verified", phone: "+1 347 555 0056", linkedin: "linkedin.com/in/mitchells", icpScore: 77, companyBrief: "Cloud-native network function virtualization platform", avatarColor: AVATAR_COLORS[14], companyColor: COMPANY_COLORS[14] },
  { id: 16, firstName: "Rudy", lastName: "Emmelot", company: "WorldPantry", title: "Head of Growth", email: "r.emmelot@worldpantry.com", emailStatus: "Verified", phone: "+31 20 555 0012", linkedin: "linkedin.com/in/rudyemmelot", icpScore: 84, companyBrief: "B2B specialty food and snack distribution marketplace", avatarColor: AVATAR_COLORS[15], companyColor: COMPANY_COLORS[15] },
];

interface ChatMsg {
  role: "user" | "ai";
  text: string;
  columnTag?: string;
}

interface SuggestionCard {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  prompt: string;
}

interface DynamicColumn {
  id: string;
  label: string;
  type: "enrichment" | "ai" | "company";
  data: Record<number, string>;
}

const SUGGESTIONS: SuggestionCard[] = [
  { icon: Sparkles, iconBg: "hsl(var(--purple-light))", iconColor: "hsl(var(--purple))", title: "Gather professional posts", description: "Enrich contacts with recent LinkedIn activity", prompt: "Gather recent LinkedIn posts for all contacts" },
  { icon: Sparkles, iconBg: "hsl(var(--purple-light))", iconColor: "hsl(var(--purple))", title: "Extract profile insights", description: "Distil key info from LinkedIn profiles into a summary", prompt: "Extract profile insights from LinkedIn for each contact" },
  { icon: Zap, iconBg: "hsl(var(--amber-light))", iconColor: "hsl(var(--amber))", title: "Analyse email fill rate", description: "See how many leads have verified emails and where gaps exist", prompt: "Analyse email fill rate across all rows" },
  { icon: Mail, iconBg: "hsl(var(--green-light))", iconColor: "hsl(var(--green))", title: "Find missing emails", description: "Waterfall enrich contacts missing verified email addresses", prompt: "Find missing emails for all contacts" },
  { icon: Building2, iconBg: "hsl(var(--indigo-light))", iconColor: "hsl(var(--indigo))", title: "Add company brief", description: "Auto-generate a 10-second company summary per contact", prompt: "Add company brief column for all rows" },
  { icon: Star, iconBg: "hsl(0,93%,94%)", iconColor: "hsl(var(--red))", title: "Score ICP fit", description: "Add AI-powered ICP fit score (0–100) based on your criteria", prompt: "Score ICP fit for all contacts" },
  { icon: PenLine, iconBg: "hsl(var(--purple-light))", iconColor: "hsl(var(--purple))", title: "Write personalised openers", description: "Generate ready-to-send cold email first lines", prompt: "Write personalised email openers for all contacts" },
];

/* Sample data generators per column type */
function generateColumnData(colId: string, people: Person[]): Record<number, string> {
  const data: Record<number, string> = {};
  people.forEach(p => {
    switch (colId) {
      case "find-work-email":
        data[p.id] = p.email || `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@${p.company.toLowerCase().replace(/\s/g, "")}.com`;
        break;
      case "verify-email":
        data[p.id] = p.emailStatus === "Verified" ? "✅ Valid" : p.emailStatus === "Invalid" ? "❌ Invalid" : "⚠️ Catch-all";
        break;
      case "find-phone":
        data[p.id] = p.phone || ["—", "+1 555 " + String(Math.floor(1000 + Math.random() * 9000))][Math.random() > 0.4 ? 1 : 0];
        break;
      case "linkedin-url":
        data[p.id] = p.linkedin;
        break;
      case "job-change":
        data[p.id] = ["No change", "Changed 2w ago", "No change", "New role 1mo ago", "No change"][p.id % 5];
        break;
      case "seniority":
        data[p.id] = /^(CEO|CRO|Co-founder)/.test(p.title) ? "C-Suite" : /^(VP|Head)/.test(p.title) ? "VP / Head" : /Director/.test(p.title) ? "Director" : "Manager";
        break;
      case "company-brief":
        data[p.id] = p.companyBrief;
        break;
      case "funding-stage":
        data[p.id] = ["Seed", "Series A", "Series B", "Series C", "Growth", "Pre-seed"][p.id % 6];
        break;
      case "employee-count":
        data[p.id] = String([45, 120, 85, 310, 60, 200, 25, 450, 90, 150, 75, 180, 35, 450, 95, 220][p.id - 1] || 100);
        break;
      case "tech-stack":
        data[p.id] = [
          "HubSpot, Salesforce, Drift", "Snowflake, dbt, Looker", "Outreach, Gong, ZoomInfo",
          "SAP, Oracle, Tableau", "HubSpot, Intercom, Stripe", "Segment, Amplitude, Mixpanel",
          "Salesforce, Marketo, 6sense", "Shopify, Klaviyo, Attentive"
        ][p.id % 8];
        break;
      case "company-signals":
        data[p.id] = ["🔥 Hiring surge +40%", "💰 Series B closed", "👤 New CRO hired", "📈 Revenue +60% YoY", "🏢 New office opened", "⚡ Product launch"][p.id % 6];
        break;
      case "industry":
        data[p.id] = ["B2B SaaS", "IoT / Manufacturing", "Smart Cities", "Logistics", "Mining Tech", "AdTech", "Marketplace", "E-commerce", "Travel Tech", "Proptech", "HealthTech", "Mobility", "Drone Tech", "E-commerce", "Telecom", "Food & Bev"][p.id - 1] || "SaaS";
        break;
      case "icp-score":
        data[p.id] = String(p.icpScore);
        break;
      case "personalised-opener":
        data[p.id] = `Hi ${p.firstName}, noticed ${p.company} is scaling — thought you'd find this relevant...`;
        break;
      case "linkedin-message":
        data[p.id] = `Hi ${p.firstName}, your work at ${p.company} caught my eye. Would love to connect.`;
        break;
      case "pain-points":
        data[p.id] = ["Manual data entry slowing pipeline", "Low email reply rates", "CRM data decay >30%", "No unified lead scoring", "High CAC on outbound", "Pipeline visibility gaps"][p.id % 6];
        break;
      case "research-summary":
        data[p.id] = `${p.firstName} ${p.lastName} is ${p.title} at ${p.company}. ${p.companyBrief}. ICP: ${p.icpScore}.`;
        break;
      case "custom-ai":
        data[p.id] = `[Custom] ${p.firstName} — awaiting prompt configuration`;
        break;
      case "full-lead":
        data[p.id] = `${p.email || "—"} | ${p.phone || "—"} | ICP ${p.icpScore}`;
        break;
      case "email-outreach":
        data[p.id] = `${p.emailStatus || "Unknown"} → Hi ${p.firstName}, saw ${p.company} is growing…`;
        break;
      case "account-research":
        data[p.id] = `${p.companyBrief} | Series A | 120 employees`;
        break;
      case "abm-ready":
        data[p.id] = `ICP ${p.icpScore} | ${p.title} at ${p.company}`;
        break;
      default:
        data[p.id] = "—";
    }
  });
  return data;
}

interface ColOption { id: string; icon: React.ElementType; color: string; bg: string; label: string; desc: string; type: "enrichment" | "ai" | "company"; credits: number; trending?: boolean; recommended?: boolean }

const COLUMN_OPTIONS: { section: string; items: ColOption[] }[] = [
  {
    section: "⭐ Recommended",
    items: [
      { id: "find-work-email", icon: Mail, color: "hsl(var(--green))", bg: "hsl(var(--green-light))", label: "Find work email", desc: "Waterfall lookup across 6 providers", type: "enrichment", credits: 3, trending: true, recommended: true },
      { id: "icp-score", icon: Star, color: "hsl(var(--red))", bg: "hsl(0,93%,94%)", label: "ICP fit score", desc: "Score 0–100 based on your ICP criteria", type: "ai", credits: 5, trending: true, recommended: true },
      { id: "personalised-opener", icon: PenLine, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "Personalised opener", desc: "AI-written cold email first line", type: "ai", credits: 4, trending: true, recommended: true },
      { id: "company-brief", icon: Building2, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "Company brief", desc: "AI-generated 10-second company summary", type: "company", credits: 2, recommended: true },
    ],
  },
  {
    section: "People enrichment",
    items: [
      { id: "find-work-email", icon: Mail, color: "hsl(var(--green))", bg: "hsl(var(--green-light))", label: "Find work email", desc: "Waterfall lookup across 6 providers", type: "enrichment", credits: 3, trending: true },
      { id: "verify-email", icon: Shield, color: "hsl(var(--green))", bg: "hsl(var(--green-light))", label: "Verify email", desc: "Check deliverability & catch-all status", type: "enrichment", credits: 1 },
      { id: "find-phone", icon: Phone, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "Find phone number", desc: "Direct dial & mobile lookup", type: "enrichment", credits: 5, trending: true },
      { id: "linkedin-url", icon: Globe, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "LinkedIn profile URL", desc: "Match contact to LinkedIn profile", type: "enrichment", credits: 1 },
      { id: "job-change", icon: Briefcase, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "Job change detection", desc: "Flag if contact changed roles recently", type: "enrichment", credits: 4, trending: true },
      { id: "seniority", icon: Users, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "Seniority level", desc: "Auto-detect C-suite, VP, Director, IC", type: "enrichment", credits: 1 },
    ],
  },
  {
    section: "Company enrichment",
    items: [
      { id: "company-brief", icon: Building2, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "Company brief", desc: "AI-generated 10-second company summary", type: "company", credits: 2 },
      { id: "funding-stage", icon: TrendingUp, color: "hsl(var(--orange))", bg: "hsl(var(--orange-light))", label: "Funding stage", desc: "Latest round, amount, and investors", type: "company", credits: 3, trending: true },
      { id: "employee-count", icon: Hash, color: "hsl(var(--teal))", bg: "hsl(var(--teal-light))", label: "Employee count", desc: "Current headcount + growth rate", type: "company", credits: 1 },
      { id: "tech-stack", icon: Globe, color: "hsl(var(--teal))", bg: "hsl(var(--teal-light))", label: "Tech stack", desc: "Detect CRM, MAP, and key technologies", type: "company", credits: 3 },
      { id: "company-signals", icon: Zap, color: "hsl(var(--orange))", bg: "hsl(var(--orange-light))", label: "Company signals", desc: "Hiring surge, funding, leadership changes", type: "company", credits: 4, trending: true },
      { id: "industry", icon: Award, color: "hsl(var(--amber))", bg: "hsl(var(--amber-light))", label: "Industry & vertical", desc: "Auto-classify company industry", type: "company", credits: 1 },
    ],
  },
  {
    section: "AI columns",
    items: [
      { id: "icp-score", icon: Star, color: "hsl(var(--red))", bg: "hsl(0,93%,94%)", label: "ICP fit score", desc: "Score 0–100 based on your ICP criteria", type: "ai", credits: 5, trending: true },
      { id: "personalised-opener", icon: PenLine, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "Personalised opener", desc: "AI-written cold email first line", type: "ai", credits: 4, trending: true },
      { id: "linkedin-message", icon: MessageSquare, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "LinkedIn message", desc: "Generate tailored connection request", type: "ai", credits: 4 },
      { id: "pain-points", icon: Target, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "Pain point analysis", desc: "Infer likely pain points from role & company", type: "ai", credits: 3 },
      { id: "research-summary", icon: FileText, color: "hsl(var(--teal))", bg: "hsl(var(--teal-light))", label: "Research summary", desc: "Full contact + company research brief", type: "ai", credits: 6 },
      { id: "custom-ai", icon: Sparkles, color: "hsl(var(--amber))", bg: "hsl(var(--amber-light))", label: "Custom AI prompt", desc: "Write your own prompt for any column", type: "ai", credits: 5 },
    ],
  },
  {
    section: "Templates",
    items: [
      { id: "full-lead", icon: Zap, color: "hsl(var(--orange))", bg: "hsl(var(--orange-light))", label: "Full lead enrichment", desc: "Email + phone + company + ICP score in one click", type: "enrichment", credits: 12, trending: true },
      { id: "email-outreach", icon: Mail, color: "hsl(var(--green))", bg: "hsl(var(--green-light))", label: "Email outreach prep", desc: "Verify email + opener + pain points", type: "enrichment", credits: 8 },
      { id: "account-research", icon: Building2, color: "hsl(var(--indigo))", bg: "hsl(var(--indigo-light))", label: "Account research pack", desc: "Company brief + funding + tech stack + signals", type: "company", credits: 10 },
      { id: "abm-ready", icon: Target, color: "hsl(var(--purple))", bg: "hsl(var(--purple-light))", label: "ABM ready columns", desc: "ICP score + research + personalised message", type: "ai", credits: 14 },
    ],
  },
];

/* ═══════════════════════════════════════════════════
   AI RESPONSE LOGIC
   ═══════════════════════════════════════════════════ */

function getAIResponse(input: string): ChatMsg {
  const l = input.toLowerCase();
  if (/email|fill|gap|missing/.test(l)) return { role: "ai", text: "I've analysed your table — 13 of 16 contacts have verified emails (81% fill rate). 2 are unverified and 1 is invalid. I'll run waterfall enrichment on the 3 missing contacts now.", columnTag: "Email status" };
  if (/icp|score|fit|qualify/.test(l)) return { role: "ai", text: "I've added an ICP Score column and scored all 16 contacts based on your ICP criteria. Scores range from 64 to 94, with 9 contacts scoring 80+. Top match: Steve Douty (94).", columnTag: "ICP score" };
  if (/opener|personali[sz]|cold|write/.test(l)) return { role: "ai", text: "I've generated personalised email openers for all 16 contacts based on their role, company, and recent activity. Each opener is tailored to their specific context.", columnTag: "Email opener" };
  if (/linkedin|post|profile|insight/.test(l)) return { role: "ai", text: "I've gathered recent LinkedIn activity for all contacts. 12 of 16 have public posts in the last 30 days. I've added a profile insights summary column.", columnTag: "LinkedIn insights" };
  if (/company|brief|research|account/.test(l)) return { role: "ai", text: "I've generated 10-second company briefs for all 16 contacts based on their company's website, funding, and market position.", columnTag: "Company brief" };
  if (/phone|mobile|number/.test(l)) return { role: "ai", text: "Running phone lookup waterfall across 6 providers. Found direct numbers for 11 of 16 contacts. 5 contacts have no available phone data.", columnTag: "Phone" };
  if (/enrich|all|run|start/.test(l)) return { role: "ai", text: "Starting full enrichment pipeline on all 16 rows. This includes email verification, phone lookup, LinkedIn insights, company briefs, and ICP scoring. Estimated time: ~45 seconds.", columnTag: "Full enrichment" };
  return { role: "ai", text: "I can help with that! Try asking me to find emails, score ICP fit, write personalised openers, gather LinkedIn posts, or add company briefs. What would you like to do?" };
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function EnrichmentPage() {
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<"Build" | "Analyse">("Build");
  const [showOpenerCol, setShowOpenerCol] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState(0);
  const [enrichingRow, setEnrichingRow] = useState(-1);
  const [activeTab, setActiveTab] = useState("Find people table");
  const [panelOpen, setPanelOpen] = useState(true);
  const [dynamicColumns, setDynamicColumns] = useState<DynamicColumn[]>([]);
  const [addColSearch, setAddColSearch] = useState("");
  const [addColOpen, setAddColOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const addDynamicColumn = useCallback((colId: string, label: string, type: "enrichment" | "ai" | "company") => {
    if (dynamicColumns.some(c => c.id === colId)) return;
    const data = generateColumnData(colId, PEOPLE);
    setDynamicColumns(prev => [...prev, { id: colId, label, type, data }]);
    setAddColOpen(false);
    setAddColSearch("");
  }, [dynamicColumns]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) return;
    const userMsg: ChatMsg = { role: "user", text };
    const aiMsg = getAIResponse(text);

    if (/opener|personali[sz]|cold|write/.test(text.toLowerCase())) {
      setShowOpenerCol(true);
    }

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate AI thinking
    setTimeout(() => {
      setChatMessages(prev => [...prev, aiMsg]);
      // Start enrichment animation
      runEnrichment();
    }, 600);
  }, [chatInput]);

  const runEnrichment = useCallback(() => {
    setIsRunning(true);
    setEnrichProgress(0);
    setEnrichingRow(0);
    let row = 0;
    const interval = setInterval(() => {
      row++;
      if (row >= PEOPLE.length) {
        clearInterval(interval);
        setIsRunning(false);
        setEnrichingRow(-1);
        setEnrichProgress(100);
      } else {
        setEnrichingRow(row);
        setEnrichProgress(Math.round((row / PEOPLE.length) * 100));
      }
    }, 280);
  }, []);

  const handleSuggestionClick = (prompt: string) => {
    setChatInput(prompt);
    // Auto-send
    const userMsg: ChatMsg = { role: "user", text: prompt };
    const aiMsg = getAIResponse(prompt);
    if (/opener|personali[sz]|cold|write/.test(prompt.toLowerCase())) setShowOpenerCol(true);
    setChatMessages(prev => [...prev, userMsg]);
    setTimeout(() => {
      setChatMessages(prev => [...prev, aiMsg]);
      runEnrichment();
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const emailStatusBadge = (status: string | null) => {
    if (!status) return null;
    const cls = status === "Verified"
      ? "bg-green-light text-green-text"
      : status === "Unverified"
        ? "bg-amber-light text-amber-text"
        : "bg-[hsl(0,93%,94%)] text-[hsl(0,72%,30%)]";
    return <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${cls}`}>{status}</span>;
  };

  const icpBadge = (score: number) => {
    const cls = score >= 85
      ? "bg-green-light text-green-text"
      : score >= 70
        ? "bg-amber-light text-amber-text"
        : "bg-[hsl(0,93%,94%)] text-[hsl(0,72%,30%)]";
    return <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${cls}`}>{score}</span>;
  };

  const TABS = ["Overview", "Find companies table", "Find people table"];

  return (
    <div className="flex flex-col h-full min-h-screen bg-card">
      {/* ── BREADCRUMB BAR ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-1.5 text-[12px]">
          <span className="text-muted-foreground hover:text-foreground cursor-pointer">All files</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground hover:text-foreground cursor-pointer">ICP</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="font-bold text-foreground">Enrichment Table</span>
          <span className="text-[9px] font-semibold text-indigo bg-indigo-light px-1.5 py-0.5 rounded ml-1.5">Beta</span>
        </div>
        <div className="flex items-center gap-2.5 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green" />
            <span className="text-muted-foreground">22,400 credits</span>
          </span>
          <div className="w-6 h-6 rounded-full bg-indigo flex items-center justify-center text-primary-foreground text-[10px] font-bold">G</div>
          <span className="font-medium text-foreground">Gautam Singh</span>
          <span className="text-muted-foreground">Outmate</span>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT AI CO-PILOT PANEL ── */}
        {panelOpen && (
          <div className="w-[300px] min-w-[300px] border-r border-border bg-card flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo to-purple flex items-center justify-center text-primary-foreground text-[11px]">✦</div>
                <span className="text-[13px] font-bold text-foreground">Outmate AI</span>
                <span className="text-[9px] font-semibold bg-amber-light text-amber-text px-1.5 py-0.5 rounded">Co-pilot</span>
              </div>
              <div className="flex items-center gap-0.5">
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Settings className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><List className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
                <button className="p-1.5 text-muted-foreground hover:text-foreground rounded"><Plus className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
                <button onClick={() => setPanelOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded"><X className="w-3.5 h-3.5" strokeWidth={2.5} /></button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "thin" }}>
              {chatMessages.length === 0 && (
                <>
                  {/* Intro */}
                  <p className="text-[12px] text-muted-foreground leading-[1.6]">
                    I'm your Outmate enrichment co-pilot. I can help you enrich leads, add AI columns, find emails, research accounts, or analyse your table.
                  </p>

                  {/* Tip banner */}
                  <div className="bg-indigo-light border border-indigo rounded-[7px] px-3 py-2.5 text-[11px] text-indigo flex items-start gap-2">
                    <span>💡</span>
                    <span>Right-click any AI column cell to add it to co-pilot context</span>
                  </div>

                  {/* Section label */}
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground pt-1">
                    What I can do for you
                  </div>

                  {/* Suggestion cards */}
                  <div className="space-y-2">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s.title}
                        onClick={() => handleSuggestionClick(s.prompt)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-left"
                      >
                        <div
                          className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center shrink-0"
                          style={{ backgroundColor: s.iconBg }}
                        >
                          <s.icon className="w-3.5 h-3.5" style={{ color: s.iconColor }} strokeWidth={2.5} />
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-foreground">{s.title}</div>
                          <div className="text-[11px] text-muted-foreground">{s.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Chat messages */}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "ai" && (
                    <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo to-purple flex items-center justify-center text-primary-foreground text-[8px] shrink-0 mt-1 mr-2">✦</div>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 text-[12px] leading-[1.6] ${
                    msg.role === "user"
                      ? "bg-indigo text-primary-foreground rounded-[8px_8px_2px_8px]"
                      : "bg-card border border-border rounded-[8px] text-foreground"
                  }`}>
                    {msg.text}
                    {msg.columnTag && msg.role === "ai" && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo bg-indigo-light px-2 py-1 rounded cursor-pointer hover:bg-indigo/10">
                          ✦ {msg.columnTag} column added <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Bottom input */}
            <div className="border-t border-border p-3 space-y-2">
              {/* Mode tabs */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
                {(["Build", "Analyse"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMode(m)}
                    className={`text-[10px] font-medium px-3 py-1 rounded-md transition-colors ${
                      activeMode === m ? "bg-indigo-light text-indigo" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {/* Input */}
              <div className="relative">
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask questions and add enrichments..."
                  rows={2}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-indigo focus:shadow-[0_0_0_2px_rgba(79,70,229,0.07)] transition-all"
                />
                <button
                  onClick={sendMessage}
                  className="absolute right-2 bottom-2 w-7 h-7 bg-indigo rounded-md flex items-center justify-center hover:opacity-90 transition-opacity"
                >
                  <ArrowUp className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── RIGHT TABLE AREA ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-card">
          {/* Table top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border">
            <div className="flex items-center gap-3">
              {!panelOpen && (
                <button onClick={() => setPanelOpen(true)} className="p-1.5 text-muted-foreground hover:text-foreground rounded border border-border mr-1">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              )}
              <button className="flex items-center gap-1.5 text-[10px] font-semibold text-green-text bg-green-light px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-green" />
                Auto-run
              </button>
              <span className="text-[10px] text-muted-foreground">29/31 rows</span>
              <span className="text-[10px] text-muted-foreground">37/37 cols</span>
              <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                <Filter className="w-3 h-3" strokeWidth={2.5} /> Filter
              </button>
              <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                <ArrowUpDown className="w-3 h-3" strokeWidth={2.5} /> Sort
              </button>
              <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                <Search className="w-3 h-3" strokeWidth={2.5} /> Search
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-[10px] text-indigo font-medium px-2 py-1 rounded">
                <History className="w-3 h-3 inline mr-1" strokeWidth={2.5} />History
              </button>
              <button className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
                <Download className="w-3 h-3 inline mr-1" strokeWidth={2.5} />Export
              </button>
              <button
                onClick={() => setEnrichModalOpen(true)}
                className="text-[10px] font-semibold text-primary-foreground bg-indigo px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Enrich selected
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-[3px] bg-muted">
            <div
              className="h-full bg-indigo transition-all duration-300 ease-out"
              style={{ width: `${enrichProgress}%` }}
            />
          </div>

          {/* Tab row */}
          <div className="flex items-center border-b border-border px-4">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`text-[11px] px-3 py-2.5 border-b-2 transition-colors ${
                  activeTab === t
                    ? "border-indigo text-indigo font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeTab === t && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo mr-1.5 align-middle" />}
                {t}
              </button>
            ))}
            <button className="text-[11px] text-muted-foreground px-3 py-2.5 border-b-2 border-transparent hover:text-foreground">
              <Plus className="w-3 h-3 inline" strokeWidth={2.5} />
            </button>
          </div>

          {/* Data table */}
          <div className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}>
            <table className="w-full border-collapse text-[10px]" style={{ minWidth: (showOpenerCol ? 1400 : 1200) + dynamicColumns.length * 160 }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {/* Standard columns */}
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground w-8">
                    <div className="w-3 h-3 rounded border border-border" />
                  </th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground w-8">#</th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground">Find people</th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground">Company</th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground">First name</th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground">Last name</th>
                  <th className="bg-background border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-muted-foreground">Title</th>
                  {/* Enrichment columns */}
                  <th className="bg-indigo-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-indigo">Work email</th>
                  <th className="bg-indigo-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-indigo">Email status</th>
                  <th className="bg-indigo-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-indigo">Phone</th>
                  <th className="bg-indigo-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-indigo">LinkedIn</th>
                  {/* AI columns */}
                  <th className="bg-green-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-green-text">ICP score</th>
                  <th className="bg-green-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-green-text min-w-[180px]">Company brief</th>
                  {showOpenerCol && (
                    <th className="bg-green-light border-b border-r border-border px-2 py-2 text-left font-semibold uppercase text-green-text min-w-[180px]">Email opener</th>
                  )}
                  {/* Dynamic columns */}
                  {dynamicColumns.map(col => (
                    <th
                      key={col.id}
                      className={`border-b border-r border-border px-2 py-2 text-left font-semibold uppercase min-w-[150px] ${
                        col.type === "ai" ? "bg-green-light text-green-text" :
                        col.type === "company" ? "bg-indigo-light text-indigo" :
                        "bg-indigo-light text-indigo"
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {/* Add column */}
                  <th className="bg-background border-b border-border px-2 py-2 text-left min-w-[160px]">
                    <Popover open={addColOpen} onOpenChange={setAddColOpen}>
                      <PopoverTrigger asChild>
                        <button className="text-[10px] text-muted-foreground border border-dashed border-border rounded px-2 py-1 hover:text-foreground hover:border-foreground/30 flex items-center gap-1">
                          <Plus className="w-3 h-3" strokeWidth={2.5} /> Add column
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-[280px] p-0 border border-border rounded-lg bg-card" sideOffset={4}>
                        <div className="px-3 pt-3 pb-2">
                          <div className="text-[11px] font-bold text-foreground mb-2">Add a column</div>
                          <div className="relative mb-2">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" strokeWidth={2.5} />
                            <input
                              value={addColSearch}
                              onChange={e => setAddColSearch(e.target.value)}
                              placeholder="Search columns..."
                              className="w-full pl-7 pr-3 py-1.5 text-[10px] rounded-md bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo"
                            />
                          </div>
                        </div>
                         <div className="max-h-[380px] overflow-y-auto pb-2" style={{ scrollbarWidth: "thin" }}>
                          {(() => {
                            const addedIds = new Set(dynamicColumns.map(dc => dc.id));
                            const shownIds = new Set<string>();
                            return COLUMN_OPTIONS.map(section => {
                              const filtered = section.items.filter(c => {
                                if (addedIds.has(c.id) || shownIds.has(c.id)) return false;
                                if (addColSearch && !c.label.toLowerCase().includes(addColSearch.toLowerCase()) && !c.desc.toLowerCase().includes(addColSearch.toLowerCase())) return false;
                                return true;
                              });
                              if (filtered.length === 0) return null;
                              filtered.forEach(c => shownIds.add(c.id));
                              return (
                                <div key={section.section}>
                                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground px-3 pt-2 pb-1">{section.section}</div>
                                  {filtered.map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => addDynamicColumn(c.id, c.label, c.type)}
                                      className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-muted/40 transition-colors text-left group/item"
                                    >
                                      <div className="w-6 h-6 rounded-[5px] flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: c.bg }}>
                                        <c.icon className="w-3 h-3" style={{ color: c.color }} strokeWidth={2.5} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-semibold text-foreground">{c.label}</span>
                                          {c.recommended && <Star className="w-3 h-3 text-amber-text fill-amber-text" strokeWidth={2} />}
                                          {c.trending && <span className="text-[8px] font-bold bg-[hsl(0,93%,94%)] text-[hsl(0,72%,50%)] px-1 py-[1px] rounded">🔥 Hot</span>}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground">{c.desc}</div>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0 gap-0.5 mt-0.5">
                                        <span className="text-[9px] font-semibold text-indigo bg-indigo-light px-1.5 py-[1px] rounded inline-flex items-center gap-[3px]"><Coins className="w-[10px] h-[10px]" strokeWidth={2.5} />{c.credits} cr</span>
                                        <span className="text-[8px] text-muted-foreground">/ row</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PEOPLE.map((p, idx) => {
                  const isEnriching = isRunning && enrichingRow === idx;
                  return (
                    <tr key={p.id} className="group hover:bg-muted/30 transition-colors">
                      {/* Checkbox */}
                      <td className="border-b border-r border-border px-2 py-2">
                        <div className="w-3 h-3 rounded border border-border" />
                      </td>
                      {/* Row number */}
                      <td className="border-b border-r border-border px-2 py-2 text-muted-foreground">{idx + 1}</td>
                      {/* Person */}
                      <td className="border-b border-r border-border px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-primary-foreground text-[9px] font-bold shrink-0"
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {p.firstName[0]}{p.lastName[0]}
                          </div>
                          <span className="font-bold text-foreground whitespace-nowrap">{p.firstName} {p.lastName}</span>
                        </div>
                      </td>
                      {/* Company */}
                      <td className="border-b border-r border-border px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center text-primary-foreground text-[7px] font-bold shrink-0"
                            style={{ backgroundColor: p.companyColor }}
                          >
                            {p.company[0]}
                          </div>
                          <span className="text-muted-foreground whitespace-nowrap">{p.company}</span>
                        </div>
                      </td>
                      {/* First / Last / Title */}
                      <td className="border-b border-r border-border px-2 py-2 text-muted-foreground">{p.firstName}</td>
                      <td className="border-b border-r border-border px-2 py-2 text-muted-foreground">{p.lastName}</td>
                      <td className="border-b border-r border-border px-2 py-2 text-muted-foreground whitespace-nowrap">{p.title}</td>
                      {/* Enrichment cells */}
                      <td className="border-b border-r border-border px-2 py-2 bg-[hsl(250,50%,98%)]">
                        {isEnriching ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-indigo animate-pulse" />enriching...</span>
                        ) : (
                          <span className="text-muted-foreground">{p.email || "—"}</span>
                        )}
                      </td>
                      <td className="border-b border-r border-border px-2 py-2 bg-[hsl(250,50%,98%)]">
                        {isEnriching ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-indigo animate-pulse" />enriching...</span>
                        ) : emailStatusBadge(p.emailStatus)}
                      </td>
                      <td className="border-b border-r border-border px-2 py-2 bg-[hsl(250,50%,98%)]">
                        {isEnriching ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-indigo animate-pulse" />enriching...</span>
                        ) : (
                          <span className="text-muted-foreground">{p.phone || "—"}</span>
                        )}
                      </td>
                      <td className="border-b border-r border-border px-2 py-2 bg-[hsl(250,50%,98%)]">
                        <span className="text-indigo cursor-pointer hover:underline flex items-center gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" /> View
                        </span>
                      </td>
                      {/* AI cells */}
                      <td className="border-b border-r border-border px-2 py-2 bg-green-light">
                        {isEnriching ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />enriching...</span>
                        ) : icpBadge(p.icpScore)}
                      </td>
                      <td className="border-b border-r border-border px-2 py-2 bg-green-light max-w-[180px]">
                        {isEnriching ? (
                          <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />enriching...</span>
                        ) : (
                          <span className="text-muted-foreground truncate block">{p.companyBrief}</span>
                        )}
                      </td>
                      {showOpenerCol && (
                        <td className="border-b border-r border-border px-2 py-2 bg-green-light max-w-[180px]">
                          {isEnriching ? (
                            <span className="flex items-center gap-1 text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />enriching...</span>
                          ) : (
                            <span className="text-muted-foreground truncate block">
                              {p.emailOpener || `Hi ${p.firstName}, noticed ${p.company} is scaling — thought you'd find this relevant...`}
                            </span>
                          )}
                        </td>
                      )}
                      {/* Dynamic columns */}
                      {dynamicColumns.map(col => (
                        <td
                          key={col.id}
                          className={`border-b border-r border-border px-2 py-2 max-w-[180px] ${
                            col.type === "ai" ? "bg-green-light" :
                            col.type === "company" ? "bg-[hsl(250,50%,98%)]" :
                            "bg-[hsl(250,50%,98%)]"
                          }`}
                        >
                          {isEnriching ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${col.type === "ai" ? "bg-green" : "bg-indigo"}`} />
                              enriching...
                            </span>
                          ) : (
                            <span className="text-muted-foreground truncate block">{col.data[p.id] || "—"}</span>
                          )}
                        </td>
                      ))}
                      <td className="border-b border-border px-2 py-2" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── STATUS BAR ── */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{enrichProgress}% complete</span>
              <span className="text-muted-foreground">{Math.round(enrichProgress / 100 * PEOPLE.length)} / {PEOPLE.length} rows enriched</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-muted-foreground hover:text-foreground px-2 py-1 rounded">
                <History className="w-3 h-3 inline mr-1" strokeWidth={2.5} />History
              </button>
              {isRunning && (
                <button
                  onClick={() => { setIsRunning(false); setEnrichingRow(-1); }}
                  className="text-[hsl(0,72%,50%)] font-medium px-2 py-1 rounded hover:bg-[hsl(0,93%,97%)]"
                >
                  Stop
                </button>
              )}
              <button className="text-muted-foreground hover:text-foreground p-1 rounded">
                <Settings className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <EnrichmentModal
        open={enrichModalOpen}
        onClose={() => setEnrichModalOpen(false)}
        selectedRows={PEOPLE.length}
      />
    </div>
  );
}
