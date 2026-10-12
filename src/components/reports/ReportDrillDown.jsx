import React from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

export default function ReportDrillDown({ open, onClose, title, threats }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          {threats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No threats found for this filter.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Threat</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">CVE</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Severity</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Affected Products</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Created</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">Closed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {threats.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link to={`/threats/${t.id}`} className="font-medium hover:text-primary line-clamp-1">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.cve_id ? (
                        <span className="font-mono text-xs text-primary">{t.cve_id}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <SeverityBadge severity={t.severity} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs">
                      {t.affected_products || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {t.created_date ? new Date(t.created_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {t.closed_date ? new Date(t.closed_date).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}