import React from "react";

export default function BriefStatCards({ stats, volumeLabel }) {
  const items = [
    { value: stats.total.toLocaleString(), label: "New Threats", sub: `${stats.cveCount} with CVE IDs · ${volumeLabel}` },
    { value: stats.critical.toLocaleString(), label: "Critical", sub: `${stats.criticalPct}% of new threats` },
    { value: stats.high.toLocaleString(), label: "High", sub: `${stats.highPct}% of new threats` },
    { value: stats.kevCount.toLocaleString(), label: "CISA KEVs", sub: "confirmed exploitation" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#1c3350] rounded-lg overflow-hidden border border-[#1c3350]">
      {items.map((it) => (
        <div key={it.label} className="bg-[#0f2135] px-4 py-5 text-center">
          <div className="text-3xl font-bold text-white">{it.value}</div>
          <div className="text-xs font-bold uppercase tracking-wide text-cyan-400 mt-1">{it.label}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{it.sub}</div>
        </div>
      ))}
    </div>
  );
}