import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import ForwardedIconComponent from "@/components/common/genericIconComponent";
import type { AgentDashboardProps } from "./registry";
import {
  parseTeamFinderOutput,
  type TeamFinderData,
} from "./parse-team-finder";

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-gradient-to-b from-muted/20 to-transparent px-4 py-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}
      >
        <ForwardedIconComponent name={icon} className="h-4 w-4" />
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  field: string;
  currentSort: string;
  currentDir: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const isActive = currentSort === field;
  return (
    <th
      className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <ForwardedIconComponent
            name={currentDir === "asc" ? "ChevronUp" : "ChevronDown"}
            className="h-3 w-3"
          />
        )}
      </div>
    </th>
  );
}

export default function TeamFinderDashboard({
  output,
  onDownloadCsv,
}: AgentDashboardProps) {
  const data: TeamFinderData = useMemo(
    () => parseTeamFinderOutput(output),
    [output],
  );

  const [sortField, setSortField] = useState("seniority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...data.employees];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      const aVal = (a as any)[sortField] ?? "";
      const bVal = (b as any)[sortField] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [data.employees, search, sortField, sortDir]);

  const { summary } = data;

  return (
    <div className="flex flex-col gap-5">
      {/* Company header */}
      <div className="flex items-center gap-2">
        <ForwardedIconComponent
          name="Building2"
          className="h-4 w-4 text-muted-foreground"
        />
        <span className="text-sm font-medium text-muted-foreground">
          {data.companyName}
        </span>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon="Users"
          label="Employees Found"
          value={summary.total}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon="Mail"
          label="With Email"
          value={summary.withEmail}
          color="bg-emerald-500/10 text-emerald-500"
        />
        <StatCard
          icon="Phone"
          label="With Phone"
          value={summary.withPhone}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          icon="Linkedin"
          label="With LinkedIn"
          value={summary.withLinkedIn}
          color="bg-[#0A66C2]/10 text-[#0A66C2]"
        />
      </div>

      {/* Seniority breakdown pills */}
      {Object.keys(summary.bySeniority).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.bySeniority).map(([level, count]) => (
            <span
              key={level}
              className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {level}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Search + Download bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <ForwardedIconComponent
            name="Search"
            className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full rounded-lg border border-border/60 bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        {data.csvRaw && onDownloadCsv && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onDownloadCsv(data.csvRaw)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:shadow-md transition-all"
          >
            <ForwardedIconComponent name="Download" className="h-3.5 w-3.5" />
            Download CSV
          </motion.button>
        )}
      </div>

      {/* Employee table */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/30">
                <SortHeader label="Name" field="name" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Title" field="title" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Email" field="email" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="LinkedIn" field="linkedin" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Location" field="location" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Source" field="source" currentSort={sortField} currentDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {filteredAndSorted.map((emp, i) => (
                <motion.tr
                  key={`${emp.name}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="hover:bg-muted/10 transition-colors"
                >
                  <td className="px-3 py-2.5 font-medium">{emp.name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {emp.title}
                  </td>
                  <td className="px-3 py-2.5">
                    {emp.email && emp.email !== '""' ? (
                      <a
                        href={`mailto:${emp.email}`}
                        className="text-primary/80 hover:text-primary underline underline-offset-2"
                      >
                        {emp.email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {emp.linkedin && emp.linkedin !== '""' ? (
                      <a
                        href={
                          emp.linkedin.startsWith("http")
                            ? emp.linkedin
                            : `https://${emp.linkedin}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A66C2] hover:underline"
                      >
                        <ForwardedIconComponent
                          name="Linkedin"
                          className="h-4 w-4"
                        />
                      </a>
                    ) : (
                      <span className="text-muted-foreground/40">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {emp.location || "\u2014"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                      {emp.source || "\u2014"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredAndSorted.length === 0 && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            {search ? "No employees match your search" : "No employees found"}
          </div>
        )}
      </div>
    </div>
  );
}
