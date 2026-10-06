import React from "react";

const STATUS_STYLES = {
  "ZERO-DAY ACTIVE": "bg-rose-500/15 text-rose-400",
  "CISA KEV": "bg-amber-400/15 text-amber-400",
  CRITICAL: "bg-amber-400/15 text-amber-400",
  HIGH: "bg-slate-500/20 text-slate-300",
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
            <div className="text-sm font-semibold text-white">{v.title}</div>
            {v.description && <div className="text-xs text-slate-400 mt-0.5">{v.description}</div>}
          </div>
          <div className="shrink-0 self-center">
            <span className={`inline-block px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide text-center ${STATUS_STYLES[v.status] || STATUS_STYLES.HIGH}`}>
              {v.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}