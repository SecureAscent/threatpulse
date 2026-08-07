import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Archive, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export default function RetentionHealth() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [error, setError] = useState("");

  const { data: threats = [], isLoading } = useQuery({
    queryKey: ["threats", "retention"],
    queryFn: () => base44.entities.Threat.list("-created_date", 500),
  });

  const archived = threats.filter((t) => t.archived).length;
  const active = threats.length - archived;
  const criticalActive = threats.filter(
    (t) => !t.archived && (t.severity === "Critical" || t.severity === "High") && t.status !== "Mitigated"
  ).length;
  const archivedPct = threats.length ? Math.round((archived / threats.length) * 100) : 0;

  const runArchival = async () => {
    setRunning(true);
    setRunResult(null);
    setError("");
    try {
      const res = await base44.functions.invoke("archiveStaleThreats", {});
      setRunResult(res.data);
      qc.invalidateQueries({ queryKey: ["threats"] });
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Archival failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Archive className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold">Retention Health</h3>
            <p className="text-xs text-muted-foreground">90-day rolling window · 30-day news · 90-day CVEs</p>
          </div>
        </div>
        <button
          onClick={runArchival}
          disabled={running}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {running ? "Archiving…" : "Run archival now"}
        </button>
      </div>

      {isLoading ? (
        <div className="h-16 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-foreground">{active}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Archived</p>
              <p className="text-xl font-bold text-muted-foreground">{archived}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Critical/High open</p>
              <p className="text-xl font-bold text-red-500">{criticalActive}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Archived %</p>
              <p className="text-xl font-bold text-foreground">{archivedPct}%</p>
            </div>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${100 - archivedPct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {criticalActive > 0
              ? `${criticalActive} unresolved Critical/High threat${criticalActive !== 1 ? "s" : ""} preserved past retention.`
              : "No unresolved Critical/High threats being preserved past retention."}
          </p>

          {runResult && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-muted-foreground">
                Scanned <span className="font-semibold text-foreground">{runResult.scanned}</span> ·
                Archived <span className="font-semibold text-foreground">{runResult.archived}</span> ·
                Preserved <span className="font-semibold text-foreground">{runResult.skipped_critical_unresolved}</span> critical
              </span>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}