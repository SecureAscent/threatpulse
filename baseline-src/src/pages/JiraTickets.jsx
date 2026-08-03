import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Ticket, Loader2, ExternalLink } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";

export default function JiraTickets() {
  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 100),
  });

  const candidates = threats.filter((t) => t.severity === "Critical" || t.severity === "High").slice(0, 12);

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <div className="mb-6 flex items-center gap-2">
        <Ticket className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jira Tickets</h1>
          <p className="text-sm text-muted-foreground">High-severity threats queued for ticketing</p>
        </div>
      </div>

      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 mb-6 flex items-start gap-3">
        <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Jira is not connected</p>
          <p className="text-xs text-muted-foreground mt-0.5">Connect Jira from the Integrations page to create tickets from threats automatically.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : candidates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><p>No high-severity threats to ticket.</p></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Threat</th>
                <th className="text-left px-4 py-2 font-medium">Severity</th>
                <th className="text-left px-4 py-2 font-medium">CVE</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-right px-4 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium line-clamp-1 max-w-[260px]">{t.title}</td>
                  <td className="px-4 py-2.5"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{t.cve_id || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{t.status}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <ExternalLink className="w-3 h-3" /> Pending
                    </span>
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