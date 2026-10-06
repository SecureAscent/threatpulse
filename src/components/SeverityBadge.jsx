import React from "react";

const config = {
  Critical: "bg-red-500/10 text-red-500 border-red-500/20",
  High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export default function SeverityBadge({ severity, className = "" }) {
  const c = config[severity] || config.Medium;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${c} ${className}`}>
      {severity}
    </span>
  );
}