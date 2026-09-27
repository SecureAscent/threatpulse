import React from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";

const glassCls =
  "rounded-[26px] border border-white/[0.17] shadow-[0_22px_56px_rgba(0,0,0,0.22),inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-[18px] bg-[linear-gradient(140deg,rgba(255,255,255,0.105),rgba(255,255,255,0.045))]";

const btnCls =
  "inline-flex items-center gap-2 px-5 py-3.5 rounded-[14px] border border-white/[0.21] bg-[rgba(14,17,38,0.52)] text-white text-base font-semibold cursor-pointer transition-all hover:bg-white/[0.14] hover:shadow-[0_8px_22px_rgba(0,0,0,0.2)] active:translate-y-px focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[#ff9b86]";

const primaryBtnCls =
  "inline-flex items-center gap-2 px-5 py-3.5 rounded-[14px] border border-transparent text-white text-base font-semibold cursor-pointer transition-all active:translate-y-px focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[#ff9b86]";

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  const d = new Date(iso);
  const today = new Date().toDateString();
  if (d.toDateString() === today) return "Today";
  return d.toLocaleDateString();
}

export default function ReviewTimeline({ recentReviews, threats, onExportCSV, onExportPDF, exporting }) {
  const threatMap = React.useMemo(() => {
    const m = {};
    threats.forEach((t) => { m[t.id] = t; });
    return m;
  }, [threats]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`${glassCls} p-8 md:p-9`}>
        <h3 className="text-2xl font-bold text-white mb-5">Recent Reviews</h3>
        {recentReviews.length === 0 ? (
          <p className="text-[#b9bad2] text-sm py-8 text-center">No review activity yet. Mark threats as reviewed to build the audit trail.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {recentReviews.slice(0, 8).map((r) => {
              const t = threatMap[r.threat_id];
              return (
                <div key={r.id} className="grid grid-cols-[90px_16px_1fr] gap-3.5 items-center text-[#d9d7e9] text-base">
                  <time className="text-[#aaaac3] tabular-nums text-sm">{fmtDate(r.created_date)} {fmtTime(r.created_date)}</time>
                  <span className="justify-self-center w-2.5 h-2.5 rounded-full bg-[#ff9b86] shadow-[0_0_12px_rgba(255,155,134,0.6)]" />
                  <span className="truncate">
                    <span className="font-semibold text-white">{r.actor_name || "Unknown"}</span>
                    {" · "}
                    {t ? t.title : r.description || "Threat"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={onExportCSV} className={btnCls}>
            <FileSpreadsheet className="w-4 h-4" /> CSV
          </button>
          <button onClick={onExportPDF} disabled={exporting} className={`${primaryBtnCls} disabled:opacity-50`} style={{ background: "linear-gradient(135deg,#ff657e,#ff9b68)" }}>
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div className={`${glassCls} p-8 md:p-9`}>
        <h3 className="text-2xl font-bold text-white mb-5">Audit Evidence</h3>
        <div
          className="h-[3px] w-full mb-5"
          style={{
            background: "linear-gradient(90deg,transparent,#ff7087 18%,#ffc36c 50%,#9b86ff 82%,transparent)",
            opacity: 0.7,
            animation: "review-glow 4s ease-in-out infinite",
          }}
        />
        <p className="text-[#b9bad2] text-[15px] leading-relaxed">
          Every "Mark Reviewed" click is timestamped and attributed to the reviewer, creating a tamper-evident
          audit trail. Export the full review log as CSV for spreadsheet analysis or PDF for compliance
          submissions — proving your team reviews threats on a daily basis.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={onExportCSV} className={btnCls}>
            <FileDown className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}