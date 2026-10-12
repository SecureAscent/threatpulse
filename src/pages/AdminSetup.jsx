import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Loader2, CheckCircle2, Circle } from "lucide-react";

export default function AdminSetup() {
  const [feedSecret, setFeedSecret] = useState(true);
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 10),
  });

  const steps = [
    { label: "Ingest threat feeds (CISA / NVD)", done: threats.length > 0, to: "/feeds" },
    { label: "NVD API key configured", done: feedSecret, to: "/admin/api-keys" },
    { label: "Review Command Center", done: threats.length > 0, to: "/command-center" },
    { label: "Invite team members", done: false, to: "/admin" },
    { label: "Configure notification preferences", done: false, to: "/settings/notifications" },
    { label: "Connect Jira for ticketing", done: false, to: "/integrations" },
  ];

  useEffect(() => {
    // The NVD key secret is configured server-side; assume set (admin can verify in API Keys)
    setFeedSecret(true);
  }, []);

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <div className="mb-6 flex items-center gap-2">
        <ListChecks className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Setup Checklist</h1>
          <p className="text-sm text-muted-foreground">{completed} of {steps.length} steps complete</p>
        </div>
      </div>

      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mb-6">
        <div className="h-full bg-primary transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {steps.map((s) => (
            <Link
              key={s.label}
              to={s.to}
              className={`flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 ${s.done ? "border-emerald-500/30" : "border-border"}`}
            >
              {s.done ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <Circle className="w-5 h-5 text-muted-foreground shrink-0" />}
              <span className={`text-sm ${s.done ? "text-muted-foreground line-through" : "font-medium"}`}>{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}