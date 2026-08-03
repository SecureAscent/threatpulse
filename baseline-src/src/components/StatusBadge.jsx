import React from "react";

const config = {
  New: "bg-blue-50 text-blue-700 border-blue-200",
  Analyzing: "bg-amber-50 text-amber-700 border-amber-200",
  Mitigated: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function StatusBadge({ status, className = "" }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${config[status] || "bg-slate-50 text-slate-700 border-slate-200"} ${className}`}>
      {status}
    </span>
  );
}