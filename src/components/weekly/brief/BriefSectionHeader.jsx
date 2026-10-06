import React from "react";

export default function BriefSectionHeader({ label, title }) {
  return (
    <div className="bg-[#0f2135] px-4 py-2.5">
      <span className="text-xs font-bold uppercase tracking-wide text-cyan-400">{label}</span>
      {title && <span className="text-xs font-bold uppercase tracking-wide text-white"> / {title}</span>}
    </div>
  );
}