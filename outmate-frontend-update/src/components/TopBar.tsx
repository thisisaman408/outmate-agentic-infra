import { Link, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";

const navPills = [
  { label: "Home", path: "/home" },
  { label: "Agents", path: "/agents" },
  { label: "Database", path: "/database/companies" },
  { label: "Analytics", path: "/analytics" },
];

interface TopBarProps {
  extensionInstalled: boolean;
  onGetExtension: () => void;
}

export default function TopBar({ extensionInstalled, onGetExtension }: TopBarProps) {
  const location = useLocation();
  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div className="flex items-center h-11 px-5 border-b border-border bg-card flex-shrink-0">
      {/* Left: logo + separator + nav */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Link to="/home" className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-md bg-primary flex items-center justify-center text-primary-foreground text-[11px] font-medium">
            O
          </div>
          <span className="text-[13px] font-medium text-foreground">Outmate</span>
        </Link>

        <div className="w-px h-5 bg-border" />

        <div className="flex items-center gap-1">
          {navPills.map(pill => (
            <Link
              key={pill.path}
              to={pill.path}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                isActive(pill.path)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {pill.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Extension button */}
        {extensionInstalled ? (
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-green-light text-green-text border border-green/20"
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-green animate-pulse"
            />
            Extension active
          </button>
        ) : (
          <button
            onClick={onGetExtension}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <circle cx="24" cy="24" r="18" />
              <circle cx="24" cy="24" r="7" />
              <line x1="24" y1="6" x2="24" y2="17" />
              <line x1="8.4" y1="33" x2="17.5" y2="28" />
              <line x1="39.6" y1="33" x2="30.5" y2="28" />
            </svg>
            Get extension
          </button>
        )}

        {/* Credits pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-[10px] font-medium text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo" />
          22,400 credits
        </div>

        {/* Notifications */}
        <button className="relative p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
        </button>

        {/* Settings */}
        <Link
          to="/settings"
          className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-medium">
          GS
        </div>
      </div>
    </div>
  );
}
