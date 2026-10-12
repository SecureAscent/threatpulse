import React, { useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2, ShieldAlert, CheckCircle2 } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";

function relTime(d) {
  if (!d) return "";
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Notifications() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 50),
  });

  const items = useMemo(() => threats.map((t) => {
    const isCritical = t.severity === "Critical";
    const mitigated = t.status === "Mitigated";
    return {
      id: t.id,
      icon: mitigated ? CheckCircle2 : ShieldAlert,
      color: mitigated ? "text-emerald-500" : isCritical ? "text-red-500" : "text-primary",
      title: mitigated ? `Mitigated: ${t.title}` : `${t.severity} threat: ${t.title}`,
      sub: `${t.source || "Unknown"} ${t.cve_id ? "· " + t.cve_id : ""}`,
      time: relTime(t.closed_date || t.first_response_date || t.created_date),
      severity: t.severity,
    };
  }), [threats]);

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <Bell className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Recent threat activity and status changes</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><p>No notifications yet.</p></div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const Icon = n.icon;
            return (
              <div key={n.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${n.color}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.sub}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SeverityBadge severity={n.severity} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{n.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}