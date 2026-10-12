import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Shield, Bug, Package, Clock, CheckCircle2, AlertTriangle, Download, Loader2,
} from "lucide-react";
import TimeRangeFilter from "@/components/executive/TimeRangeFilter";
import {
  filterByRange, computeKPIs, severityDistribution, buildTrendData,
  topCves, fmtDuration, rangeLabel,
} from "@/lib/executiveData";
import { mapThreatsToProducts, riskTier } from "@/lib/productThreatMap";
import { Link, useNavigate } from "react-router-dom";
import { exportElementToPdf } from "@/lib/exportPdf";
import SeverityBadge from "@/components/SeverityBadge";

const SEV_COLORS = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
};

const KPI_CARD = "rounded-xl border border-border bg-card p-5";

function KpiTile({ icon: Icon, label, value, sublabel, color, to }) {
  return (
    <Link to={to} className={`${KPI_CARD} block transition-all hover:ring-2 hover:ring-primary/20 hover:border-primary/30 hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </Link>
  );
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [rangeHours, setRangeHours] = useState(168);
  const [exporting, setExporting] = useState(false);

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "exec"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const { data: portfolio = [] } = useQuery({
    queryKey: ["products", "exec"],
    queryFn: () => base44.entities.Product.list(),
  });

  const filtered = useMemo(() => filterByRange(threats, rangeHours), [threats, rangeHours]);
  const kpis = useMemo(() => computeKPIs(filtered), [filtered]);
  const sevData = useMemo(() => severityDistribution(filtered), [filtered]);
  const trendData = useMemo(() => buildTrendData(filtered, rangeHours), [filtered, rangeHours]);
  const cves = useMemo(() => topCves(filtered, 10), [filtered]);
  const productMap = useMemo(() => mapThreatsToProducts(filtered, portfolio), [filtered, portfolio]);
  const impactedPortfolio = productMap.filter((p) => p.asset).slice(0, 10);
  const maxProductCount = impactedPortfolio[0]?.count || 1;
  const portfolioHitRate = portfolio.length
    ? Math.round((impactedPortfolio.length / portfolio.length) * 100)
    : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportElementToPdf("exec-dashboard", `threatpulse-brief-${rangeLabel(rangeHours).replace(/\s/g, "-").toLowerCase()}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Threat landscape overview — {rangeLabel(rangeHours)} · Generated {new Date().toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TimeRangeFilter value={rangeHours} onChange={setRangeHours} />
          <button
            onClick={handleExport}
            disabled={exporting || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div id="exec-dashboard" className="space-y-6">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiTile to="/threats" icon={Shield} label="Total Threats" value={kpis.total} sublabel={`${kpis.open} open`} color="bg-primary/10 text-primary" />
            <KpiTile to="/active-incidents" icon={AlertTriangle} label="Critical + High" value={kpis.criticalHigh} sublabel={`${kpis.critical} critical`} color="bg-red-500/10 text-red-500" />
            <KpiTile to="/cve-database" icon={Bug} label="Unique CVEs" value={kpis.uniqueCves} sublabel="tracked" color="bg-purple-500/10 text-purple-500" />
            <KpiTile to="/blast-radius" icon={Package} label="Impacted Products" value={impactedPortfolio.length} sublabel={`${portfolioHitRate}% of ${portfolio.length} tracked`} color="bg-blue-500/10 text-blue-500" />
            <KpiTile to="/metrics" icon={Clock} label="Avg Response" value={fmtDuration(kpis.avgResponseMs)} sublabel="time to first response" color="bg-orange-500/10 text-orange-500" />
            <KpiTile to="/actioned-threats" icon={CheckCircle2} label="Mitigation Rate" value={`${kpis.mitigationRate}%`} sublabel={`${kpis.mitigated} mitigated`} color="bg-emerald-500/10 text-emerald-500" />
          </div>

          {/* Charts Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Severity Distribution */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Threats by Severity</h3>
              {sevData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">No data in this range</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={sevData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      label={(e) => `${e.name}: ${e.value}`}
                      onClick={(entry) => navigate("/active-incidents")}
                      className="cursor-pointer"
                    >
                      {sevData.map((entry) => (
                        <Cell key={entry.name} fill={SEV_COLORS[entry.name] || "#888"} className="transition-opacity hover:opacity-80" />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Trend Chart */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-semibold mb-4">Threat Trend — {rangeLabel(rangeHours)}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} onClick={() => navigate("/threats")}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" interval="preserveStartEnd" minTickGap={20} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="created" name="New Threats" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} className="cursor-pointer" />
                  {rangeHours > 24 && (
                    <Line type="monotone" dataKey="mitigated" name="Mitigated" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} className="cursor-pointer" />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top CVEs */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">Top Priority CVEs</h3>
              </div>
              {cves.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No CVEs in this range</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-medium">CVE ID</th>
                        <th className="text-left px-5 py-2.5 font-medium">Severity</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden sm:table-cell">CVSS</th>
                        <th className="text-left px-5 py-2.5 font-medium hidden md:table-cell">EPSS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cves.map((c) => (
                        <tr key={c.id} className="border-t border-border hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => navigate(`/threats/${c.id}`)}>
                          <td className="px-5 py-2.5 font-mono text-xs font-medium">{c.cve_id}</td>
                          <td className="px-5 py-2.5"><SeverityBadge severity={c.severity} /></td>
                          <td className="px-5 py-2.5 font-mono text-xs hidden sm:table-cell">{c.cvss_score ?? "—"}</td>
                          <td className="px-5 py-2.5 font-mono text-xs hidden md:table-cell">{c.epss_score ? `${(c.epss_score * 100).toFixed(1)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Impacted Products (from SBOM / Product portfolio) */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">Impacted Products</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Matched against Product portfolio &amp; SBOM</p>
              </div>
              {impactedPortfolio.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {portfolio.length === 0
                    ? "No products in portfolio — add SBOM entries in Product Portfolio"
                    : "No portfolio products impacted in this range"}
                </p>
              ) : (
                <div className="p-4 space-y-2.5">
                  {impactedPortfolio.map((p) => {
                    const tier = riskTier(p);
                    const tierColor = tier === "critical" ? "bg-red-500/70" : tier === "high" ? "bg-orange-500/70" : "bg-primary/60";
                    return (
                      <Link
                        key={p.name}
                        to={`/blast-radius?product=${encodeURIComponent(p.asset.name)}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-accent/60 transition-colors cursor-pointer"
                      >
                        <div className="w-40 flex-shrink-0">
                          <p className="text-sm font-medium truncate">{p.asset.name}</p>
                          {p.asset.vendor && <p className="text-xs text-muted-foreground truncate">{p.asset.vendor}</p>}
                        </div>
                        <div className="flex-1 h-6 rounded-md bg-muted/40 overflow-hidden">
                          <div
                            className={`h-full rounded-md ${tierColor}`}
                            style={{ width: `${(p.count / maxProductCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{p.count}</span>
                        {p.activeCritical > 0 && <span className="text-xs text-red-500 font-medium">{p.activeCritical} crit</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            ThreatPulse Intelligence · Confidential · {new Date().toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}