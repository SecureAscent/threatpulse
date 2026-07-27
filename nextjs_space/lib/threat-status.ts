/**
 * Threat status lifecycle (Track B — Analyst Workflow).
 *
 * The full lifecycle is:
 *   NEW → UNDER_REVIEW → ACTION_REQUIRED → IN_PROGRESS → MITIGATED
 *                                                     → ACCEPTED_RISK
 *                                                     → NOT_RELEVANT
 *
 * Legacy statuses (INVESTIGATING, RESOLVED) that predate this track are kept
 * so historical data and the collector's upsert logic keep rendering cleanly.
 */

export type ThreatStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'ACTION_REQUIRED'
  | 'IN_PROGRESS'
  | 'MITIGATED'
  | 'ACCEPTED_RISK'
  | 'NOT_RELEVANT'
  // legacy
  | 'INVESTIGATING'
  | 'RESOLVED';

export interface StatusMeta {
  value: string;
  label: string;
  /** Tailwind badge classes. */
  badge: string;
  /** Hex used by recharts/legends. */
  color: string;
  /** True when the threat has moved beyond the "NEW" inbox. */
  actioned: boolean;
  /** True when the threat is in a closed/terminal state. */
  terminal: boolean;
  /** Legacy statuses are hidden from the primary lifecycle dropdown. */
  legacy?: boolean;
}

export const THREAT_STATUS_META: Record<string, StatusMeta> = {
  NEW: {
    value: 'NEW',
    label: 'New',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    color: '#38bdf8',
    actioned: false,
    terminal: false,
  },
  UNDER_REVIEW: {
    value: 'UNDER_REVIEW',
    label: 'Under Review',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    color: '#a78bfa',
    actioned: true,
    terminal: false,
  },
  ACTION_REQUIRED: {
    value: 'ACTION_REQUIRED',
    label: 'Action Required',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    color: '#f87171',
    actioned: true,
    terminal: false,
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    color: '#fbbf24',
    actioned: true,
    terminal: false,
  },
  MITIGATED: {
    value: 'MITIGATED',
    label: 'Mitigated',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    color: '#34d399',
    actioned: true,
    terminal: true,
  },
  ACCEPTED_RISK: {
    value: 'ACCEPTED_RISK',
    label: 'Accepted Risk',
    badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    color: '#2dd4bf',
    actioned: true,
    terminal: true,
  },
  NOT_RELEVANT: {
    value: 'NOT_RELEVANT',
    label: 'Not Relevant',
    badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    color: '#94a3b8',
    actioned: true,
    terminal: true,
  },
  // --- legacy ---
  INVESTIGATING: {
    value: 'INVESTIGATING',
    label: 'Investigating',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    color: '#a78bfa',
    actioned: true,
    terminal: false,
    legacy: true,
  },
  RESOLVED: {
    value: 'RESOLVED',
    label: 'Resolved',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    color: '#34d399',
    actioned: true,
    terminal: true,
    legacy: true,
  },
};

/** Canonical lifecycle order for dropdowns / pipeline views (excludes legacy). */
export const THREAT_STATUS_ORDER: string[] = [
  'NEW',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'IN_PROGRESS',
  'MITIGATED',
  'ACCEPTED_RISK',
  'NOT_RELEVANT',
];

/** All valid status values, including legacy ones (used for API validation). */
export const ALL_THREAT_STATUSES: string[] = Object.keys(THREAT_STATUS_META);

export function statusMeta(status: string | null | undefined): StatusMeta {
  const key = (status || 'NEW').toUpperCase();
  return (
    THREAT_STATUS_META[key] ?? {
      value: key,
      label: key,
      badge: 'bg-muted text-muted-foreground border-border',
      color: '#94a3b8',
      actioned: key !== 'NEW',
      terminal: false,
    }
  );
}

export function statusLabel(status: string | null | undefined): string {
  return statusMeta(status).label;
}

export function statusBadgeClass(status: string | null | undefined): string {
  return statusMeta(status).badge;
}

export function isValidStatus(status: string): boolean {
  return ALL_THREAT_STATUSES.includes((status || '').toUpperCase());
}

/** True when a threat has been actioned (moved beyond NEW). */
export function isActionedStatus(status: string | null | undefined): boolean {
  return statusMeta(status).actioned;
}

/** True when a threat is in a terminal/closed state. */
export function isTerminalStatus(status: string | null | undefined): boolean {
  return statusMeta(status).terminal;
}

/** A threat is overdue when it has a future-less due date and is not terminal. */
export function isOverdue(
  dueDate: string | Date | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!dueDate) return false;
  if (isTerminalStatus(status)) return false;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return false;
  return due < Date.now();
}
