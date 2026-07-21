/**
 * ThreatPulse Risk Score
 *
 * A composite score (0-10) that blends CVSS severity, CISA KEV (known
 * exploited) status, and the qualitative severity band into a single,
 * prioritization-friendly number.
 *
 * Formula:
 *   base = (cvssScore / 10) * 0.5
 *        + (isKev ? 0.3 : 0)
 *        + (severity === 'CRITICAL' ? 0.2 : severity === 'HIGH' ? 0.1 : 0)
 *   score = min(base * 10, 10)
 */

export interface RiskScoreInput {
  cvssScore?: number | null;
  severity?: string | null;
  source?: string | null;
  // Optional explicit KEV flag; if omitted we infer it from `source`.
  isKev?: boolean | null;
}

/** Infer whether a threat is in the CISA KEV catalog from its source string. */
export function inferKev(source?: string | null): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return s.includes('kev') || s.includes('known exploited');
}

/** Compute the composite ThreatPulse Risk Score (0-10, one decimal place). */
export function computeRiskScore(input: RiskScoreInput): number {
  const cvss = typeof input.cvssScore === 'number' && !Number.isNaN(input.cvssScore)
    ? Math.max(0, Math.min(10, input.cvssScore))
    : 0;
  const isKev = input.isKev ?? inferKev(input.source);
  const severity = (input.severity || '').toUpperCase();

  const severityBoost = severity === 'CRITICAL' ? 0.2 : severity === 'HIGH' ? 0.1 : 0;

  const base = (cvss / 10) * 0.5 + (isKev ? 0.3 : 0) + severityBoost;
  const score = Math.min(base * 10, 10);
  return Math.round(score * 10) / 10;
}

/** Tailwind badge classes for a risk score band. */
export function riskScoreBadgeClass(score: number): string {
  if (score >= 8) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (score >= 6) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
  if (score >= 4) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
}

/** Human-readable band label for a risk score. */
export function riskScoreLabel(score: number): string {
  if (score >= 8) return 'Critical';
  if (score >= 6) return 'High';
  if (score >= 4) return 'Elevated';
  return 'Low';
}

/** Colored badge classes for a Cybellum asset risk score (0-10). */
export function assetRiskBadgeClass(score?: number | null): string {
  const s = typeof score === 'number' ? score : 0;
  if (s >= 7) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (s >= 4) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
}

// ===========================================================================
// ThreatPulse Composite Risk Score (0-100) — Intelligence engine (Track A)
// ===========================================================================
//
// A richer, exploitation-aware score than the legacy 0-10 `computeRiskScore`.
// It blends CVSS severity, EPSS exploitation probability, CISA KEV status,
// public exploit availability, recency, and an asset-exposure signal, then
// applies a per-severity floor so nothing critical slips below the fold.
//
// Point budget:
//   CVSS band         0-40   (cvss/10 * 40)
//   EPSS percentile   0-25   (epssPercentile * 25)
//   KEV               +20    (actively exploited in the wild)
//   Exploit available +10
//   Recency (<7d)     +5
//   Severity floor    CRITICAL>=60, HIGH>=40, MEDIUM>=20
//   Capped at 100.

export interface RiskFactors {
  cvssScore: number | null;
  epssScore: number | null;
  epssPercentile: number | null;
  isKev: boolean;
  exploitAvailable: boolean;
  severity: string;
  ageInDays: number;
  hasAffectedAssets: boolean;
}

/** Compute the composite ThreatPulse risk score on a 0-100 scale. */
export function calculateRiskScore(factors: RiskFactors): number {
  const cvss =
    typeof factors.cvssScore === 'number' && !Number.isNaN(factors.cvssScore)
      ? Math.max(0, Math.min(10, factors.cvssScore))
      : 0;
  const epssPct =
    typeof factors.epssPercentile === 'number' && !Number.isNaN(factors.epssPercentile)
      ? Math.max(0, Math.min(1, factors.epssPercentile))
      : 0;
  const severity = (factors.severity || '').toUpperCase();

  let score = 0;

  // Base from CVSS (0-10 → 0-40)
  score += (cvss / 10) * 40;

  // EPSS probability of exploitation (percentile → 0-25)
  score += epssPct * 25;

  // Actively exploited (CISA KEV)
  if (factors.isKev) score += 20;

  // Public exploit available
  if (factors.exploitAvailable) score += 10;

  // Recency bonus for fresh threats
  if (typeof factors.ageInDays === 'number' && factors.ageInDays >= 0 && factors.ageInDays < 7) {
    score += 5;
  }

  // Asset-exposure signal — small nudge when it touches known assets
  if (factors.hasAffectedAssets) score += 5;

  // Severity floors
  if (severity === 'CRITICAL') score = Math.max(score, 60);
  else if (severity === 'HIGH') score = Math.max(score, 40);
  else if (severity === 'MEDIUM') score = Math.max(score, 20);

  // Cap and round to one decimal
  score = Math.min(score, 100);
  return Math.round(score * 10) / 10;
}

/** Badge classes for the 0-100 composite score: green/orange/red bands. */
export function riskScore100BadgeClass(score?: number | null): string {
  const s = typeof score === 'number' ? score : 0;
  if (s >= 70) return 'bg-red-500/10 text-red-500 border-red-500/20';
  if (s >= 40) return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
  return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
}

/** Human-readable band for the 0-100 composite score. */
export function riskScore100Label(score?: number | null): string {
  const s = typeof score === 'number' ? score : 0;
  if (s >= 70) return 'Critical';
  if (s >= 40) return 'Elevated';
  return 'Low';
}

/** Compute age in days from a date-ish value (Date | string | number). */
export function ageInDaysFrom(date: Date | string | number | null | undefined): number {
  if (!date) return 9999;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return 9999;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}
