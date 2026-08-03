import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SeverityBadge from "@/components/SeverityBadge";
import StatusBadge from "@/components/StatusBadge";
import ActivityTimeline from "@/components/ActivityTimeline";
import InvestigationTemplate from "@/components/InvestigationTemplate";
import ThreatImpactAssessment from "@/components/ThreatImpactAssessment";
import { generateThreatReport } from "@/lib/threatReport";
import { computeSla, formatDuration, SLA_LABELS } from "@/lib/threatSla";
import {
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
  User,
  Save,
  ExternalLink,
  Package,
  ShieldAlert,
  RotateCcw,
  Loader2,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { buildThreatInvestigationCSV, downloadCsv } from "@/lib/csvExport";
import ThreatComments from "@/components/threats/ThreatComments";
import EvidenceLocker from "@/components/threats/EvidenceLocker";
import ComplianceMapping from "@/components/threats/ComplianceMapping";
import EnrichmentPanel from "@/components/threats/EnrichmentPanel";

const STATUS_FLOW = ["New", "Analyzing", "Mitigated"];

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function ThreatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user?.full_name || user?.email || "Analyst";

  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(null); // 'status' | 'assign' | 'note' | null
  const [reportBusy, setReportBusy] = useState(false);

  const { data: threat, isLoading, isError } = useQuery({
    queryKey: ["threat", id],
    queryFn: () => base44.entities.Threat.get(id),
    enabled: !!id,
  });

  const { data: activity = [], refetch: refetchActivity } = useQuery({
    queryKey: ["activity", id],
    queryFn: () => base44.entities.ThreatActivity.filter({ threat_id: id }, "-created_date", 100),
    enabled: !!id,
  });

  const { data: allThreats = [] } = useQuery({
    queryKey: ["threats", "all"],
    queryFn: () => base44.entities.Threat.list("-created_date", 200),
  });

  const related = (allThreats || [])
    .filter((t) => t.id !== id && (
      (threat?.cve_id && t.cve_id === threat.cve_id) ||
      t.source === threat?.source
    ))
    .slice(0, 6);

  const logActivity = async (action, description, oldVal = "", newVal = "") => {
    try {
      await base44.entities.ThreatActivity.create({
        threat_id: id,
        action,
        description,
        old_value: oldVal,
        new_value: newVal,
        actor_name: actor,
      });
    } catch (_) { /* audit best-effort */ }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["threat", id] });
    qc.invalidateQueries({ queryKey: ["threats"] });
    refetchActivity();
  };

  const changeStatus = async (next) => {
    setSaving("status");
    try {
      const now = new Date().toISOString();
      const update = { status: next };
      if (next === "Analyzing" && !threat.first_response_date) update.first_response_date = now;
      else if (next === "Mitigated" && !threat.closed_date) update.closed_date = now;
      await base44.entities.Threat.update(id, update);
      await logActivity(next === "Mitigated" ? "status_change" : "status_change", `Status → ${next}`, threat.status, next);
      refresh();
    } finally { setSaving(null); }
  };

  const reopen = async () => {
    setSaving("status");
    try {
      await base44.entities.Threat.update(id, { status: "New", closed_date: null, first_response_date: null });
      await logActivity("reopen", "Threat reopened", threat.status, "New");
      refresh();
    } finally { setSaving(null); }
  };

  const assign = async () => {
    if (!assignee.trim()) return;
    setSaving("assign");
    try {
      await base44.entities.Threat.update(id, { assigned_to: assignee.trim() });
      await logActivity("assign", `Assigned to ${assignee.trim()}`, threat.assigned_to || "Unassigned", assignee.trim());
      setAssignee("");
      refresh();
    } finally { setSaving(null); }
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving("note");
    try {
      const stamp = new Date().toLocaleString();
      const entry = `[${stamp}] ${actor}:\n${note.trim()}`;
      const newNotes = threat.notes ? `${threat.notes}\n\n${entry}` : entry;
      await base44.entities.Threat.update(id, { notes: newNotes });
      await logActivity("note", note.trim());
      setNote("");
      refresh();
    } finally { setSaving(null); }
  };

  const downloadReport = () => {
    setReportBusy(true);
    try {
      generateThreatReport(threat, { activity, allThreats });
    } catch (e) {
      console.error("Report generation failed", e);
    } finally {
      setReportBusy(false);
    }
  };

  const exportInvestigation = async () => {
    setReportBusy(true);
    try {
      const comments = await base44.entities.Comment.filter({ threat_id: id }, "created_date", 500);
      const csv = buildThreatInvestigationCSV(threat, activity, comments);
      downloadCsv(`threatpulse-investigation-${threat.cve_id || threat.id}.csv`, csv);
    } catch (e) {
      console.error("CSV export failed", e);
    } finally {
      setReportBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !threat) {
    return (
      <div className="p-8 max-w-2xl">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">This threat could not be found or has been removed.</p>
        </div>
      </div>
    );
  }

  const sla = computeSla(threat);
  const slaColor = sla?.resolved ? "text-emerald-500"
    : sla?.breached ? "text-red-500"
    : sla?.pct >= 75 ? "text-amber-500"
    : "text-emerald-500";
  const slaBar = sla?.resolved ? "bg-emerald-500" : sla?.breached ? "bg-red-500" : sla?.pct >= 75 ? "bg-amber-500" : "bg-primary";
  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(threat.status) + 1];

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to feed
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadReport}
            disabled={reportBusy}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            {reportBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Download Report
          </button>
          <button
            onClick={exportInvestigation}
            disabled={reportBusy}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export CSV
          </button>
          <span className="text-xs font-mono text-muted-foreground">{threat.id}</span>
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SeverityBadge severity={threat.severity} />
          <StatusBadge status={threat.status} />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{threat.source}</span>
          {threat.cve_id && (
            <a
              href={threat.source_url || `https://nvd.nist.gov/vuln/detail/${threat.cve_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-mono text-primary hover:underline"
            >
              {threat.cve_id} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <h1 className="text-xl font-bold leading-snug mb-2">{threat.title}</h1>
        {threat.description && <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">{threat.description}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-4 text-xs text-muted-foreground">
          <span>Detected {relativeTime(threat.created_date)}</span>
          {threat.first_response_date && <span>First response {relativeTime(threat.first_response_date)}</span>}
          {threat.closed_date && <span>Closed {relativeTime(threat.closed_date)}</span>}
          {threat.cvss_score != null && <span className="font-mono">CVSS {threat.cvss_score}</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Investigation Template */}
          <InvestigationTemplate
            threatId={id}
            activity={activity}
            actor={actor}
            onRefresh={refresh}
          />

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Analyst Notes</h3>
            </div>
            {threat.notes ? (
              <pre className="whitespace-pre-wrap text-sm text-foreground/90 bg-muted/40 rounded-lg p-4 mb-4 font-body leading-relaxed">{threat.notes}</pre>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">No notes recorded yet.</p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add an investigation note…"
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={saveNote}
                disabled={!note.trim() || saving === "note"}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving === "note" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Add Note
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          <ActivityTimeline activity={activity} />

          {/* Discussion */}
          <ThreatComments threatId={id} />

          {/* Evidence locker */}
          <EvidenceLocker threatId={id} />

          {/* IOC enrichment */}
          <EnrichmentPanel />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* SLA */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">SLA Compliance</h3>
            </div>
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-1">Target ({SLA_LABELS[threat.severity] || "24 hours"})</p>
              {sla ? (
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${slaColor}`}>
                      {sla.resolved ? "Resolved" : sla.breached ? "Breached" : formatDuration(sla.remaining)}
                    </span>
                    {!sla.resolved && !sla.breached && <span className="text-xs text-muted-foreground">remaining</span>}
                    {sla.breached && <span className="text-xs text-red-500">overdue {formatDuration(Math.abs(sla.remaining))}</span>}
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                    <div className={`h-full ${slaBar} transition-all`} style={{ width: `${sla.pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Elapsed {formatDuration(sla.elapsed)} of {formatDuration(sla.slaMs)}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">Unknown</p>}
            </div>
            {sla?.breached && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/20 p-2.5 mb-3">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-500">SLA breached — escalate to SOC lead per policy.</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-3 border-t border-border">
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
              {threat.status === "Mitigated" ? "Mitigated & closed." : threat.status === "Analyzing" ? "Under analysis." : "Awaiting triage."}
            </p>
          </div>

          {/* Status workflow */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Workflow</h3>
            <div className="flex items-center justify-between mb-4">
              {STATUS_FLOW.map((s, i) => (
                <React.Fragment key={s}>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                      STATUS_FLOW.indexOf(threat.status) >= i
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border"
                    }`}>{i + 1}</span>
                    <span className="text-[10px] text-muted-foreground">{s}</span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && <span className="flex-1 h-px bg-border mx-1 -mt-4" />}
                </React.Fragment>
              ))}
            </div>
            {nextStatus ? (
              <button
                onClick={() => changeStatus(nextStatus)}
                disabled={saving === "status"}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving === "status" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Advance to {nextStatus}
              </button>
            ) : (
              <button
                onClick={reopen}
                disabled={saving === "status"}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-input text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
              >
                {saving === "status" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Reopen Threat
              </button>
            )}
          </div>

          {/* Assignment */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Assignment</h3>
            </div>
            <p className="text-sm mb-3">
              {threat.assigned_to
                ? <span className="text-foreground">{threat.assigned_to}</span>
                : <span className="text-muted-foreground">Unassigned</span>}
            </p>
            <div className="flex gap-2">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Analyst name or email"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={assign}
                disabled={!assignee.trim() || saving === "assign"}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving === "assign" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign"}
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">Metadata</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right">{threat.type}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Affected</dt>
                <dd className="text-right truncate max-w-[60%]">{threat.affected_products || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">CVSS</dt>
                <dd className="text-right font-mono">{threat.cvss_score ?? "—"}</dd>
              </div>
              {threat.source_url && (
                <a href={threat.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                  View source <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </dl>
          </div>

          {/* Compliance mapping */}
          <ComplianceMapping threat={threat} />

          {/* Impact Assessment */}
          <ThreatImpactAssessment threat={threat} />

          {/* Related */}
          {related.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">Related Intelligence</h3>
              <ul className="space-y-2">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link to={`/threats/${r.id}`} className="block rounded-lg hover:bg-accent/50 p-2 -mx-2 transition-colors">
                      <div className="flex items-center gap-2 mb-0.5">
                        <SeverityBadge severity={r.severity} className="!px-1.5 !py-0" />
                        <span className="text-xs text-muted-foreground">{r.source}</span>
                      </div>
                      <p className="text-xs font-medium line-clamp-1">{r.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}