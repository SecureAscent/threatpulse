import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Clock, CheckCircle2, Inbox, TrendingUp, Timer,
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import MetricCard from "@/components/MetricCard";

const sevOrder = ["Critical", "High", "Medium", "Low"];

const fmtDuration = (ms) => {
  if (!ms || !isFinite(ms)) return "—";
  const h = ms / 3600000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
};

export default function Metrics() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 300),
  });

  const openTickets = threats.filter((t) => t.status !== "Mitigated").length;

  const responded = threats.filter((t) => t.first_response_date);
  const avgResponseMs = responded.length
    ? responded.reduce((s, t) => s + (new Date(t.first_response_date) - new Date(t.created_date)), 0) / responded.length
    : 0;

  const closed = threats.filter((t) => t.closed_date);
  const avgClosureMs = closed.length
    ? closed.reduce((s, t) => s + (new Date(t.closed_date) - new Date(t.created_date)), 0) / closed.length
    : 0;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const created7d = threats.filter((t) => new Date(t.created_date) >= weekAgo).length;
  const closed7d = closed.filter((t) => new Date(t.closed_date) >= weekAgo).length;

  // 14-day creation vs closure trend
  const trendData = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toDateString();
    const createdCount = threats.filter((t) => new Date(t.created_date).toDateString() === key).length;
    const closedCount = threats.filter((t) => t.closed_date && new Date(t.closed_date).toDateString() === key).length;
    return {
      day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      created: createdCount,
      closed: closedCount,
    };
  });

  // Avg response time by severity
  const respBySev = sevOrder.map((s) => {
    const items = threats.filter((t) => t.severity === s && t.first_response_date);
    const avg = items.length
      ? items.reduce((sum, t) => sum + (new Date(t.first_response_date) - new Date(t.created_date)), 0) / items.length
      : 0;
    return { severity: s, hours: +(avg / 3600000).toFixed(1) };
  });

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">KPIs &amp; Custom Metrics</h1>
        <p className="text-sm text-muted-foreground">Response time, ticket creation &amp; closure performance</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard icon={Clock} label="Avg Response" value={fmtDuration(avgResponseMs)} sublabel={`${responded.length} responded`} color="bg-primary/10 text-primary" />
        <MetricCard icon={Timer} label="Avg Closure" value={fmtDuration(avgClosureMs)} sublabel={`${closed.length} closed`} color="bg-emerald-50 text-emerald-600" />
        <MetricCard icon={Inbox} label="Open Tickets" value={openTickets} sublabel="New + Analyzing" color="bg-orange-50 text-orange-600" />
        <MetricCard icon={TrendingUp} label="Created (7d)" value={created7d} sublabel="tickets opened" color="bg-blue-50 text-blue-600" />
        <MetricCard icon={CheckCircle2} label="Closed (7d)" value={closed7d} sublabel="tickets resolved" color="bg-green-50 text-green-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Created vs Closed trend */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Ticket Creation vs Closure (14d)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} className="text-xs" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="created" name="Created" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed" name="Closed" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
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

      {isLoading && threats.length === 0 && (
        <div className="mt-6 text-center text-sm text-muted-foreground">Loading metrics…</div>
      )}
    </div>
  );
}