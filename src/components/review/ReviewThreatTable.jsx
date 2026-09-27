import React, { useState, useMemo } from "react";
import { Search, X, CheckCircle2, Loader2, Flag, Ticket } from "lucide-react";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";

const typeOptions = ["All Types", "Vulnerability", "Ransomware", "Campaign", "Malware", "Breach", "Advisory", "Other"];

const glassCls =
  "rounded-[26px] border border-white/[0.17] shadow-[0_22px_56px_rgba(0,0,0,0.22),inset_0_1px_rgba(255,255,255,0.12)] backdrop-blur-[18px] bg-[linear-gradient(140deg,rgba(255,255,255,0.105),rgba(255,255,255,0.045))] overflow-hidden";

const inputCls =
  "px-4 py-3.5 rounded-[14px] border border-white/[0.21] bg-[rgba(14,17,38,0.52)] text-white text-base outline-none focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[#ff9b86] placeholder:text-[#aaaac3]";

const btnCls =
  "px-4 py-3.5 rounded-[14px] border border-white/[0.21] bg-[rgba(14,17,38,0.52)] text-white text-base font-semibold cursor-pointer transition-all hover:bg-white/[0.14] hover:shadow-[0_8px_22px_rgba(0,0,0,0.2)] active:translate-y-px focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[#ff9b86]";

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ReviewThreatTable({ threats, onMarkReviewed, reviewingId, onFlagReview, flaggingId, onCreateTicket, ticketingId }) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [sevFilter, setSevFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    return threats.filter((t) => {
      if (typeFilter !== "All Types" && t.type !== typeFilter) return false;
      if (sevFilter !== "All" && t.severity !== sevFilter) return false;
      if (statusFilter !== "All" && t.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        const hay = `${t.title} ${t.description || ""} ${t.cve_id || ""} ${t.source || ""} ${t.affected_products || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threats, query, typeFilter, sevFilter, statusFilter]);

  const hasFilters = query || typeFilter !== "All Types" || sevFilter !== "All" || statusFilter !== "All";

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-56 max-w-[610px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#aaaac3] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, CVE, source, products…"
            className={`${inputCls} w-full pl-11`}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={inputCls}>
          {typeOptions.map((o) => <option key={o} className="bg-[#11152e]">{o}</option>)}
        </select>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value)} className={inputCls}>
          <option className="bg-[#11152e]">All</option>
          <option className="bg-[#11152e]">Critical</option>
          <option className="bg-[#11152e]">High</option>
          <option className="bg-[#11152e]">Medium</option>
          <option className="bg-[#11152e]">Low</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls}>
          <option className="bg-[#11152e]">All</option>
          <option className="bg-[#11152e]">New</option>
          <option className="bg-[#11152e]">Analyzing</option>
          <option className="bg-[#11152e]">Mitigated</option>
        </select>
        {hasFilters && (
          <button
            onClick={() => { setQuery(""); setTypeFilter("All Types"); setSevFilter("All"); setStatusFilter("All"); }}
            className={`${btnCls} inline-flex items-center gap-1.5`}
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <p className="text-[#b9bad2] text-base mb-4">{filtered.length} threats</p>

      <div className={glassCls}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[17px]">
            <thead className="bg-white/[0.07] text-[#c7c5dd] uppercase text-[13px] tracking-[1.25px]">
              <tr>
                <th className="font-semibold px-6 py-5 whitespace-nowrap">Title</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap">Severity</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap">Status</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap hidden md:table-cell">Type</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap hidden lg:table-cell">CVE</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap hidden lg:table-cell">Source</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap">Last Reviewed</th>
                <th className="font-semibold px-6 py-5 whitespace-nowrap hidden xl:table-cell">Flagged For</th>
                <th className="px-6 py-5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-[#b9bad2]">
                    No threats match your filters.
                  </td>
                </tr>
              ) : filtered.map((t) => (
                <tr key={t.id} className="border-t border-white/[0.1] transition-colors hover:bg-white/[0.055]">
                  <td className="px-6 py-5">
                    <p className="font-medium text-white line-clamp-1 max-w-xs">{t.title}</p>
                    {t.affected_products && <p className="text-xs text-[#b9bad2] mt-0.5 line-clamp-1 max-w-xs">{t.affected_products}</p>}
                  </td>
                  <td className="px-6 py-5"><SeverityBadge severity={t.severity} /></td>
                  <td className="px-6 py-5"><StatusBadge status={t.status} /></td>
                  <td className="px-6 py-5 text-sm text-[#efedf8] hidden md:table-cell">{t.type}</td>
                  <td className="px-6 py-5 font-mono text-xs text-[#efedf8] hidden lg:table-cell">{t.cve_id || "—"}</td>
                  <td className="px-6 py-5 text-sm text-[#efedf8] hidden lg:table-cell">{t.source || "—"}</td>
                  <td className="px-6 py-5 text-sm text-[#b9bad2]">
                    {t.last_reviewed_by ? (
                      <div>
                        <p className="text-[#efedf8] font-medium text-xs">{t.last_reviewed_by}</p>
                        <p className="text-xs mt-0.5">{timeAgo(t.last_reviewed_date)}</p>
                      </div>
                    ) : (
                      <span className="text-[#aaaac3]">Not yet</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-sm hidden xl:table-cell">
                    {t.review_requested_to ? (
                      <div>
                        <p className="text-[#ffd18b] font-medium text-xs flex items-center gap-1.5">
                          <Flag className="w-3 h-3" /> {t.review_requested_to}
                        </p>
                        {t.review_requested_by && <p className="text-xs text-[#b9bad2] mt-0.5">by {t.review_requested_by}</p>}
                      </div>
                    ) : (
                      <span className="text-[#aaaac3]">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onMarkReviewed(t)}
                        disabled={reviewingId === t.id}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] border border-white/[0.21] bg-white/[0.05] text-white text-sm font-semibold cursor-pointer transition-all hover:bg-white/[0.14] active:translate-y-px disabled:opacity-50 disabled:cursor-wait"
                      >
                        {reviewingId === t.id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Marking…</>
                        ) : (
                          <><CheckCircle2 className="w-4 h-4" /> Mark Reviewed</>
                        )}
                      </button>
                      <button
                        onClick={() => onFlagReview(t)}
                        disabled={flaggingId === t.id}
                        title="Flag for review by a teammate"
                        className="inline-flex items-center justify-center w-10 h-10 rounded-[14px] border border-white/[0.21] bg-white/[0.05] text-[#ffd18b] cursor-pointer transition-all hover:bg-white/[0.14] active:translate-y-px disabled:opacity-50 disabled:cursor-wait"
                      >
                        {flaggingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                      </button>
                      {t.ticket_created && t.ticket_url ? (
                        <a
                          href={t.ticket_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Jira ticket ${t.ticket_name}`}
                          className="inline-flex items-center justify-center w-10 h-10 rounded-[14px] border border-emerald-400/30 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-all"
                        >
                          <Ticket className="w-4 h-4" />
                        </a>
                      ) : (
                        <button
                          onClick={() => onCreateTicket(t)}
                          disabled={ticketingId === t.id}
                          title="Create Jira ticket & send email"
                          className="inline-flex items-center justify-center w-10 h-10 rounded-[14px] border border-white/[0.21] bg-white/[0.05] text-[#7dd3fc] cursor-pointer transition-all hover:bg-white/[0.14] active:translate-y-px disabled:opacity-50 disabled:cursor-wait"
                        >
                          {ticketingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}