import React from "react";

const ACCENTS = {
  cyan: "text-cyan-400",
  blue: "text-blue-400",
  rose: "text-rose-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
};

export default function BriefSectionHeader({ label, title, icon: Icon, accent = "cyan" }) {
  const accentClass = ACCENTS[accent] || ACCENTS.cyan;
  return (
    <div className="flex items-center gap-2 bg-[#0f2135] px-4 py-2.5">
      {Icon && <Icon className={`w-3.5 h-3.5 ${accentClass}`} />}
      <span className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>{label}</span>
      {title && <span className="text-xs font-bold uppercase tracking-wide text-white"> / {title}</span>}
    </div>
  );
}