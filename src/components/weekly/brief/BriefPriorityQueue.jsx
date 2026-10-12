import React from "react";

const STATUS_STYLES = {
  "ZERO-DAY ACTIVE": "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "CISA KEV": "bg-amber-400/15 text-amber-400 border-amber-400/30",
  CRITICAL: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  HIGH: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const SEVERITY_DOT = {
  Critical: "bg-rose-500",
  High: "bg-amber-400",
  Medium: "bg-yellow-400",
  Low: "bg-slate-400",
};

export default function BriefPriorityQueue({ vulns }) {
  if (!vulns.length) {
    return <div className="bg-[#132941] px-4 py-6 text-center text-sm text-slate-400">No critical vulnerabilities in this period.</div>;
  }
  return (
    <div className="divide-y divide-[#1c3350] bg-[#132941]">
      {vulns.map((v, i) => (
        <div key={i} className="flex items-stretch gap-4 px-4 py-3.5">
          <div className="w-36 shrink-0 text-sm font-semibold text-cyan-400 self-center">{v.cve_id || "—"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {v.severity && <span className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[v.severity] || SEVERITY_DOT.Low}`} />}
              <div className="text-sm font-semibold text-white break-words leading-snug">{v.title}</div>
            </div>
            {v.description && <div className="text-xs text-slate-400 mt-0.5 break-words">{v.description}</div>}
          </div>
          {v.cvss_score != null && (
            <div className="shrink-0 self-center text-right">
              <div className="text-lg font-bold text-white leading-none">{v.cvss_score.toFixed(1)}</div>
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500 mt-0.5">CVSS</div>
            </div>
          )}
          <div className="shrink-0 self-center">
            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide text-center border ${STATUS_STYLES[v.status] || STATUS_STYLES.HIGH}`}>
              {v.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}