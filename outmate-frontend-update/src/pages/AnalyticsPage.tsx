import React, { useState } from "react";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { format } from "date-fns";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Filler);

/* ─── HELPERS ─── */
const ff = "'Inter', sans-serif";
const dateLabels = ["Feb 14", "Feb 17", "Feb 20", "Feb 23", "Feb 26", "Mar 1", "Mar 4", "Mar 7", "Mar 10", "Mar 13", "Mar 15"];

const chartCard = (style?: React.CSSProperties): React.CSSProperties => ({
  backgroundColor: "hsl(var(--card))", border: "0.5px solid hsl(var(--border-tertiary))",
  borderRadius: "var(--radius)", padding: 16, ...style,
});

const TabSwitcher = ({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) => (
  <div style={{ display: "flex", gap: 2, backgroundColor: "hsl(var(--secondary))", borderRadius: 6, padding: 2 }}>
    {tabs.map(t => (
      <button key={t} onClick={() => onChange(t)} style={{
        fontSize: 10, fontWeight: 500, fontFamily: ff, padding: "3px 10px", borderRadius: 4, border: "none", cursor: "pointer",
        backgroundColor: active === t ? "hsl(var(--card))" : "transparent",
        color: active === t ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
        boxShadow: active === t ? "0 1px 2px rgba(0,0,0,.06)" : "none",
      }}>{t}</button>
    ))}
  </div>
);

const Legend = ({ items }: { items: { color: string; label: string; value?: string }[] }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
    {items.map(i => (
      <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontFamily: ff, color: "hsl(var(--muted-foreground))" }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: i.color, flexShrink: 0 }} />
        <span>{i.label}</span>
        {i.value && <span style={{ fontWeight: 500, color: "hsl(var(--foreground))" }}>{i.value}</span>}
      </div>
    ))}
  </div>
);

/* ─── CHART DEFAULTS ─── */
const gridColor = "#F3F4F6";
const tickColor = "#9CA3AF";
const commonScales = (maxTicks = 6) => ({
  x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10, family: ff }, maxTicksLimit: maxTicks } },
  y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 10, family: ff } }, border: { display: false } },
});
const commonOpts = (h?: number) => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { titleFont: { size: 11, family: ff }, bodyFont: { size: 11, family: ff } } } });

/* ─── AGENT TABLE DATA ─── */
const agents = [
  { name: "AI SDR", icon: "⊛", runs: 541, rate: 94, dur: "4.2s", credits: 18420, signals: 0, trend: "+150%", up: true },
  { name: "Intent Radar", icon: "◎", runs: 312, rate: 98, dur: "2.1s", credits: 9840, signals: 312, trend: "+117%", up: true },
  { name: "Prospect Brief", icon: "◉", runs: 421, rate: 96, dur: "3.8s", credits: 8320, signals: 0, trend: "+94%", up: true },
  { name: "Reply Handler", icon: "⊟", runs: 198, rate: 92, dur: "1.4s", credits: 6210, signals: 0, trend: "+125%", up: true },
  { name: "Personal Opener", icon: "✦", runs: 276, rate: 97, dur: "2.9s", credits: 5840, signals: 0, trend: "+120%", up: true },
  { name: "CRM Auto-Fill", icon: "⊞", runs: 167, rate: 99, dur: "1.1s", credits: 3970, signals: 0, trend: "+140%", up: true },
];
const maxCredits = Math.max(...agents.map(a => a.credits));

/* ─── MAIN ─── */
const AnalyticsPage = () => {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: new Date(2025, 1, 14), to: new Date(2025, 2, 15) });
  const [lineTab, setLineTab] = useState("30d");
  const [barTab, setBarTab] = useState("Weekly");

  return (
    <div style={{ fontFamily: ff, backgroundColor: "hsl(var(--background))", minHeight: "100%" }}>
      {/* TOP BAR */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid hsl(var(--border))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 16, fontWeight: 500, color: "hsl(var(--foreground))" }}>Analytics</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2" style={{ fontSize: 11, fontFamily: ff }}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateRange.from, "MMM d")} – {format(dateRange.to, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(r: any) => { if (r?.from && r?.to) setDateRange({ from: r.from, to: r.to }); }}
                className={cn("p-3 pointer-events-auto")}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Select defaultValue="all">
            <SelectTrigger style={{ fontSize: 11, fontFamily: ff, width: 130, height: 32 }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              <SelectItem value="sdr">AI SDR</SelectItem>
              <SelectItem value="radar">Intent Radar</SelectItem>
              <SelectItem value="brief">Prospect Brief</SelectItem>
              <SelectItem value="reply">Reply Handler</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: ff }}
            onClick={() => toast({ title: "Exporting", description: "Analytics report will be downloaded as CSV." })}>Export</Button>
        </div>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {/* METRIC CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
          {[
            { label: "Agent runs", value: "3,104", trend: "+18%", up: true },
            { label: "Signals detected", value: "847", trend: "+24%", up: true },
            { label: "Emails sent", value: "12,400", trend: "+11%", up: true },
            { label: "Meetings booked", value: "174", trend: "+31%", up: true },
            { label: "Credits used", value: "52,600", trend: "of 75K · resets in 12d", neutral: true },
          ].map(m => (
            <div key={m.label} style={{ padding: "14px 16px", borderRadius: "calc(var(--radius) - 2px)", backgroundColor: "hsl(var(--secondary))" }}>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 2 }}>{m.value}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: (m as any).neutral ? "hsl(var(--muted-foreground))" : m.up ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>{m.trend}</div>
            </div>
          ))}
        </div>

        {/* CHART ROW 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
          {/* LINE CHART */}
          <div style={chartCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>Agent runs over time</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Daily breakdown by agent</div>
              </div>
              <TabSwitcher tabs={["30d", "90d"]} active={lineTab} onChange={setLineTab} />
            </div>
            <div style={{ height: 180 }}>
              <Line
                data={{
                  labels: dateLabels,
                  datasets: [
                    { label: "AI SDR", data: [38, 42, 35, 48, 52, 44, 56, 50, 62, 58, 55], borderColor: "#4F46E5", tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
                    { label: "Intent Radar", data: [22, 25, 20, 28, 30, 26, 32, 28, 35, 33, 31], borderColor: "#06B6D4", tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
                    { label: "Prospect Brief", data: [30, 34, 28, 38, 40, 36, 42, 38, 46, 44, 41], borderColor: "#10B981", tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
                    { label: "Reply Handler", data: [14, 16, 12, 18, 20, 17, 22, 19, 24, 22, 20], borderColor: "#F59E0B", tension: 0.4, pointRadius: 0, borderWidth: 1.5 },
                  ],
                }}
                options={{ ...commonOpts(), scales: commonScales() }}
              />
            </div>
            <Legend items={[
              { color: "#4F46E5", label: "AI SDR" }, { color: "#06B6D4", label: "Intent Radar" },
              { color: "#10B981", label: "Prospect Brief" }, { color: "#F59E0B", label: "Reply Handler" },
            ]} />
          </div>

          {/* DOUGHNUT: RUNS BY AGENT */}
          <div style={chartCard()}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 4 }}>Runs by agent</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>Total distribution</div>
            <div style={{ height: 148 }}>
              <Doughnut
                data={{
                  labels: ["AI SDR", "Intent Radar", "Prospect Brief", "Reply Handler", "Other"],
                  datasets: [{ data: [541, 312, 421, 198, 632], backgroundColor: ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6"], borderWidth: 0, hoverOffset: 4 }],
                }}
                options={{ ...commonOpts(), cutout: "68%" }}
              />
            </div>
            <Legend items={[
              { color: "#4F46E5", label: "AI SDR", value: "541" }, { color: "#06B6D4", label: "Intent Radar", value: "312" },
              { color: "#10B981", label: "Prospect Brief", value: "421" }, { color: "#F59E0B", label: "Reply Handler", value: "198" },
              { color: "#8B5CF6", label: "Other", value: "632" },
            ]} />
          </div>
        </div>

        {/* CHART ROW 2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          {/* BAR: PIPELINE */}
          <div style={chartCard()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>Pipeline metrics</div>
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Emails → Replies → Meetings</div>
              </div>
              <TabSwitcher tabs={["Weekly", "Daily"]} active={barTab} onChange={setBarTab} />
            </div>
            <div style={{ height: 160 }}>
              <Bar
                data={{
                  labels: ["W1", "W2", "W3", "W4"],
                  datasets: [
                    { label: "Emails sent", data: [2800, 3100, 3200, 3300], backgroundColor: "#E5E7EB", borderRadius: 3, borderWidth: 0 },
                    { label: "Replies", data: [280, 320, 350, 390], backgroundColor: "#4F46E5", borderRadius: 3, borderWidth: 0 },
                    { label: "Meetings", data: [38, 42, 46, 48], backgroundColor: "#10B981", borderRadius: 3, borderWidth: 0 },
                  ],
                }}
                options={{ ...commonOpts(), scales: commonScales(4) }}
              />
            </div>
            <Legend items={[
              { color: "#E5E7EB", label: "Emails sent" }, { color: "#4F46E5", label: "Replies" }, { color: "#10B981", label: "Meetings" },
            ]} />
          </div>

          {/* DOUGHNUT: REPLY INTENT */}
          <div style={chartCard()}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 4 }}>Reply intent breakdown</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>Classification of replies</div>
            <div style={{ height: 160 }}>
              <Doughnut
                data={{
                  labels: ["Interested", "Not now", "Unsubscribe", "Referral", "Other"],
                  datasets: [{ data: [34, 28, 18, 12, 8], backgroundColor: ["#10B981", "#F59E0B", "#6B7280", "#4F46E5", "#E5E7EB"], borderWidth: 0, hoverOffset: 4 }],
                }}
                options={{ ...commonOpts(), cutout: "65%" }}
              />
            </div>
            <Legend items={[
              { color: "#10B981", label: "Interested", value: "34%" }, { color: "#F59E0B", label: "Not now", value: "28%" },
              { color: "#6B7280", label: "Unsubscribe", value: "18%" }, { color: "#4F46E5", label: "Referral", value: "12%" },
              { color: "#E5E7EB", label: "Other", value: "8%" },
            ]} />
          </div>
        </div>

        {/* AGENT PERFORMANCE TABLE */}
        <div style={{ ...chartCard(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>Agent performance breakdown</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>All agents · Last 30 days</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: ff }}
                onClick={() => toast({ title: "Exporting", description: "Agent performance data exporting..." })}>Export</Button>
              <Button variant="ghost" size="sm" style={{ fontSize: 11, fontFamily: ff, color: "#4F46E5" }}>View details ↗</Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {["Agent", "Runs", "Success rate", "Avg duration", "Credits used", "Signals fired", "Trend", "Status"].map(h => (
                  <TableHead key={h} style={{ fontSize: 10, fontWeight: 500, fontFamily: ff, color: "hsl(var(--muted-foreground))" }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map(a => (
                <TableRow key={a.name} className="hover:bg-secondary/60" style={{ cursor: "default" }}>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 5, backgroundColor: "hsl(var(--secondary))", border: "1px solid hsl(var(--border-tertiary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{a.icon}</div>
                      <span style={{ fontSize: 11, fontWeight: 500, fontFamily: ff }}>{a.name}</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ fontSize: 11, fontFamily: ff }}>{a.runs.toLocaleString()}</TableCell>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: "hsl(var(--secondary))", overflow: "hidden" }}>
                        <div style={{ width: `${a.rate}%`, height: "100%", borderRadius: 2, backgroundColor: "hsl(var(--success))" }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: ff }}>{a.rate}%</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ fontSize: 11, fontFamily: ff, color: "hsl(var(--muted-foreground))" }}>{a.dur}</TableCell>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: "hsl(var(--secondary))", overflow: "hidden" }}>
                        <div style={{ width: `${(a.credits / maxCredits) * 100}%`, height: "100%", borderRadius: 2, backgroundColor: "#4F46E5" }} />
                      </div>
                      <span style={{ fontSize: 11, fontFamily: ff }}>{a.credits.toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ fontSize: 11, fontFamily: ff, color: a.signals > 0 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>
                    {a.signals > 0 ? a.signals.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell style={{ fontSize: 10, fontWeight: 500, fontFamily: ff, color: a.up ? "hsl(var(--success))" : "hsl(var(--destructive))" }}>{a.trend}</TableCell>
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "hsl(var(--success))" }} />
                      <span style={{ fontSize: 10, fontFamily: ff, color: "hsl(var(--muted-foreground))" }}>Active</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* CHART ROW 3 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* STACKED BAR: SIGNAL STRENGTH */}
          <div style={chartCard()}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 4 }}>Signal strength distribution</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>By intensity over time</div>
            <div style={{ height: 160 }}>
              <Bar
                data={{
                  labels: dateLabels,
                  datasets: [
                    { label: "High", data: [12, 15, 10, 18, 20, 16, 22, 19, 25, 23, 21], backgroundColor: "#EF4444", borderRadius: 3, borderWidth: 0 },
                    { label: "Medium", data: [28, 30, 24, 32, 35, 30, 38, 34, 40, 38, 36], backgroundColor: "#F59E0B", borderRadius: 3, borderWidth: 0 },
                    { label: "Low", data: [18, 20, 16, 22, 24, 20, 26, 22, 28, 26, 24], backgroundColor: "#E5E7EB", borderRadius: 3, borderWidth: 0 },
                  ],
                }}
                options={{ ...commonOpts(), scales: { ...commonScales(6), x: { ...commonScales(6).x, stacked: true }, y: { ...commonScales(6).y, stacked: true } } }}
              />
            </div>
            <Legend items={[
              { color: "#EF4444", label: "High" }, { color: "#F59E0B", label: "Medium" }, { color: "#E5E7EB", label: "Low" },
            ]} />
          </div>

          {/* DOUGHNUT: CREDITS BY CATEGORY */}
          <div style={chartCard()}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))", marginBottom: 4 }}>Credits used by category</div>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>Spend distribution</div>
            <div style={{ height: 160 }}>
              <Doughnut
                data={{
                  labels: ["Outbound", "Enrichment", "Research", "Signals", "Other"],
                  datasets: [{ data: [35, 27, 18, 12, 8], backgroundColor: ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#8B5CF6"], borderWidth: 0, hoverOffset: 4 }],
                }}
                options={{ ...commonOpts(), cutout: "65%" }}
              />
            </div>
            <Legend items={[
              { color: "#4F46E5", label: "Outbound", value: "35%" }, { color: "#06B6D4", label: "Enrichment", value: "27%" },
              { color: "#10B981", label: "Research", value: "18%" }, { color: "#F59E0B", label: "Signals", value: "12%" },
              { color: "#8B5CF6", label: "Other", value: "8%" },
            ]} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
