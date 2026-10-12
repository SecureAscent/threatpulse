import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, ShieldCheck, Clock } from "lucide-react";

function maskContent(text) {
  if (!text) return "—";
  if (text.length <= 8) return "••••";
  return text.slice(0, 4) + "•".repeat(Math.min(text.length - 8, 24)) + text.slice(-4);
}

function relTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function EvidenceReveal({ evidence }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [revealing, setRevealing] = useState(false);
  const [error, setError] = useState(null);

  const isRevealed =
    evidence.revealed &&
    (!evidence.reveal_expires || new Date(evidence.reveal_expires).getTime() > Date.now());

  const handleReveal = async () => {
    setRevealing(true);
    setError(null);
    try {
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const auditEntry = `${user?.email || "analyst"} @ ${new Date().toISOString()}`;
      const newAudit = evidence.reveal_audit
        ? `${evidence.reveal_audit}\n${auditEntry}`
        : auditEntry;
      await base44.entities.ExposureEvidence.update(evidence.id, {
        revealed: true,
        reveal_expires: expires,
        reveal_audit: newAudit,
      });
      qc.invalidateQueries({ queryKey: ["exposureEvidence", evidence.finding_id] });
    } catch (e) {
      setError(e?.message || "Reveal failed — may require admin role");
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {isRevealed ? (
            <Eye className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {evidence.content_hash ? `Evidence #${evidence.content_hash.slice(0, 8)}` : "Evidence"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {evidence.captured_date && `Captured ${relTime(evidence.captured_date)}`}
              {evidence.terms_class && ` · ${evidence.terms_class}`}
            </p>
          </div>
        </div>
        {isRevealed ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" /> Revealed
          </span>
        ) : (
          <button
            onClick={handleReveal}
            disabled={revealing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors shrink-0"
          >
            {revealing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            Reveal
          </button>
        )}
      </div>
      <div className="rounded-md bg-muted/40 p-3">
        <p
          className={`text-sm font-mono leading-relaxed break-words ${
            isRevealed ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {isRevealed
            ? evidence.content_excerpt || "No content available"
            : maskContent(evidence.content_excerpt)}
        </p>
      </div>
      {isRevealed && evidence.reveal_expires && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <Clock className="w-3 h-3" /> Reveal expires {relTime(evidence.reveal_expires)}
        </p>
      )}
      {evidence.reveal_audit && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Reveal audit log
          </summary>
          <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap font-mono">
            {evidence.reveal_audit}
          </pre>
        </details>
      )}
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      {evidence.notes && (
        <p className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
          {evidence.notes}
        </p>
      )}
    </div>
  );
}