import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Plus, Pencil, XCircle, Loader2 } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const TD = "px-4 py-2.5 align-top";

export default function TicketRow({ threat, actionLoading, onCreate, onEdit, onClose }) {
  const isLoading = actionLoading.has(threat.id);
  const hasTicket = !!(threat.ticket_url || threat.ticket_name);

  const daysOpen = threat.created_date
    ? Math.max(0, Math.floor((Date.now() - new Date(threat.created_date).getTime()) / 86400000))
    : null;

  return (
    <tr className="border-t border-border hover:bg-accent/30 transition-colors">
      <td className={`${TD} max-w-[220px]`}>
        {threat.ticket_url ? (
          <a
            href={threat.ticket_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline text-sm font-medium"
          >
            <span className="truncate">{threat.ticket_name || "Linked Ticket"}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : threat.ticket_name ? (
          <span className="text-sm text-muted-foreground truncate block">{threat.ticket_name}</span>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">No ticket</span>
        )}
      </td>
      <td className={`${TD} font-mono text-xs`}>
        <Link to={`/threats/${threat.id}`} className="text-primary hover:underline">
          {threat.cve_id || "No CVE"}
        </Link>
      </td>
      <td className={TD}><SeverityBadge severity={threat.severity} /></td>
      <td className={`${TD} max-w-[240px]`}>
        <Link to={`/threats/${threat.id}`} className="text-sm hover:underline line-clamp-1">
          {threat.title}
        </Link>
      </td>
      <td className={TD}><StatusBadge status={threat.status} /></td>
      <td className={`${TD} text-xs`}>{threat.assigned_to || "—"}</td>
      <td className={`${TD} text-xs text-muted-foreground`}>{daysOpen != null ? `${daysOpen}d` : "—"}</td>
      <td className={`${TD} min-w-[180px]`}>
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : hasTicket ? (
            <>
              <button
                onClick={() => onEdit(threat)}
                title="Edit ticket"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => onClose(threat)}
                title="Close ticket & mitigate"
                disabled={threat.status === "Mitigated"}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-border text-red-500/80 hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="w-3 h-3" /> Close
              </button>
            </>
          ) : (
            <button
              onClick={() => onCreate(threat.id)}
              title="Create Jira ticket"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3 h-3" /> Create
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}