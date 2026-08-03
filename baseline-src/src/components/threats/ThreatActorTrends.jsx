import React, { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { Activity, Globe2, Trophy } from "lucide-react";

const COUNTRY_COLORS = ["#0e93b8", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b"];

function parseCountry(tags) {
  if (!tags) return null;
  const parts = tags.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

function weekStart(d) {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  const mon = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day));
  return mon;
}

function fmtWeek(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function ThreatActorTrends({ actors }) {
  const { trend, origins, topGroups } = useMemo(() => {
    // Activity over time (last 12 weeks) — by first_seen fallback created_date
    const now = new Date();
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const ws = weekStart(new Date(now.getTime() - i * 7 * 86400000));
      weeks.push({ key: ws.toISOString().slice(0, 10), label: fmtWeek(ws.toISOString()), victims: 0, actors: 0 });
    }
    const idx = {};
    weeks.forEach((w, i) => { idx[w.key] = i; });

    const countryCount = {};
    const groupCount = {};

    actors.forEach((a) => {
      const dateStr = a.first_seen || a.created_date;
      if (dateStr) {
        const k = weekStart(dateStr).toISOString().slice(0, 10);
        if (idx[k] != null) {
          if (a.kind === "darkweb_mention") weeks[idx[k]].victims += 1;
          else if (a.kind === "threat_actor") weeks[idx[k]].actors += 1;
          else weeks[idx[k]].victims += 1;
        }
      }
      // Origins from victim records
      if (a.kind === "darkweb_mention" || a.threat_type === "ransomware_leak") {
        const c = parseCountry(a.tags);
        if (c) countryCount[c] = (countryCount[c] || 0) + 1;
        const g = a.name || a.reporter;
        if (g) groupCount[g] = (groupCount[g] || 0) + 1;
      }
    });

    const origins = Object.entries(countryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    const topGroups = Object.entries(groupCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));

    return { trend: weeks, origins, topGroups };
  }, [actors]);

  const maxOrigin = Math.max(1, ...origins.map((o) => o.value));

  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-6">
      {/* Trend over time */}
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Threat-actor activity — last 12 weeks</h3>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e93b8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#0e93b8" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area type="monotone" dataKey="victims" name="Victims / leaks" stroke="#0e93b8" strokeWidth={2} fill="url(#gV)" />
            <Area type="monotone" dataKey="actors" name="New actors" stroke="#6366f1" strokeWidth={2} fill="url(#gA)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top origins */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Top origins (victim countries)</h3>
        </div>
        {origins.length === 0 ? (
          <p className="text-xs text-muted-foreground py-8 text-center">No origin data yet — collect victim intel to populate.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={origins} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "hsl(var(--accent))" }}
              />
              <Bar dataKey="value" name="Victims" radius={[0, 4, 4, 0]}>
                {origins.map((_, i) => (
                  <Cell key={i} fill={COUNTRY_COLORS[i % COUNTRY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Most active threat actors */}
      <div className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Most active threat actors (by claimed victims)</h3>
        </div>
        {topGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No actor activity yet.</p>
        ) : (
          <div className="space-y-2">
            {topGroups.map((g, i) => (
              <div key={g.name} className="flex items-center gap-3">
                <span className="w-5 text-xs font-mono text-muted-foreground">{i + 1}</span>
                <span className="w-40 sm:w-56 truncate text-sm font-medium">{g.name}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(g.value / topGroups[0].value) * 100}%`, backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-mono text-muted-foreground">{g.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}