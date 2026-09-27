import React from "react";
import { ShieldCheck } from "lucide-react";

const glassCls =
  "rounded-[26px] border border-white/[0.17] shadow-[0_22px_56px_rgba(0,0,0,0.22),inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-[18px] bg-[linear-gradient(140deg,rgba(255,255,255,0.105),rgba(255,255,255,0.045))]";

function initials(name) {
  return (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function ReviewAuditPanel({ reviewerStats }) {
  const top = reviewerStats.slice(0, 6);
  return (
    <div className={`${glassCls} p-8 md:p-9 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center`}>
      <div className="flex items-center gap-4">
        <div
          className="w-[45px] h-[45px] rounded-[14px] grid place-items-center text-[#ffb2a5] text-xl shrink-0"
          style={{
            background: "linear-gradient(135deg,rgba(255,101,126,0.25),rgba(255,190,101,0.17))",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white mb-1 leading-tight">Daily Review Audit</h3>
          <p className="text-lg leading-relaxed text-[#c5c4d8]">
            Per-threat review marks roll up into per-person, per-day summaries — exportable as audit evidence.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {top.length === 0 ? (
          <p className="text-sm text-[#bebdd4] col-span-full text-center py-4">No reviews recorded today yet.</p>
        ) : top.map((r) => (
          <div
            key={r.name}
            className="p-4 rounded-[16px] bg-[rgba(10,14,34,0.38)] border border-white/[0.12]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-7 h-7 rounded-full grid place-items-center bg-white/[0.08] text-white text-xs font-bold">
                {initials(r.name)}
              </span>
              <strong className="text-base text-white truncate">{r.name}</strong>
            </div>
            <span className="text-sm text-[#bebdd4]">{r.count} reviewed</span>
          </div>
        ))}
      </div>
    </div>
  );
}