import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileSpreadsheet, Loader2, Users, Ticket, CheckSquare, Clock } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import { downloadCsv } from "@/lib/csvExport";

const sevOptions = ["All", "Critical", "High", "Medium", "Low"];
const ticketStatusOptions = ["All", "Open", "Closed"];

function MetricCard({ icon: Icon, label, value, sublabel, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
    </div>
  );
}

export default function MonthlyReport() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [analystFilter, setAnalystFilter] = useState("All Analysts");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("All");
  const [productFilter, setProductFilter] = useState("");

  const { startISO, endISO, monthLabel } = useMemo(() => {
    const [yr, mo] = month.split("-").map(Number);
    const start = new Date(yr, mo - 1, 1);
    const end = new Date(yr, mo, 1);
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      monthLabel: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    };
  }, [month]);

  const { data: productsPage } = useQuery({
    queryKey: ["monthly-report-products"],
    queryFn: () => base44.entities.Product.filter({}, { limit: 500 }),
  });
  const products = productsPage?.items || [];

  const ticketQuery = useMemo(() => {
    const q = { created_date: { $gte: startISO, $lt: endISO } };
    if (severityFilter !== "All") q.severity = severityFilter;
    if (ticketStatusFilter === "Open") q.status = { $ne: "Mitigated" };
    if (ticketStatusFilter === "Closed") q.status = "Mitigated";
    if (analystFilter !== "All Analysts") q.assigned_to = analystFilter;
    if (productFilter) q.affected_products = { $regex: productFilter, $options: "i" };
    return q;
  }, [startISO, endISO, severityFilter, ticketStatusFilter, analystFilter, productFilter]);

  const activityQuery = useMemo(() => {
    const q = { created_date: { $gte: startISO, $lt: endISO } };
    if (analystFilter !== "All Analysts") q.actor_name = analystFilter;
    return q;
  }, [startISO, endISO, analystFilter]);

  const { data: ticketsPage, isLoading: ticketsLoading } = useQuery({
    queryKey: ["monthly-report-tickets", ticketQuery],
    queryFn: () => base44.entities.Threat.filter(ticketQuery, { sort: "-created_date", limit: 500 }),
  });
  const tickets = ticketsPage?.items || [];

  const { data: activitiesPage, isLoading: activitiesLoading } = useQuery({
    queryKey: ["monthly-report-activities", activityQuery],
    queryFn: () => base44.entities.ThreatActivity.filter(activityQuery, { sort: "-created_date", limit: 500 }),
  });
  const activities = activitiesPage?.items || [];

  const analysts = useMemo(() => {
    const set = new Set();
    activities.forEach((a) => { if (a.actor_name) set.add(a.actor_name); });
    tickets.forEach((t) => { if (t.assigned_to) set.add(t.assigned_to); });
    return Array.from(set).sort();
  }, [activities, tickets]);

  const metrics = useMemo(() => {
    const openTickets = tickets.filter((t) => t.status !== "Mitigated");
    const closedTickets = tickets.filter((t) => t.status === "Mitigated" && t.closed_date);

    const resolutionTimes = closedTickets
      .map((t) => (new Date(t.closed_date) - new Date(t.created_date)) / (1000 * 60 * 60 * 24))
      .filter((d) => d >= 0);
    const avgResolution =
      resolutionTimes.length > 0
        ? (resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length).toFixed(1)
        : null;

    const byAnalyst = {};
    activities.forEach((a) => {
      const name = a.actor_name || "Unknown";
      if (!byAnalyst[name])
        byAnalyst[name] = { name, reviewed: 0, notes: 0, statusChanges: 0, investigations: 0, total: 0 };
      byAnalyst[name].total++;
      if (a.action === "reviewed") byAnalyst[name].reviewed++;
      if (a.action === "note") byAnalyst[name].notes++;
      if (a.action === "status_change") byAnalyst[name].statusChanges++;
      if (a.action === "investigation_step") byAnalyst[name].investigations++;
    });

    const bySeverity = {};
    ["Critical", "High", "Medium", "Low"].forEach((sev) => {
      bySeverity[sev] = { severity: sev, open: 0, closed: 0, total: 0 };
    });
    tickets.forEach((t) => {
      const sev = t.severity || "Medium";
      if (bySeverity[sev]) {
        bySeverity[sev].total++;
        if (t.status === "Mitigated") bySeverity[sev].closed++;
        else bySeverity[sev].open++;
      }
    });

    return {
      totalFindings: activities.length,
      openCount: openTickets.length,
      closedCount: closedTickets.length,
      avgResolution,
      analystRows: Object.values(byAnalyst).sort((a, b) => b.total - a.total),
      severityRows: Object.values(bySeverity),
    };
  }, [tickets, activities]);

  const exportCsv = () => {
    const headers = [
      "Title", "CVE", "Severity", "Status", "Assigned To",
      "Ticket Name", "Created", "Closed", "Resolution (days)",
    ];
    const rows = tickets.map((t) => [
      t.title || "",
      t.cve_id || "",
      t.severity || "",
      t.status || "",
      t.assigned_to || "",
      t.ticket_name || "",
      t.created_date ? new Date(t.created_date).toLocaleDateString() : "",
      t.closed_date ? new Date(t.closed_date).toLocaleDateString() : "",
      t.closed_date
        ? ((new Date(t.closed_date) - new Date(t.created_date)) / (1000 * 60 * 60 * 24)).toFixed(1)
        : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadCsv(`monthly-report-${month}.csv`, csv);
  };

  const loading = ticketsLoading || activitiesLoading;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Monthly Report</h1>
        <p className="text-sm text-muted-foreground">
          Analyst findings, Jira ticket activity, and resolution metrics — {monthLabel}
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 mb-6 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Product</label>
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[10rem] max-w-[14rem]"
          >
            <option value="">All Products</option>
            {products.filter((p) => p.name).map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Analyst</label>
          <select
            value={analystFilter}
            onChange={(e) => setAnalystFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[10rem]"
          >
            <option>All Analysts</option>
            {analysts.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {sevOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Ticket Status</label>
          <select
            value={ticketStatusFilter}
            onChange={(e) => setTicketStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ticketStatusOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <button
          onClick={exportCsv}
          disabled={tickets.length === 0}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Users}
              label="Analyst Findings"
              value={metrics.totalFindings}
              sublabel={`${metrics.analystRows.length} active analyst${metrics.analystRows.length !== 1 ? "s" : ""}`}
              color="bg-blue-500/10 text-blue-500"
            />
            <MetricCard
              icon={Ticket}
              label="Open Tickets"
              value={metrics.openCount}
              sublabel="Created this month, not yet mitigated"
              color="bg-orange-500/10 text-orange-500"
            />
            <MetricCard
              icon={CheckSquare}
              label="Closed Tickets"
              value={metrics.closedCount}
              sublabel="Mitigated this month"
              color="bg-emerald-500/10 text-emerald-500"
            />
            <MetricCard
              icon={Clock}
              label="Avg Resolution Time"
              value={metrics.avgResolution ? `${metrics.avgResolution}d` : "—"}
              sublabel={
                metrics.closedCount > 0
                  ? `Across ${metrics.closedCount} closed ticket${metrics.closedCount !== 1 ? "s" : ""}`
                  : "No closed tickets"
              }
              color="bg-purple-500/10 text-purple-500"
            />
          </div>

          {/* Analyst Findings */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Analyst Findings</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Analyst</th>
                    <th className="text-right px-4 py-3 font-semibold">Reviewed</th>
                    <th className="text-right px-4 py-3 font-semibold">Investigations</th>
                    <th className="text-right px-4 py-3 font-semibold">Notes</th>
                    <th className="text-right px-4 py-3 font-semibold">Status Changes</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metrics.analystRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        No analyst activity in {monthLabel}
                      </td>
                    </tr>
                  ) : (
                    metrics.analystRows.map((row) => (
                      <tr key={row.name} className="hover:bg-accent/40">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.reviewed}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.investigations}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.notes}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.statusChanges}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{row.total}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Severity Breakdown */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Ticket Severity Breakdown</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Severity</th>
                    <th className="text-right px-4 py-3 font-semibold">Open</th>
                    <th className="text-right px-4 py-3 font-semibold">Closed</th>
                    <th className="text-right px-4 py-3 font-semibold">Total</th>
                    <th className="text-left px-4 py-3 font-semibold w-1/3">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {metrics.severityRows.map((row) => {
                    const maxTotal = Math.max(...metrics.severityRows.map((r) => r.total), 1);
                    const pct = (row.total / maxTotal) * 100;
                    return (
                      <tr key={row.severity} className="hover:bg-accent/40">
                        <td className="px-4 py-3">
                          <SeverityBadge severity={row.severity} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.open}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.closed}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">{row.total}</td>
                        <td className="px-4 py-3">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ticket Details */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Ticket Details</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Threat</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">CVE</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Severity</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Assigned</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Ticket</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Created</th>
                    <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">Closed</th>
                    <th className="text-right px-4 py-3 font-semibold whitespace-nowrap">Resolution (d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-muted-foreground">
                        No tickets found for the selected filters
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => {
                      const resolutionDays = t.closed_date
                        ? ((new Date(t.closed_date) - new Date(t.created_date)) / (1000 * 60 * 60 * 24)).toFixed(1)
                        : null;
                      return (
                        <tr key={t.id} className="group hover:bg-accent/40">
                          <td className="px-4 py-3">
                            <Link to={`/threats/${t.id}`} className="font-medium group-hover:text-primary line-clamp-1">
                              {t.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {t.cve_id ? (
                              <span className="font-mono text-xs text-primary">{t.cve_id}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <SeverityBadge severity={t.severity} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {t.assigned_to || "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            {t.ticket_url ? (
                              <a
                                href={t.ticket_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline"
                              >
                                {t.ticket_name || "View"}
                              </a>
                            ) : (
                              t.ticket_name || "—"
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {t.created_date ? new Date(t.created_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                            {t.closed_date ? new Date(t.closed_date).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                            {resolutionDays ? (
                              <span className="font-medium">{resolutionDays}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}