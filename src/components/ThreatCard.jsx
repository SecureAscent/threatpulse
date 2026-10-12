import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Search, ChevronRight } from "lucide-react";
import SeverityBadge from "./SeverityBadge";
import StatusBadge from "./StatusBadge";

export default function ThreatCard({ threat, onStatusChange, compact = false }) {
  const googleQuery = threat.cve_id
    ? `https://www.google.com/search?q=${encodeURIComponent(threat.cve_id + " " + threat.title)}`
    : `https://www.google.com/search?q=${encodeURIComponent(threat.title)}`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={threat.severity} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{threat.type}</span>
          {threat.cve_id && (
            <span className="text-xs font-mono text-muted-foreground">{threat.cve_id}</span>
          )}
          {threat.cvss_score != null && (
            <span className="text-xs font-mono text-muted-foreground">CVSS {threat.cvss_score}</span>
          )}
        </div>
        <StatusBadge status={threat.status} />
      </div>

      <h3 className="mt-3 text-base font-semibold text-foreground leading-snug">{threat.title}</h3>
      {!compact && (
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-3">{threat.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">{threat.source}</span>
        <div className="flex items-center gap-2">
          <a
            href={googleQuery}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Search className="w-3.5 h-3.5" />
            Investigate
          </a>
          {threat.source_url && (
            <a
              href={threat.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Source
            </a>
          )}
          {onStatusChange && (
            <button
              onClick={() => onStatusChange(threat)}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}