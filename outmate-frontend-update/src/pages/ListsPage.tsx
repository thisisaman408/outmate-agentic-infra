import { useState, useMemo } from "react";
import {
  Search, Plus, MoreHorizontal, Users, Building2, Filter,
  ChevronDown, Star, Trash2, Download, Upload, Edit2, Eye
} from "lucide-react";

interface ListItem {
  id: string;
  name: string;
  description: string;
  type: "companies" | "people" | "mixed";
  count: number;
  source: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  starred: boolean;
  status: "active" | "archived";
  tags: string[];
}

const listsData: ListItem[] = [
  { id: "l1", name: "Enterprise Target Accounts", description: "Series B+ SaaS companies with 200+ employees in US", type: "companies", count: 247, source: "Copilot AI", createdAt: "Mar 12, 2026", updatedAt: "2h ago", owner: "You", starred: true, status: "active", tags: ["ICP", "Enterprise"] },
  { id: "l2", name: "Hot Visitors — Last 7 Days", description: "Companies with ICP score ≥ 80 and pricing page visits", type: "companies", count: 47, source: "Website Visitors", createdAt: "Apr 1, 2026", updatedAt: "5m ago", owner: "System", starred: true, status: "active", tags: ["Auto-updated", "Hot"] },
  { id: "l3", name: "VP Sales Decision Makers", description: "VP/Director of Sales at target accounts", type: "people", count: 156, source: "Enrichment", createdAt: "Feb 28, 2026", updatedAt: "1d ago", owner: "You", starred: false, status: "active", tags: ["Outbound"] },
  { id: "l4", name: "Q2 Outbound Sequence", description: "Contacts enrolled in Q2 email campaign", type: "people", count: 423, source: "Workflow", createdAt: "Apr 3, 2026", updatedAt: "12h ago", owner: "You", starred: false, status: "active", tags: ["Sequence", "Q2"] },
  { id: "l5", name: "Recently Funded (Series A-C)", description: "Companies that raised funding in last 90 days", type: "companies", count: 89, source: "Signal: Funding", createdAt: "Mar 20, 2026", updatedAt: "6h ago", owner: "System", starred: true, status: "active", tags: ["Auto-updated", "Funding"] },
  { id: "l6", name: "Hiring Engineering Leads", description: "Companies hiring VP Eng, CTO, or Head of Engineering", type: "companies", count: 134, source: "Signal: Hiring", createdAt: "Mar 15, 2026", updatedAt: "3h ago", owner: "System", starred: false, status: "active", tags: ["Auto-updated", "Hiring"] },
  { id: "l7", name: "Warm Re-engagement", description: "Contacts who opened emails but didn't reply", type: "people", count: 312, source: "Workflow", createdAt: "Mar 25, 2026", updatedAt: "2d ago", owner: "You", starred: false, status: "active", tags: ["Re-engage"] },
  { id: "l8", name: "ABM Tier 1 Accounts", description: "Strategic accounts for personalized outreach", type: "mixed", count: 34, source: "Manual", createdAt: "Jan 10, 2026", updatedAt: "5d ago", owner: "You", starred: true, status: "active", tags: ["ABM", "Tier 1"] },
  { id: "l9", name: "Churned Customers Lookalikes", description: "Companies similar to churned accounts for prevention", type: "companies", count: 56, source: "Copilot AI", createdAt: "Feb 14, 2026", updatedAt: "1w ago", owner: "You", starred: false, status: "archived", tags: ["Churn"] },
];

const typeIcons: Record<string, React.ElementType> = { companies: Building2, people: Users, mixed: Users };
const typeLabels: Record<string, string> = { companies: "Companies", people: "People", mixed: "Mixed" };

export default function ListsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "companies" | "people" | "mixed">("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set(listsData.filter(l => l.starred).map(l => l.id)));

  const filteredLists = useMemo(() => {
    let lists = listsData;
    if (searchQuery) lists = lists.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.description.toLowerCase().includes(searchQuery.toLowerCase()));
    if (typeFilter !== "all") lists = lists.filter(l => l.type === typeFilter);
    if (starredOnly) lists = lists.filter(l => starredIds.has(l.id));
    return lists;
  }, [searchQuery, typeFilter, starredOnly, starredIds]);

  const toggleStar = (id: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const stats = {
    total: listsData.length,
    companies: listsData.filter(l => l.type === "companies").length,
    people: listsData.filter(l => l.type === "people").length,
    totalContacts: listsData.reduce((sum, l) => sum + l.count, 0),
  };

  return (
    <div className="flex flex-col h-full font-dm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">Lists</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {stats.total} lists · {stats.totalContacts.toLocaleString()} total contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New list
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Lists", value: stats.total, color: "text-foreground" },
            { label: "Company Lists", value: stats.companies, color: "text-primary" },
            { label: "People Lists", value: stats.people, color: "text-purple-500" },
            { label: "Total Contacts", value: stats.totalContacts.toLocaleString(), color: "text-foreground" },
          ].map((s, i) => (
            <div key={i} className="bg-secondary/50 border border-border rounded-xl p-4">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 pb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search lists..."
            className="w-full pl-9 pr-3 py-2 text-[12px] bg-secondary/50 rounded-lg border border-border outline-none placeholder:text-muted-foreground/50 focus:border-primary/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "companies", "people", "mixed"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                typeFilter === t
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              {t === "all" ? "All" : typeLabels[t]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setStarredOnly(!starredOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
            starredOnly
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
              : "text-muted-foreground hover:bg-muted border border-transparent"
          }`}
        >
          <Star className={`w-3 h-3 ${starredOnly ? "fill-amber-500" : ""}`} /> Starred
        </button>
      </div>

      {/* List table */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">List name</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Type</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20">Count</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-28">Source</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Updated</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20">Owner</th>
                <th className="px-4 py-2.5 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLists.map(list => {
                const TypeIcon = typeIcons[list.type];
                const isStarred = starredIds.has(list.id);
                return (
                  <tr key={list.id} className="border-b border-border hover:bg-muted/20 transition-colors group cursor-pointer">
                    <td className="px-4 py-3">
                      <button onClick={() => toggleStar(list.id)} className="text-muted-foreground hover:text-amber-500 transition-colors">
                        <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-500 text-amber-500" : ""}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-foreground">{list.name}</span>
                          {list.tags.map(tag => (
                            <span key={tag} className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/8 text-primary/70 border border-primary/10">{tag}</span>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md truncate">{list.description}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground">{typeLabels[list.type]}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[13px] font-semibold text-foreground">{list.count.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{list.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] text-muted-foreground">{list.updatedAt}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium text-foreground">{list.owner}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="View">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLists.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div className="text-muted-foreground">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No lists found</p>
                      <p className="text-[11px] mt-1">Try adjusting your filters or create a new list</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
