import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, Inbox, TrendingUp, Timer, Loader2, Download,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import TimeRangeFilter from "@/components/executive/TimeRangeFilter";
import { filterByRange, buildTrendData, fmtDuration, rangeLabel } from "@/lib/executiveData";
import { exportElementToPdf } from "@/lib/exportPdf";

const sevOrder = ["Critical", "High", "Medium", "Low"];

export default function Metrics() {
  const [rangeHours, setRangeHours] = useState(168);
  const [exporting, setExporting] = useState(false);
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const filtered = useMemo(() => filterByRange(threats, rangeHours), [threats, rangeHours]);

  const openTickets = filtered.filter((t) => t.status !== "Mitigated").length;

  const responded = filtered.filter((t) => t.first_response_date);
  const avgResponseMs = responded.length
    ? responded.reduce((s, t) => s + (new Date(t.first_response_date) - new Date(t.created_date)), 0) / responded.length
    : 0;

  const closed = filtered.filter((t) => t.closed_date);
  const avgClosureMs = closed.length
    ? closed.reduce((s, t) => s + (new Date(t.closed_date) - new Date(t.created_date)), 0) / closed.length
    : 0;

  const createdInRange = filtered.length;
  const closedInRange = closed.length;

  const trendData = useMemo(() => buildTrendData(filtered, rangeHours), [filtered, rangeHours]);

  const respBySev = sevOrder.map((s) => {
    const items = filtered.filter((t) => t.severity === s && t.first_response_date);
    const avg = items.length
      ? items.reduce((sum, t) => sum + (new Date(t.first_response_date) - new Date(t.created_date)), 0) / items.length
      : 0;
    return { severity: s, hours: +(avg / 3600000).toFixed(1) };
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportElementToPdf("metrics-report", `threatpulse-metrics-${rangeLabel(rangeHours).replace(/\s/g, "-").toLowerCase()}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KPIs &amp; Custom Metrics</h1>
          <p className="text-sm text-muted-foreground">Response time, ticket creation &amp; closure performance — {rangeLabel(rangeHours)}</p>
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

      <div id="metrics-report" className="space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard icon={Clock} label="Avg Response" value={fmtDuration(avgResponseMs)} sublabel={`${responded.length} responded`} color="bg-primary/10 text-primary" />
          <MetricCard icon={Timer} label="Avg Closure" value={fmtDuration(avgClosureMs)} sublabel={`${closed.length} closed`} color="bg-emerald-50 text-emerald-600" />
          <MetricCard icon={Inbox} label="Open Tickets" value={openTickets} sublabel="New + Analyzing" color="bg-orange-50 text-orange-600" />
          <MetricCard icon={TrendingUp} label={`Created (${rangeLabel(rangeHours)})`} value={createdInRange} sublabel="tickets opened" color="bg-blue-50 text-blue-600" />
          <MetricCard icon={CheckCircle2} label={`Closed (${rangeLabel(rangeHours)})`} value={closedInRange} sublabel="tickets resolved" color="bg-green-50 text-green-600" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Created vs Closed trend */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Ticket Creation vs Closure — {rangeLabel(rangeHours)}</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" interval="preserveStartEnd" minTickGap={20} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="created" name="Created" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                {rangeHours > 24 && (
                  <Line type="monotone" dataKey="mitigated" name="Closed" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg response time by severity */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Avg Response Time by Severity (hours)</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={respBySev}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="severity" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="hours" name="Hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {isLoading && threats.length === 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">Loading metrics…</div>
      )}
    </div>
  );
}