import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Loader2, FileDown } from "lucide-react";
import { Image } from "@/components/ui/image";
import ReviewSummaryCards from "@/components/review/ReviewSummaryCards";
import ReviewThreatTable from "@/components/review/ReviewThreatTable";
import ReviewAuditPanel from "@/components/review/ReviewAuditPanel";
import ReviewTimeline from "@/components/review/ReviewTimeline";
import FlagReviewDialog from "@/components/review/FlagReviewDialog";
import { rowsToCsv, downloadCsv } from "@/lib/csvExport";
import { exportElementToPdf } from "@/lib/exportPdf";

const HERO_IMG = "https://media.base44.com/images/public/6a601c9ee28f256387b6c791/f85c34114_generated_b255d613.jpg";

const primaryBtnCls =
  "inline-flex items-center gap-2 px-5 py-3.5 rounded-[14px] border border-transparent text-white text-base font-semibold cursor-pointer transition-all hover:opacity-90 active:translate-y-px focus:outline-[3px] focus:outline-offset-[3px] focus:outline-[#ff9b86] disabled:opacity-50";

export default function DailyReviewAudit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [reviewingId, setReviewingId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [flagTarget, setFlagTarget] = useState(null);
  const [flaggingId, setFlaggingId] = useState(null);
  const [ticketingId, setTicketingId] = useState(null);

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const { data: reviewActivity = [] } = useQuery({
    queryKey: ["review-activity"],
    queryFn: () => base44.entities.ThreatActivity.filter({ action: "reviewed" }, "-created_date", 500),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => base44.entities.User.list(),
  });

  const todayStr = new Date().toDateString();
  const todayReviews = useMemo(
    () => reviewActivity.filter((r) => new Date(r.created_date).toDateString() === todayStr),
    [reviewActivity, todayStr]
  );

  const reviewerStats = useMemo(() => {
    const m = {};
    todayReviews.forEach((r) => {
      const name = r.actor_name || "Unknown";
      m[name] = (m[name] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [todayReviews]);

  const handleMarkReviewed = async (threat) => {
    setReviewingId(threat.id);
    try {
      const reviewerName = user?.full_name || user?.email || "Unknown Analyst";
      await base44.entities.Threat.update(threat.id, {
        last_reviewed_date: new Date().toISOString(),
        last_reviewed_by: reviewerName,
      });
      await base44.entities.ThreatActivity.create({
        threat_id: threat.id,
        action: "reviewed",
        description: `Threat reviewed by ${reviewerName}`,
        actor_name: reviewerName,
      });
      qc.invalidateQueries({ queryKey: ["threats"] });
      qc.invalidateQueries({ queryKey: ["review-activity"] });
    } finally {
      setReviewingId(null);
    }
  };

  const handleFlagReview = async ({ target, message }) => {
    if (!flagTarget) return;
    setFlaggingId(flagTarget.id);
    try {
      const requesterName = user?.full_name || user?.email || "Unknown Analyst";
      const targetName = target.full_name || target.email;
      await base44.entities.Threat.update(flagTarget.id, {
        review_requested_to: targetName,
        review_requested_by: requesterName,
        review_requested_date: new Date().toISOString(),
      });
      await base44.entities.ThreatActivity.create({
        threat_id: flagTarget.id,
        action: "review_requested",
        description: `Review requested: ${requesterName} → ${targetName}${message ? ` — "${message}"` : ""}`,
        actor_name: requesterName,
      });
      await base44.integrations.Core.SendEmail({
        to: target.email,
        subject: `ThreatPulse: Review requested — "${flagTarget.title}"`,
        body: `${requesterName} has flagged the following threat for your review:\n\nThreat: ${flagTarget.title}\nSeverity: ${flagTarget.severity}\nStatus: ${flagTarget.status}${flagTarget.cve_id ? `\nCVE: ${flagTarget.cve_id}` : ""}${message ? `\n\nMessage: ${message}` : ""}\n\nReview it in ThreatPulse → Daily Review Audit:\n${window.location.origin}/daily-review-audit`,
      });
      qc.invalidateQueries({ queryKey: ["threats"] });
      qc.invalidateQueries({ queryKey: ["review-activity"] });
      setFlagTarget(null);
    } finally {
      setFlaggingId(null);
    }
  };

  const handleCreateTicket = async (threat) => {
    setTicketingId(threat.id);
    try {
      const res = await base44.functions.invoke('createThreatTicket', {
        threat_id: threat.id,
        recipient_email: user?.email,
      });
      if (res.data?.error) throw new Error(res.data.error);
      qc.invalidateQueries({ queryKey: ["threats"] });
      qc.invalidateQueries({ queryKey: ["review-activity"] });
    } finally {
      setTicketingId(null);
    }
  };

  const handleExportCSV = () => {
    const rows = [["Date", "Time", "Reviewer", "Threat Title", "Severity", "Status", "CVE ID", "Source", "Threat ID"]];
    reviewActivity.forEach((r) => {
      const t = threats.find((x) => x.id === r.threat_id);
      const d = new Date(r.created_date);
      rows.push([
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        r.actor_name || "",
        t?.title || "",
        t?.severity || "",
        t?.status || "",
        t?.cve_id || "",
        t?.source || "",
        r.threat_id,
      ]);
    });
    downloadCsv(`daily-review-audit-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(rows));
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await exportElementToPdf("daily-review-audit-export", `daily-review-audit-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="min-h-full relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 88% 7%, #743049 0, transparent 32%), radial-gradient(ellipse at 7% 42%, #233a85 0, transparent 38%), linear-gradient(155deg, #11152e, #19182f 52%, #101d36)",
      }}
    >
      <div className="relative z-10 max-w-[2180px] mx-auto px-6 md:px-8 lg:px-10 py-8 md:py-10 lg:py-12 flex flex-col gap-12 lg:gap-16">
        {/* Hero */}
        <section
          className="relative min-h-[280px] md:min-h-[340px] rounded-[34px] overflow-hidden flex items-end p-8 md:p-12 border border-white/[0.19]"
          style={{ background: "#171a35", boxShadow: "0 36px 90px rgba(0,0,0,0.35)", animation: "review-enter 0.7s cubic-bezier(0.2,0.75,0.25,1) both" }}
        >
          <Image
            src={HERO_IMG}
            alt=""
            fittingType="fill"
            className="absolute inset-0 w-full h-full opacity-[0.72] pointer-events-none"
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg,rgba(12,15,35,0.94),rgba(12,15,35,0.56) 55%,rgba(12,15,35,0.12)),linear-gradient(0deg,rgba(12,15,35,0.45),transparent 70%)",
            }}
          />
          <div className="relative z-10 max-w-[1320px]">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08] mb-3">
              Daily Review Audit
            </h1>
            <p className="text-lg md:text-2xl text-[#dedcf0] leading-relaxed max-w-[1220px]">
              Prove your team reviews threats every day. Each review is timestamped and attributed —
              roll up per-person, per-day summaries and export them as audit-ready evidence.
            </p>
          </div>
        </section>

        {/* Summary + Export */}
        <section style={{ animation: "review-enter 0.75s cubic-bezier(0.2,0.75,0.25,1) both" }}>
          <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Today's Review Summary</h2>
              <p className="text-[#b9bad2] text-lg mt-2">Live rollup of daily review activity across your team.</p>
            </div>
            <button onClick={handleExportPDF} disabled={exporting} className={primaryBtnCls} style={{ background: "linear-gradient(135deg,#ff657e,#ff9b68)" }}>
              {exporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</> : <><FileDown className="w-4 h-4" /> Export PDF</>}
            </button>
          </div>
          <ReviewSummaryCards
            todayCount={todayReviews.length}
            activeReviewers={reviewerStats.length}
            totalReviewed={reviewActivity.length}
          />
        </section>

        {/* Threats table */}
        <section style={{ animation: "review-enter 0.75s cubic-bezier(0.2,0.75,0.25,1) both" }}>
          <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Threats</h2>
              <p className="text-[#b9bad2] text-lg mt-2">Mark each threat as reviewed to build the audit trail.</p>
            </div>
          </div>
          {isLoading ? (
            <div className="rounded-[26px] border border-white/[0.17] bg-white/[0.05] overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 border-b border-white/[0.1] last:border-0 bg-white/[0.03] animate-pulse" />)}
            </div>
          ) : (
            <ReviewThreatTable
              threats={threats}
              onMarkReviewed={handleMarkReviewed}
              reviewingId={reviewingId}
              onFlagReview={setFlagTarget}
              flaggingId={flaggingId}
              onCreateTicket={handleCreateTicket}
              ticketingId={ticketingId}
            />
          )}
        </section>

        {/* Audit panel */}
        <section style={{ animation: "review-enter 0.75s cubic-bezier(0.2,0.75,0.25,1) both" }}>
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Team Review Rollup</h2>
            <p className="text-[#b9bad2] text-lg mt-2">Who reviewed what today — per-person breakdown.</p>
          </div>
          <ReviewAuditPanel reviewerStats={reviewerStats} />
        </section>

        {/* Timeline + Export */}
        <div id="daily-review-audit-export" style={{ animation: "review-enter 0.75s cubic-bezier(0.2,0.75,0.25,1) both" }}>
          <ReviewTimeline
            recentReviews={reviewActivity}
            threats={threats}
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            exporting={exporting}
          />
        </div>
      </div>
      <FlagReviewDialog
        open={!!flagTarget}
        onOpenChange={(open) => { if (!open) setFlagTarget(null); }}
        threat={flagTarget}
        users={users}
        currentUser={user}
        onSubmit={handleFlagReview}
        submitting={!!flaggingId}
      />
    </div>
  );
}