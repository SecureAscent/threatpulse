import React from "react";

const tiers = {
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

function tier(score) {
  if (score == null) return null;
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "medium";
  return "low";
}

export default function RiskScoreBadge({ score, className = "" }) {
  if (score == null) return null;
  const t = tier(score);
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${tiers[t]} ${className}`}
      title="ThreatPulse Risk Score (0-100) — CVSS × EPSS × blast radius × source reliability"
    >
      <span className="font-mono">{score}</span>
      <span className="opacity-50 text-[10px]">/100</span>
    </span>
  );
}