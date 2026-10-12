import React from "react";
import { Ticket, AlertCircle, ShieldCheck, Flame } from "lucide-react";

const CARDS = [
  { key: "open", label: "Open Tickets", icon: Ticket, color: "text-blue-400", ring: "ring-blue-500/20" },
  { key: "critical", label: "Critical Open", icon: AlertCircle, color: "text-red-400", ring: "ring-red-500/20" },
  { key: "high", label: "High Open", icon: Flame, color: "text-orange-400", ring: "ring-orange-500/20" },
  { key: "mitigated", label: "Mitigated", icon: ShieldCheck, color: "text-emerald-400", ring: "ring-emerald-500/20" },
];

export default function TicketSummary({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {CARDS.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className={`rounded-xl border border-border bg-card p-4 ring-1 ${c.ring}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</span>
              <Icon className={`w-4 h-4 ${c.color}`} />
            </div>
            <div className={`text-2xl font-bold mt-1 ${c.color}`}>{stats[c.key] ?? 0}</div>
          </div>
        );
      })}
    </div>
  );
}