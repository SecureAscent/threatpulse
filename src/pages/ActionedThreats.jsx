import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckSquare } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ${min % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

export default function ActionedThreats() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const actioned = useMemo(
    () =>
      threats
        .filter((t) => t.status === "Mitigated" || t.first_response_date)
        .map((t) => ({
          ...t,
          responseMs: t.first_response_date
            ? new Date(t.first_response_date).getTime() - new Date(t.created_date).getTime()
            : null,
        })),
    [threats]
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Actioned Threats</h1>
        <p className="text-sm text-muted-foreground">
          Threats that have been triaged or mitigated ({actioned.length})
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border last:border-0 bg-muted animate-pulse" />
          ))}
        </div>
      ) : actioned.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No threats have been actioned yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Severity</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Response Time</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Closed</th>
              </tr>
            </thead>
            <tbody>
              {actioned.map((t) => (
                <tr key={t.id} className="border-t border-border hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium max-w-xs line-clamp-1">{t.title}</td>
                  <td className="px-4 py-3"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-xs hidden md:table-cell">{formatDuration(t.responseMs)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {t.closed_date ? new Date(t.closed_date).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}