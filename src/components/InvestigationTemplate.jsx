import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { INVESTIGATION_STEPS } from "@/lib/investigationTemplate";
import { useToast } from "@/components/ui/use-toast";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  Play,
} from "lucide-react";

export default function InvestigationTemplate({ threatId, activity = [], actor, onRefresh }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null); // 'start' | step.key

  const stepEntries = activity.filter((a) => a.action === "investigation_step");
  const started = stepEntries.length > 0;

  // activity is sorted newest-first; a step is "done" when its latest logged
  // entry has new_value === "done", "pending" when seeded but not done.
  const statusOf = (step) => {
    const entries = stepEntries.filter(
      (a) => a.description && a.description.startsWith(step.label)
    );
    if (!entries.length) return started ? "pending" : "not_started";
    return entries[0].new_value === "done" ? "done" : "pending";
  };

  const statuses = INVESTIGATION_STEPS.map(statusOf);
  const completedCount = statuses.filter((s) => s === "done").length;

  const start = async () => {
    setBusy("start");
    try {
      await base44.entities.ThreatActivity.bulkCreate(
        INVESTIGATION_STEPS.map((s) => ({
          threat_id: threatId,
          action: "investigation_step",
          description: s.label,
          old_value: "",
          new_value: "pending",
          actor_name: actor,
        }))
      );
      toast({
        title: "Investigation template applied",
        description: `${INVESTIGATION_STEPS.length} mandatory steps logged to the audit timeline.`,
      });
      onRefresh();
    } catch (e) {
      toast({ title: "Failed to start investigation", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const completeStep = async (step) => {
    setBusy(step.key);
    try {
      await base44.entities.ThreatActivity.create({
        threat_id: threatId,
        action: "investigation_step",
        description: `${step.label} — completed`,
        old_value: "pending",
        new_value: "done",
        actor_name: actor,
      });
      toast({ title: `${step.label} marked complete` });
      onRefresh();
    } catch (e) {
      toast({ title: "Failed to update step", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  // Enforce sequential completion: a step is locked until the prior one is done.
  const canComplete = (idx) => idx === 0 || statuses[idx - 1] === "done";

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Investigation Template</h3>
        {started && (
          <span className="ml-auto text-xs text-muted-foreground">
            {completedCount}/{INVESTIGATION_STEPS.length} steps complete
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Standardized mandatory workflow. Each step is recorded in the audit timeline.
      </p>

      {!started ? (
        <button
          onClick={start}
          disabled={busy === "start"}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {busy === "start" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Apply Investigation Template
        </button>
      ) : (
        <ol className="relative">
          {INVESTIGATION_STEPS.map((step, idx) => {
            const st = statuses[idx];
            const locked = st !== "done" && !canComplete(idx);
            const isLast = idx === INVESTIGATION_STEPS.length - 1;
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-semibold ${
                      st === "done"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : locked
                        ? "bg-muted text-muted-foreground border-border"
                        : "bg-primary/10 text-primary border-primary/30"
                    }`}
                  >
                    {st === "done" ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                  </span>
                  {!isLast && <span className="flex-1 w-px bg-border my-1" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{step.label}</span>
                    {st === "done" && (
                      <span className="text-[10px] uppercase font-semibold text-emerald-500">Done</span>
                    )}
                    {st === "pending" && (
                      <span className="text-[10px] uppercase font-semibold text-amber-500">In Progress</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.guidance}</p>
                  {st !== "done" && (
                    <button
                      onClick={() => completeStep(step)}
                      disabled={locked || busy === step.key}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-input text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                      {busy === step.key ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {locked ? "Locked" : "Mark complete"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}