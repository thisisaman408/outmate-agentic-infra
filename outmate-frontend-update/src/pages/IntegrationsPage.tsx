import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Eye, EyeOff, Copy, ExternalLink } from "lucide-react";

type FilterType = "all" | "connected" | "gtm" | "ai";

interface Integration {
  id: string;
  name: string;
  icon: string;
  iconBg?: string;
  description: string;
  connected: boolean;
  badges: Array<"popular" | "new" | "gtm">;
  category: string;
  syncType?: string;
  records?: string;
  lastSync?: string;
  agents?: string[];
}

const integrations: Integration[] = [
  // CRM
  { id: "hubspot", name: "HubSpot", icon: "⊞", description: "Sync contacts, deals, companies, notes", connected: true, badges: ["popular", "gtm"], category: "CRM", syncType: "Bi-directional", records: "12,400", lastSync: "2 min ago", agents: ["AI SDR", "Intent Radar", "Prospect Brief"] },
  { id: "salesforce", name: "Salesforce", icon: "☁", description: "Enterprise CRM sync", connected: false, badges: ["popular", "gtm"], category: "CRM", agents: ["AI SDR", "Deal Closer"] },
  { id: "pipedrive", name: "Pipedrive", icon: "◈", description: "Pipeline sync and activity logging", connected: false, badges: ["gtm"], category: "CRM", agents: ["AI SDR"] },
  { id: "attio", name: "Attio", icon: "◉", description: "Modern CRM contact sync", connected: false, badges: ["new", "gtm"], category: "CRM", agents: ["Prospect Brief"] },
  // Outbound & email
  { id: "gmail", name: "Gmail", icon: "✉", description: "Send and receive emails", connected: true, badges: ["popular", "gtm"], category: "Outbound & email", syncType: "Push", records: "3,200", lastSync: "5 min ago", agents: ["AI SDR", "Reply Handler"] },
  { id: "linkedin", name: "LinkedIn", icon: "◈", description: "LinkedIn outreach and messaging", connected: false, badges: ["popular", "gtm"], category: "Outbound & email", agents: ["Personal Opener"] },
  { id: "smartlead", name: "Smartlead", icon: "⊛", description: "Multi-channel outbound campaigns", connected: false, badges: ["gtm"], category: "Outbound & email", agents: ["AI SDR"] },
  { id: "instantly", name: "Instantly", icon: "→", description: "Cold email at scale", connected: false, badges: ["gtm"], category: "Outbound & email", agents: ["AI SDR"] },
  { id: "lemlist", name: "Lemlist", icon: "⊜", description: "Personalized outbound sequences", connected: false, badges: ["gtm"], category: "Outbound & email", agents: ["AI SDR"] },
  { id: "unipile", name: "Unipile", icon: "◎", description: "Unified LinkedIn + email inbox", connected: false, badges: ["new", "gtm"], category: "Outbound & email", agents: ["Reply Handler"] },
  // Enrichment & data
  { id: "crustdata", name: "Crustdata", icon: "◉", description: "Company and people data enrichment", connected: true, badges: ["gtm"], category: "Enrichment & data", syncType: "On-demand", records: "8,100", lastSync: "1 hr ago", agents: ["Prospect Brief", "Intent Radar"] },
  { id: "explorium", name: "Explorium", icon: "⊙", description: "AI-powered data enrichment", connected: false, badges: ["gtm"], category: "Enrichment & data", agents: ["Prospect Brief"] },
  { id: "bettercontact", name: "BetterContact", icon: "⊟", description: "Waterfall contact finding", connected: false, badges: ["gtm"], category: "Enrichment & data", agents: ["AI SDR"] },
  { id: "clearbit", name: "Clearbit", icon: "◇", description: "Business intelligence data", connected: false, badges: ["gtm"], category: "Enrichment & data", agents: ["Prospect Brief"] },
  { id: "rb2b", name: "RB2B", icon: "⊛", description: "Website visitor ID", connected: false, badges: ["new", "gtm"], category: "Enrichment & data", agents: ["Intent Radar"] },
  { id: "clay", name: "Clay", icon: "⬡", description: "Enrichment waterfall", connected: false, badges: ["gtm"], category: "Enrichment & data", agents: ["Prospect Brief"] },
  // Signal sources
  { id: "g2", name: "G2", icon: "⭐", description: "Review intent signals", connected: false, badges: ["gtm"], category: "Signal sources", agents: ["Intent Radar"] },
  { id: "crunchbase", name: "Crunchbase", icon: "◉", description: "Funding and company signals", connected: false, badges: ["gtm"], category: "Signal sources", agents: ["Intent Radar"] },
  { id: "bombora", name: "Bombora", icon: "⊛", description: "Surge intent data", connected: false, badges: ["new", "gtm"], category: "Signal sources", agents: ["Intent Radar"] },
  { id: "builtwith", name: "BuiltWith", icon: "⊞", description: "Technology stack signals", connected: false, badges: ["gtm"], category: "Signal sources", agents: ["Intent Radar"] },
  // Messaging
  { id: "slack", name: "Slack", icon: "#", description: "Team notifications and alerts", connected: true, badges: ["popular"], category: "Messaging", syncType: "Push", records: "N/A", lastSync: "Just now", agents: ["AI SDR", "Intent Radar"] },
  { id: "whatsapp", name: "WhatsApp", icon: "⊟", description: "WhatsApp business messaging", connected: false, badges: ["new"], category: "Messaging", agents: ["Reply Handler"] },
  { id: "msteams", name: "MS Teams", icon: "⊞", description: "Microsoft Teams integration", connected: false, badges: [], category: "Messaging", agents: ["AI SDR"] },
  // AI models
  { id: "anthropic", name: "Claude / Anthropic", icon: "A", description: "Advanced reasoning and analysis", connected: true, badges: ["popular"], category: "AI models", syncType: "API", records: "N/A", lastSync: "Active", agents: ["All agents"] },
  { id: "openai", name: "OpenAI", icon: "◎", description: "GPT models for generation", connected: false, badges: ["popular"], category: "AI models", agents: ["All agents"] },
  { id: "gemini", name: "Google Gemini", icon: "✦", description: "Multimodal AI capabilities", connected: false, badges: [], category: "AI models", agents: ["All agents"] },
  { id: "perplexity", name: "Perplexity", icon: "⊙", description: "AI-powered web search", connected: false, badges: ["new"], category: "AI models", agents: ["Intent Radar"] },
  // Calendar & meetings
  { id: "calendly", name: "Calendly", icon: "◎", description: "Meeting scheduling automation", connected: false, badges: ["gtm"], category: "Calendar & meetings", agents: ["AI SDR"] },
  { id: "gcal", name: "Google Calendar", icon: "G", description: "Calendar sync and availability", connected: true, badges: [], category: "Calendar & meetings", syncType: "Bi-directional", records: "N/A", lastSync: "10 min ago", agents: ["AI SDR", "Pre-Call Briefing"] },
  { id: "hubspot-meetings", name: "HubSpot Meetings", icon: "⊞", description: "CRM-linked meeting booking", connected: false, badges: ["gtm"], category: "Calendar & meetings", agents: ["AI SDR"] },
];

const categories = ["CRM", "Outbound & email", "Enrichment & data", "Signal sources", "Messaging", "AI models", "Calendar & meetings"];

const apiKeyCards = [
  { id: "outmate-api", name: "Outmate API", icon: "✦", description: "Access the full platform programmatically", highlighted: true },
  { id: "custom-api", name: "Custom API keys", icon: "⊟", description: "Add your own third-party credentials", highlighted: false },
];

export default function IntegrationsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedId, setSelectedId] = useState<string>("outmate-api");
  const [showKey, setShowKey] = useState(false);

  const filtered = useMemo(() => {
    let items = integrations;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    if (filter === "connected") items = items.filter(i => i.connected);
    if (filter === "gtm") items = items.filter(i => i.badges.includes("gtm"));
    if (filter === "ai") items = items.filter(i => i.category === "AI models");
    return items;
  }, [search, filter]);

  const selected = selectedId === "outmate-api" || selectedId === "custom-api"
    ? apiKeyCards.find(c => c.id === selectedId)
    : integrations.find(i => i.id === selectedId);

  const isApiKey = selectedId === "outmate-api" || selectedId === "custom-api";
  const selectedIntegration = !isApiKey ? (selected as Integration | undefined) : undefined;

  const groupedByCategory = useMemo(() => {
    const map: Record<string, Integration[]> = {};
    categories.forEach(c => { map[c] = []; });
    filtered.forEach(i => {
      if (map[i.category]) map[i.category].push(i);
    });
    return map;
  }, [filtered]);

  const visibleCategories = filter === "ai" ? ["AI models"] : categories;

  return (
    <div className="flex h-screen w-full">
      {/* LEFT PANEL */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-border">
        {/* TOP BAR */}
        <div className="flex items-center gap-3 px-[18px] py-3 border-b border-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search integrations and APIs..."
              className="pl-9 h-9 bg-secondary border-secondary text-xs"
            />
          </div>
          <div className="flex gap-1.5">
            {([["all", "All"], ["connected", "Connected"], ["gtm", "GTM"], ["ai", "AI Models"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md border transition-colors ${
                  filter === key
                    ? "border-primary bg-secondary text-foreground"
                    : "border-transparent bg-transparent text-muted-foreground hover:bg-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <ScrollArea className="flex-1">
          <div className="px-[18px] py-4 space-y-5">
            {/* API KEYS */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">API keys</p>
              <div className="grid grid-cols-2 gap-2.5">
                {apiKeyCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedId(card.id)}
                    className={`flex items-start gap-3 p-3 rounded-md border text-left transition-colors ${
                      selectedId === card.id
                        ? "border-info bg-info/5"
                        : "border-secondary hover:border-muted-foreground/30 hover:bg-secondary"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-sm shrink-0 ${
                        card.highlighted ? "bg-[#4F46E5] text-white" : "bg-secondary border border-border"
                      }`}
                    >
                      {card.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{card.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{card.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* INTEGRATION CATEGORIES */}
            {visibleCategories.map(cat => {
              const items = groupedByCategory[cat] || [];
              const connectedCount = items.filter(i => i.connected).length;
              if (filter !== "all" && items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{cat}</p>
                    <p className="text-[10px] text-muted-foreground">{connectedCount}/{items.length} connected</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        className={`relative flex flex-col gap-2 p-3 rounded-md border text-left transition-colors ${
                          selectedId === item.id
                            ? "border-info bg-info/5"
                            : item.connected
                            ? "border-success/40 hover:bg-secondary"
                            : "border-border hover:border-muted-foreground/30 hover:bg-secondary"
                        }`}
                      >
                        {item.connected && (
                          <span className="absolute top-2 right-2 w-[7px] h-[7px] rounded-full bg-success" />
                        )}
                        <div className="flex items-center gap-2">
                          <span className="w-[30px] h-[30px] rounded-md bg-secondary border border-border flex items-center justify-center text-sm">
                            {item.icon}
                          </span>
                          <span className="text-[11px] font-medium text-foreground truncate">{item.name}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                        <div className="flex gap-1 flex-wrap">
                          {item.connected && <Badge className="bg-success/10 text-success border-0 text-[9px] px-1.5 py-0">Connected</Badge>}
                          {item.badges.includes("popular") && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Popular</Badge>}
                          {item.badges.includes("new") && <Badge className="bg-amber-light text-amber-text border-0 text-[9px] px-1.5 py-0">New</Badge>}
                          {item.badges.includes("gtm") && <Badge className="bg-info/10 text-info border-0 text-[9px] px-1.5 py-0">GTM</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* RIGHT DETAIL PANEL */}
      <div className="w-[320px] shrink-0 flex flex-col border-l border-border bg-background">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">Select an integration to view details</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
              <span
                className={`w-[38px] h-[38px] rounded-[9px] flex items-center justify-center text-sm shrink-0 ${
                  selectedId === "outmate-api" ? "bg-[#4F46E5] text-white" : "bg-secondary border border-border"
                }`}
              >
                {isApiKey ? (selected as typeof apiKeyCards[0]).icon : (selected as Integration).icon}
              </span>
              <span className="text-sm font-medium text-foreground flex-1">
                {isApiKey ? (selected as typeof apiKeyCards[0]).name : (selected as Integration).name}
              </span>
              <button onClick={() => setSelectedId("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {/* OUTMATE API detail */}
                {selectedId === "outmate-api" && (
                  <>
                    <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs h-9">
                      + Create new secret key
                    </Button>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-foreground">Production key</span>
                        <button className="text-[11px] text-info font-medium flex items-center gap-1 hover:underline">
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-secondary rounded-md px-3 py-2 border border-border">
                        <code className="text-[11px] font-mono text-foreground flex-1 truncate">
                          {showKey ? "sk-outmate-7f3a9b2c1d4e5f6g8h9iXZ9" : "sk-outmate-••••••••••••••XZ9"}
                        </code>
                        <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground">
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="bg-secondary rounded-md p-3 border border-border">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Keys are shown once at creation. Store securely. Never share.
                      </p>
                    </div>

                    <div className="space-y-0">
                      <p className="text-[11px] font-medium text-foreground mb-2">API details</p>
                      {[
                        ["Version", "v2.1"],
                        ["Requests / day", "10,000"],
                        ["Auth type", "Bearer token"],
                        ["Docs", "docs.outmate.ai"],
                      ].map(([k, v], i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <span className="text-[11px] text-muted-foreground">{k}</span>
                          <span className="text-[11px] font-medium text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-foreground mb-1">Quick links</p>
                      {["API documentation", "Webhook guide", "Rate limits", "Code examples"].map(link => (
                        <button key={link} className="flex items-center gap-1.5 text-[11px] text-info hover:underline w-full">
                          <ExternalLink className="h-3 w-3" /> {link} →
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* CUSTOM API detail */}
                {selectedId === "custom-api" && (
                  <>
                    <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs h-9">
                      + Add custom API key
                    </Button>
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-foreground">About</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Store and manage your own third-party API credentials securely. Keys are encrypted at rest and only accessible by your agents.
                      </p>
                    </div>
                    <div className="bg-secondary rounded-md p-3 border border-border">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        No custom keys configured yet. Add keys for services not available as native integrations.
                      </p>
                    </div>
                  </>
                )}

                {/* CONNECTED integration detail */}
                {selectedIntegration?.connected && (
                  <>
                    <Button variant="outline" className="w-full border-destructive text-destructive hover:bg-destructive/10 text-xs h-9">
                      Disconnect
                    </Button>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-foreground">About</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedIntegration.description}</p>
                    </div>

                    <div className="space-y-0">
                      <p className="text-[11px] font-medium text-foreground mb-2">Connection details</p>
                      {[
                        ["Status", <span key="s" className="text-success font-medium">Connected</span>],
                        ["Sync type", selectedIntegration.syncType || "—"],
                        ["Records", selectedIntegration.records || "—"],
                        ["Last sync", selectedIntegration.lastSync || "—"],
                      ].map(([k, v], i) => (
                        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                          <span className="text-[11px] text-muted-foreground">{k as string}</span>
                          <span className="text-[11px] font-medium text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>

                    {selectedIntegration.agents && selectedIntegration.agents.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-foreground">Used by {selectedIntegration.agents.length} agents</p>
                        <div className="space-y-1">
                          {selectedIntegration.agents.map(a => (
                            <div key={a} className="flex items-center gap-2 py-1">
                              <span className="w-[18px] h-[18px] rounded bg-secondary border border-border flex items-center justify-center text-[9px]">⊞</span>
                              <span className="text-[11px] text-foreground">{a}</span>
                              <span className="w-[6px] h-[6px] rounded-full bg-success ml-auto" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-foreground">Sync settings</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Auto-sync every 24 hours</span>
                        <Switch defaultChecked className="scale-75" />
                      </div>
                    </div>
                  </>
                )}

                {/* NOT CONNECTED integration detail */}
                {selectedIntegration && !selectedIntegration.connected && (
                  <>
                    <Button className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs h-9">
                      + Connect {selectedIntegration.name}
                    </Button>

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium text-foreground">About</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedIntegration.description}</p>
                    </div>

                    {selectedIntegration.agents && selectedIntegration.agents.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium text-foreground">Used by {selectedIntegration.agents.length} agents</p>
                        <div className="space-y-1">
                          {selectedIntegration.agents.map(a => (
                            <div key={a} className="flex items-center gap-2 py-1">
                              <span className="w-[18px] h-[18px] rounded bg-secondary border border-border flex items-center justify-center text-[9px]">⊞</span>
                              <span className="text-[11px] text-muted-foreground">{a}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button className="text-[11px] text-info hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Setup guide →
                    </button>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
