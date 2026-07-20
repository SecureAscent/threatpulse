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
