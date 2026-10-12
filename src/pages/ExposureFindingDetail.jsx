import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SeverityBadge from "@/components/SeverityBadge";
import EvidenceReveal from "@/components/exposures/EvidenceReveal";
import {
  ArrowLeft,
  ExternalLink,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Eye,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Fingerprint,
} from "lucide-react";

const STATUS_FLOW = [
  { value: "new", label: "New" },
  { value: "validated", label: "Validated" },
  { value: "remediated", label: "Remediated" },
  { value: "false_positive", label: "False Positive" },
];

const statusBadge = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  validated: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  false_positive: "bg-muted text-muted-foreground border-border",
  remediated: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const kindLabel = {
  credential_leak: "Credential Leak",
  mention: "Mention",
  domain_exposure: "Domain Exposure",
  identity_exposure: "Identity Exposure",
};

function relTime(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ExposureFindingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const actor = user?.full_name || user?.email || "Analyst";

  const [savingStatus, setSavingStatus] = useState(null);
  const [validationNote, setValidationNote] = useState("");
  const [assignee, setAssignee] = useState("");

  const { data: finding, isLoading, isError } = useQuery({
    queryKey: ["exposureFinding", id],
    queryFn: () => base44.entities.ExposureFinding.get(id),
    enabled: !!id,
  });

  const { data: evidence = [], isLoading: evidenceLoading } = useQuery({
    queryKey: ["exposureEvidence", id],
    queryFn: () => base44.entities.ExposureEvidence.filter({ finding_id: id }, "-captured_date", 50),
    enabled: !!id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["exposureFinding", id] });
    qc.invalidateQueries({ queryKey: ["exposureFindings"] });
    qc.invalidateQueries({ queryKey: ["exposureEvidence", id] });
  };

  const changeStatus = async (newStatus) => {
    if (finding.status === newStatus) return;
    setSavingStatus(newStatus);
    try {
      const update = { status: newStatus };
      if (validationNote.trim()) {
        const stamp = new Date().toLocaleString();
        const entry = `[${stamp}] ${actor}: ${validationNote.trim()}`;
        update.validation_notes = finding.validation_notes
          ? `${finding.validation_notes}\n\n${entry}`
          : entry;
      }
      await base44.entities.ExposureFinding.update(id, update);
      setValidationNote("");
      refresh();
    } finally {
      setSavingStatus(null);
    }
  };

  const assign = async () => {
    if (!assignee.trim()) return;
    try {
      await base44.entities.ExposureFinding.update(id, { assigned_to: assignee.trim() });
      setAssignee("");
      refresh();
    } catch (_) {}
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !finding) {
    return (
      <div className="p-8 max-w-2xl">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ShieldAlert className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            This finding could not be found or has been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/exposure"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to findings
        </Link>
        <span className="text-xs font-mono text-muted-foreground">{finding.id}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <SeverityBadge severity={finding.severity} />
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${
              statusBadge[finding.status] || statusBadge.new
            }`}
          >
            {(finding.status || "new").replace("_", " ")}
          </span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {kindLabel[finding.kind] || finding.kind}
          </span>
          {finding.source_url && (
            <a
              href={finding.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <h1 className="text-xl font-bold leading-snug mb-2">
          {finding.title || "Untitled Finding"}
        </h1>
        {finding.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {finding.summary}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mt-4 text-xs text-muted-foreground">
          <span>Detected {relTime(finding.created_date)}</span>
          {finding.first_seen && <span>First seen {relTime(finding.first_seen)}</span>}
          {finding.last_seen && <span>Last seen {relTime(finding.last_seen)}</span>}
          {finding.attribution_status && (
            <span>Attribution: {finding.attribution_status}</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Exposed data */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Exposed Data</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Affected Identity
                </p>
                <p className="font-mono text-sm bg-muted/40 rounded-lg p-3">
                  {finding.affected_identity || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Credential Sample
                </p>
                <p className="font-mono text-sm bg-muted/40 rounded-lg p-3">
                  {finding.credential_sample || "—"}
                </p>
              </div>
              {finding.credential_hash && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Credential Fingerprint
                  </p>
                  <p className="font-mono text-xs bg-muted/40 rounded-lg p-3 break-all">
                    {finding.credential_hash}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 mt-4">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Sensitive data is masked by default. Use the evidence reveal action below to view
                full content — all reveals are audit-logged.
              </p>
            </div>
          </div>

          {/* Evidence */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Evidence ({evidence.length})</h3>
            </div>
            {evidenceLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : evidence.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No evidence records linked to this finding.
              </p>
            ) : (
              <div className="space-y-3">
                {evidence.map((ev) => (
                  <EvidenceReveal key={ev.id} evidence={ev} />
                ))}
              </div>
            )}
          </div>

          {/* Validation notes */}
          {finding.validation_notes && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-3">Validation Notes</h3>
              <pre className="whitespace-pre-wrap text-sm text-foreground/90 bg-muted/40 rounded-lg p-4 font-body leading-relaxed">
                {finding.validation_notes}
              </pre>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status workflow */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Status</h3>
            <div className="space-y-2 mb-4">
              {STATUS_FLOW.map((s) => {
                const active = finding.status === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => changeStatus(s.value)}
                    disabled={savingStatus === s.value || active}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "border-input hover:bg-accent disabled:opacity-50"
                    }`}
                  >
                    {savingStatus === s.value ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : active ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : s.value === "false_positive" ? (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-current opacity-40" />
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={validationNote}
              onChange={(e) => setValidationNote(e.target.value)}
              placeholder="Add a validation note (optional)…"
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            />
          </div>

          {/* Assignment */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Assignment</h3>
            </div>
            <p className="text-sm mb-3">
              {finding.assigned_to ? (
                <span className="text-foreground">{finding.assigned_to}</span>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </p>
            <div className="flex gap-2">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Analyst name"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={assign}
                disabled={!assignee.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Assign
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">Metadata</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Confidence</dt>
                <dd className="text-right">{finding.confidence || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Reliability</dt>
                <dd className="text-right">{finding.reliability || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Attribution</dt>
                <dd className="text-right">{finding.attribution_status || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Terms</dt>
                <dd className="text-right">{finding.terms_class || "—"}</dd>
              </div>
              {finding.fingerprint && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-border text-xs text-muted-foreground">
                  <Fingerprint className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{finding.fingerprint.slice(0, 20)}…</span>
                </div>
              )}
              {finding.retention_expires && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  Retention expires {relTime(finding.retention_expires)}
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}