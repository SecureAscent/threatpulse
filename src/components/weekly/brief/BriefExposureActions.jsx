import React from "react";

export default function BriefExposureActions({ exposureItems, exposureHeadline, actions }) {
  const confirmed = !exposureHeadline?.startsWith("No Confirmed");
  return (
    <div className="grid sm:grid-cols-2 gap-px bg-[#1c3350]">
      <div className="bg-[#132941] p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-cyan-400 mb-1">Company Exposure Assessment</h4>
        <p className={`text-sm font-bold mb-2 uppercase ${confirmed ? "text-amber-400" : "text-emerald-400"}`}>{exposureHeadline}</p>
        <ul className="space-y-1.5">
          {exposureItems.map((item, i) => (
            <li key={i} className="text-xs text-slate-300 flex gap-2">
              <span className="text-cyan-400">›</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-[#132941] p-4">
        <h4 className="text-xs font-bold uppercase tracking-wide text-cyan-400 mb-2">Action Priority</h4>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-bold text-rose-400 uppercase">Immediate</p>
            <p className="text-xs text-slate-300 mt-0.5">{actions.immediate}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase">This Week</p>
            <p className="text-xs text-slate-300 mt-0.5">{actions.thisWeek}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400 uppercase">Ongoing</p>
            <p className="text-xs text-slate-300 mt-0.5">{actions.ongoing}</p>
          </div>
        </div>
      </div>
    </div>
  );
}