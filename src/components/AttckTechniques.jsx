import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Crosshair, Loader2, Sparkles, ExternalLink } from "lucide-react";

function parseTechniques(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t) => t && typeof t.id === "string")
        .map((t) => ({ id: t.id, name: t.name || "", tactic: t.tactic || "" }));
    }
  } catch { /* legacy format */ }
  // legacy: comma-separated IDs
  return String(raw)
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^T\d{4}(\.\d{3})?$/.test(id))
    .map((id) => ({ id, name: "", tactic: "" }));
}

export default function AttckTechniques({ threat, actorId }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const recordId = threat?.id || actorId;
  const techniques = parseTechniques(threat?.attack_techniques);

  const autoMap = async () => {
    if (!recordId) return;
    setBusy(true);
    setError("");
    try {
      const payload = threat ? { threat_id: recordId } : { actor_id: recordId };
      await base44.functions.invoke("enrichAttackTechniques", payload);
      qc.invalidateQueries({ queryKey: ["threat", recordId] });
      qc.invalidateQueries({ queryKey: ["threats"] });
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Mapping failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">MITRE ATT&CK Techniques</h3>
        </div>
        <button
          onClick={autoMap}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy ? "Mapping…" : techniques.length ? "Re-map" : "Auto-map"}
        </button>
      </div>

      {techniques.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No techniques mapped yet. Click <span className="font-medium">Auto-map</span> to suggest ATT&CK techniques via AI analysis of this threat.
        </p>
      ) : (
        <div className="space-y-2.5">
          {techniques.map((t) => (
            <div key={t.id} className="flex items-start gap-2.5">
              <a
                href={`https://attack.mitre.org/techniques/${t.id.replace(".", "/")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline shrink-0 mt-0.5"
              >
                {t.id} <ExternalLink className="w-3 h-3" />
              </a>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{t.name || "—"}</p>
                {t.tactic && <p className="text-xs text-muted-foreground">{t.tactic}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
    </div>
  );
}