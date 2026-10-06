import React from "react";
import { Bug, PackageCheck, Flame, MessageSquare, Ticket } from "lucide-react";

export default function BriefingSummary({ stats }) {
  const items = [
    { icon: Bug, label: "Total CVEs", value: stats.total, color: "text-primary", bg: "bg-primary/10" },
    { icon: PackageCheck, label: "Matched Products", value: stats.matched, color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Flame, label: "Zero Days", value: stats.zeroDay, color: "text-red-500", bg: "bg-red-500/10" },
    { icon: MessageSquare, label: "Discuss Monday", value: stats.discuss, color: "text-orange-500", bg: "bg-orange-500/10" },
    { icon: Ticket, label: "Tickets Created", value: stats.ticketCreated, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${item.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}