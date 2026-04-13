import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, Eye, Building2, Users, Sparkles,
  GitBranch, BookOpen, Share2,
  BarChart3, Plug, Settings, Menu, X,
  ChevronsLeft, ChevronsRight, ChevronDown, ChevronRight,
  Radio, DollarSign, UserPlus, Phone,
  ListTree, Bot, Target, Bell
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  children?: NavItem[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Website Visitors",
    items: [
      {
        label: "Website Visitors", path: "/visitor-id", icon: Eye, badge: "Live", badgeColor: "green",
        children: [
          { label: "Overview", path: "/visitor-id", icon: BarChart3 },
          { label: "Companies", path: "/visitor-id/companies", icon: Building2 },
          { label: "People", path: "/visitor-id/people", icon: Users },
          { label: "ICP Segments", path: "/visitor-id/segments", icon: Target },
          { label: "Alerts / Rules", path: "/visitor-id/alerts", icon: Bell },
        ],
      },
    ],
  },
  {
    label: "Copilot",
    items: [
      { label: "Copilot", path: "/copilot", icon: Sparkles, badge: "AI", badgeColor: "indigo" },
    ],
  },
  {
    label: "Database",
    items: [
      { label: "Companies", path: "/database/companies", icon: Building2 },
      { label: "People", path: "/database/people", icon: Users },
      { label: "Lists", path: "/database/lists", icon: ListTree },
    ],
  },
  {
    label: "Execution",
    items: [
      { label: "Workflows", path: "/workflows", icon: GitBranch },
      { label: "Social Agent", path: "/social-agent", icon: Share2, badge: "New", badgeColor: "indigo" },
      { label: "Voice AI Agent", path: "/voice", icon: Phone, badge: "AI", badgeColor: "indigo" },
      { label: "Intent Signals", path: "/database/signals", icon: Radio },
      { label: "Hiring Signals", path: "/database/enrichment", icon: UserPlus },
      { label: "Funding Signals", path: "/database/signals#funding", icon: DollarSign },
      { label: "Marketplace", path: "/marketplace", icon: Bot, badge: "52", badgeColor: "indigo" },
      { label: "Knowledge Base", path: "/knowledge", icon: BookOpen },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Analytics", path: "/analytics", icon: BarChart3 },
      { label: "Integrations", path: "/integrations", icon: Plug },
      { label: "Settings", path: "/settings", icon: Settings },
    ],
  },
];

export default function AppSidebar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar_collapsed") === "true");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({ "Website Visitors": true });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleItem = (label: string) => {
    setExpandedItems(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) =>
    location.pathname === path || (path === "/home" && location.pathname === "/");

  const renderItem = (item: NavItem, depth = 0) => {
    const active = isActive(item.path);
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.label] ?? false;

    const linkContent = (
      <div key={item.path}>
        <div className="flex items-center">
          <Link
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`group relative flex-1 flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
              collapsed ? "justify-center px-2 py-2" : `px-3 py-[7px] ${depth > 0 ? "pl-9" : ""}`
            } ${
              active
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {active && !collapsed && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
            )}
            <item.icon className={`w-[15px] h-[15px] shrink-0 ${active ? "text-primary" : ""}`} />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge && (
              <span
                className={`ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                  item.badgeColor === "green"
                    ? "bg-green-500/15 text-green-400"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
          {!collapsed && hasChildren && (
            <button
              onClick={() => toggleItem(item.label)}
              className="p-1 mr-1 rounded hover:bg-muted text-muted-foreground/50"
            >
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          )}
        </div>
        {!collapsed && hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );

    if (collapsed && !hasChildren) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const renderSection = (section: NavSection, index: number) => {
    const isCollapsedSection = collapsedSections[section.label] ?? false;

    return (
      <div key={section.label} className={index > 0 ? "mt-1" : ""}>
        {!collapsed ? (
          <button
            onClick={() => toggleSection(section.label)}
            className="w-full flex items-center justify-between px-3 py-1.5 group cursor-pointer"
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">
              {section.label}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-muted-foreground/40 transition-transform duration-200 ${
                isCollapsedSection ? "-rotate-90" : ""
              }`}
            />
          </button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center py-2">
                <span className="w-5 h-[1px] bg-border rounded" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {section.label}
            </TooltipContent>
          </Tooltip>
        )}
        {!isCollapsedSection && (
          <div className={`space-y-0.5 ${collapsed ? "px-1.5" : "px-2"}`}>
            {section.items.map(item => renderItem(item))}
          </div>
        )}
      </div>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card">
      <div className={`border-b border-border ${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5 px-1"}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            O
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">Outmate</div>
              <div className="text-[10px] text-muted-foreground/60">GTM Operating System</div>
            </div>
          )}
        </div>
        <div className={`mt-2 ${collapsed ? "px-0" : ""}`}>
          {renderItem({ label: "Home", path: "/home", icon: Home })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
        {sections.map(renderSection)}
      </div>

      <div className="border-t border-border p-3 space-y-2.5">
        {!collapsed && (
          <>
            <div className="px-1">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground/60 font-medium">Credits</span>
                <span className="font-medium text-muted-foreground">22.4k / 30k</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: "75%" }} />
              </div>
            </div>
            <button className="w-full py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">
              Upgrade plan
            </button>
          </>
        )}

        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center py-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-[11px] ml-2">Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-card rounded-lg border border-border"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-foreground/20" onClick={() => setMobileOpen(false)}>
          <div className="w-[240px] h-full bg-card border-r border-border" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMobileOpen(false)} className="absolute top-3 right-3 p-1">
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside
        className={`hidden md:flex flex-col h-screen border-r border-border bg-card sticky top-0 transition-all duration-200 ${
          collapsed ? "w-[60px] min-w-[60px]" : "w-[220px] min-w-[220px]"
        }`}
      >
        {sidebarContent}
      </aside>
    </TooltipProvider>
  );
}
