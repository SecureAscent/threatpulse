import React from "react";

export default function BriefLandscape({ bullets, attackSurface }) {
  return (
    <div className="grid sm:grid-cols-[1fr_260px] gap-px bg-[#1c3350]">
      <div className="bg-[#132941] p-4">
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="text-sm text-slate-300 flex gap-2">
              <span className="text-cyan-400">›</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-[#0f2135] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-400 mb-1">Primary Attack Surface</p>
        <p className="text-base font-bold text-white uppercase mb-2">{attackSurface.title}</p>
        <p className="text-xs text-slate-400">{attackSurface.description}</p>
      </div>
    </div>
  );
}