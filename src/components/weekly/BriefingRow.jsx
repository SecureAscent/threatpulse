import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import SeverityBadge from "@/components/SeverityBadge";
import { ToggleBadge, InlineText } from "@/components/weekly/InlineEdit";
import RowTag, { TAG_CONFIG } from "@/components/weekly/RowTag";

const TOGGLE_STYLES = {
  yes: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  ticket: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  discuss: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  zero: "bg-red-500/15 text-red-400 border-red-500/30",
  off: "bg-muted text-muted-foreground/80 border-border",
};

const TH = "text-left px-3 py-2.5 font-medium whitespace-nowrap";
const TD = "px-3 py-2 align-top";

export default function BriefingRow({ threat, matchMap, updating, onToggle, onEdit }) {
  const matches = matchMap[threat.id] || [];
  const isUpdating = updating.has(threat.id);
  const tagConfig = TAG_CONFIG[threat.briefing_tag || ""] || TAG_CONFIG[""];
  const dateStr = threat.created_date
    ? new Date(threat.created_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

  return (
    <tr className={cn("border-t border-border hover:bg-accent/30 transition-colors", tagConfig.rowClass)}>
      <td className={`${TD} text-xs text-muted-foreground whitespace-nowrap sticky left-0 bg-card z-10`}>{dateStr}</td>
      <td className={TD}>
        <RowTag value={threat.briefing_tag} loading={isUpdating} onChange={(v) => onEdit(threat.id, "briefing_tag", v)} />
      </td>
      <td className={`${TD} text-xs whitespace-nowrap`}>
        {threat.source_url ? (
          <a href={threat.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {threat.source || "—"}
          </a>
        ) : (
          threat.source || "—"
        )}
      </td>
      <td className={`${TD} text-xs font-mono whitespace-nowrap`}>
        <Link to={`/threats/${threat.id}`} className="text-primary hover:underline">
          {threat.cve_id || "No CVE"}
        </Link>
      </td>
      <td className={`${TD} text-xs font-mono text-center`}>{threat.cvss_score ?? "—"}</td>
      <td className={TD}><SeverityBadge severity={threat.severity} /></td>
      <td className={`${TD} text-xs max-w-[400px]`}>
        <p className="font-semibold leading-snug line-clamp-1">{threat.title}</p>
        {threat.description && threat.description !== threat.title && (
          <p className="text-muted-foreground line-clamp-2 leading-snug mt-0.5">{threat.description}</p>
        )}
      </td>
      <td className={`${TD} text-xs max-w-[200px]`}>
        {matches.length > 0 ? (
          <div className="space-y-0.5">
            {matches.map((m, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="truncate">{m.product.name}</span>
                <span className="text-[9px] px-1 rounded bg-muted-foreground/15 text-foreground/80 shrink-0">{m.matchType}</span>
                {!m.isEnrolled && <span className="text-[9px] text-orange-500 shrink-0" title="Not in SBOM">⚠</span>}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">No match</span>
        )}
      </td>
      <td className={`${TD} text-center`}>
        <ToggleBadge active={threat.in_vrm} loading={isUpdating} onClick={() => onToggle(threat.id, "in_vrm", !threat.in_vrm)}
          activeClass={TOGGLE_STYLES.yes} inactiveClass={TOGGLE_STYLES.off} activeLabel="Yes" inactiveLabel="No" />
      </td>
      <td className={`${TD} min-w-[120px]`}>
        <InlineText value={threat.ticket_name} loading={isUpdating} onSave={(v) => onEdit(threat.id, "ticket_name", v)} />
      </td>
      <td className={`${TD} text-center`}>
        <ToggleBadge active={threat.ticket_created} loading={isUpdating} onClick={() => onToggle(threat.id, "ticket_created", !threat.ticket_created)}
          activeClass={TOGGLE_STYLES.ticket} inactiveClass={TOGGLE_STYLES.off} activeLabel="Yes" inactiveLabel="No" />
      </td>
      <td className={`${TD} text-center`}>
        <ToggleBadge active={threat.discuss_monday} loading={isUpdating} onClick={() => onToggle(threat.id, "discuss_monday", !threat.discuss_monday)}
          activeClass={TOGGLE_STYLES.discuss} inactiveClass={TOGGLE_STYLES.off} activeLabel="Discuss" inactiveLabel="—" />
      </td>
      <td className={`${TD} text-center`}>
        <ToggleBadge active={threat.zero_day} loading={isUpdating} onClick={() => onToggle(threat.id, "zero_day", !threat.zero_day)}
          activeClass={TOGGLE_STYLES.zero} inactiveClass={TOGGLE_STYLES.off} activeLabel="0-day" inactiveLabel="No" />
      </td>
      <td className={`${TD} min-w-[150px]`}>
        <InlineText value={threat.notes} loading={isUpdating} onSave={(v) => onEdit(threat.id, "notes", v)} />
      </td>
      <td className={`${TD} min-w-[150px]`}>
        <InlineText value={threat.followup_actions} loading={isUpdating} onSave={(v) => onEdit(threat.id, "followup_actions", v)} multiline />
      </td>
    </tr>
  );
}