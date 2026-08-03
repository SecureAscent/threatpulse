import React from "react";
import { Shield, Mail, Bell, Clock, AlertTriangle } from "lucide-react";

const policies = [
  { icon: AlertTriangle, title: "Critical Severity SLA", value: "Immediate", desc: "Critical threats trigger an instant email alert to all assigned analysts." },
  { icon: Clock, title: "High Severity SLA", value: "4 hours", desc: "High severity threats must be triaged within 4 hours of detection." },
  { icon: Clock, title: "Medium Severity SLA", value: "24 hours", desc: "Medium severity threats are reviewed within one business day." },
  { icon: Bell, title: "Daily Digest", value: "09:00 local", desc: "A consolidated daily briefing is emailed to all subscribed analysts." },
];

export default function Policy() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">SOC Policy</h1>
        <p className="text-sm text-muted-foreground">Built-in SOC playbook — triage workflows, escalation rules, and SLA targets.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {policies.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-sm font-semibold px-2.5 py-1 rounded-md bg-primary/10 text-primary">{p.value}</span>
              </div>
              <h3 className="font-semibold mb-1">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Escalation Rules</h3>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Critical threats unresolved after 1 hour escalate to the SOC lead.</li>
          <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" /> High threats unresolved after 8 hours require a status note from the assigned analyst.</li>
          <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Mitigated threats are reviewed in the weekly retrospective.</li>
          <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" /> Any threat affecting a production system is auto-prioritized to Critical.</li>
        </ul>
      </div>
    </div>
  );
}