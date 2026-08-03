import React from "react";
import {
  History,
  Plus,
  ArrowRightLeft,
  UserCheck,
  MessageSquare,
  AlertTriangle,
  RotateCcw,
  Circle,
  ClipboardList,
} from "lucide-react";

const ACTION_META = {
  created: { label: "Created", icon: Plus, tone: "blue" },
  status_change: { label: "Status Change", icon: ArrowRightLeft, tone: "amber" },
  assign: { label: "Assignment", icon: UserCheck, tone: "violet" },
  note: { label: "Note", icon: MessageSquare, tone: "slate" },
  severity_change: { label: "Severity Change", icon: AlertTriangle, tone: "red" },
  reopen: { label: "Reopened", icon: RotateCcw, tone: "orange" },
  investigation_step: { label: "Investigation Step", icon: ClipboardList, tone: "teal" },
};

const TONES = {
  teal: { ring: "bg-primary/10 text-primary border-primary/30" },
  blue: { ring: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  amber: { ring: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  violet: { ring: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
  slate: { ring: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  red: { ring: "bg-red-500/10 text-red-500 border-red-500/20" },
  orange: { ring: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

function absTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function relTime(dateStr) {
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

export default function ActivityTimeline({ activity = [] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Audit Timeline</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {activity.length} event{activity.length === 1 ? "" : "s"}
        </span>
      </div>

      {activity.length === 0 ? (
        <div className="text-center py-8">
          <Circle className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No activity recorded yet. Status changes, assignments, and notes will appear here.
          </p>
        </div>
      ) : (
        <ol className="relative">
          {activity.map((a, idx) => {
            const meta = ACTION_META[a.action] || { label: a.action, icon: Circle, tone: "slate" };
            const tone = TONES[meta.tone] || TONES.slate;
            const Icon = meta.icon;
            const isLast = idx === activity.length - 1;
            const hasChange = Boolean(a.old_value || a.new_value);
            return (
              <li key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center border ${tone.ring}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  {!isLast && <span className="flex-1 w-px bg-border my-1" />}
                </div>
                <div className="pb-5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
                    <span className="text-xs text-muted-foreground">by {a.actor_name || "System"}</span>
                    <span className="text-xs text-muted-foreground ml-auto" title={absTime(a.created_date)}>
                      {relTime(a.created_date)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-1 break-words">{a.description}</p>
                  {hasChange && (
                    <div className="mt-2 flex items-center gap-2 text-xs font-mono flex-wrap">
                      {a.old_value ? (
                        <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground line-through">{a.old_value}</span>
                      ) : (
                        <span className="text-muted-foreground">empty</span>
                      )}
                      <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{a.new_value || "—"}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1.5 font-mono">{absTime(a.created_date)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}