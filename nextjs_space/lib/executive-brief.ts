import { prisma } from '@/lib/db';
import { FRAMEWORK_LABELS, CONTROL_CATALOG, PRIMARY_FRAMEWORKS } from '@/lib/compliance-mappings';

export interface BriefData {
  generatedAt: string;
  period: { start: string; end: string };
  summary: {
    totalThreats: number;
    criticalCount: number;
    highCount: number;
    newThisWeek: number;
    resolvedThisWeek: number;
    avgRiskScore: number;
  };
  topThreats: {
    id: string;
    title: string;
    severity: string;
    riskScore: number;
    status: string;
    isKev: boolean;
    affectedAssetCount: number;
  }[];
  riskTrend: { date: string; avgRisk: number; count: number }[];
  affectedProducts: { productName: string; department: string; threatCount: number; maxRisk: number }[];
  complianceSnapshot: { framework: string; coveragePercent: number }[];
  keyFindings: string[];
  recommendations: string[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Builds the full executive briefing dataset for a given scope.
// scope: SUPERADMIN => all orgs (orgId ignored); otherwise scoped to orgId.
export async function buildBriefData(opts: { isSuper: boolean; orgId?: string | null }): Promise<BriefData> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const orgWhere: any = opts.isSuper || !opts.orgId ? {} : { organizationId: opts.orgId };

  const threats = await prisma.threat.findMany({
    where: orgWhere,
    select: {
      id: true,
      title: true,
      threatId: true,
      severity: true,
      status: true,
      riskScore: true,
      isKev: true,
      dateAdded: true,
      lastUpdated: true,
      assetLinks: { select: { id: true } },
    },
    orderBy: { riskScore: 'desc' },
  });

  const totalThreats = threats.length;
  const criticalCount = threats.filter((t) => (t.severity || '').toUpperCase() === 'CRITICAL').length;
  const highCount = threats.filter((t) => (t.severity || '').toUpperCase() === 'HIGH').length;
  const newThisWeek = threats.filter((t) => t.dateAdded && new Date(t.dateAdded) >= weekAgo).length;
  const resolvedThisWeek = threats.filter(
    (t) => (t.status || '').toUpperCase() === 'RESOLVED' && t.lastUpdated && new Date(t.lastUpdated) >= weekAgo,
  ).length;
  const riskVals = threats.map((t) => t.riskScore ?? 0).filter((v) => v > 0);
  const avgRiskScore = riskVals.length > 0 ? riskVals.reduce((a, b) => a + b, 0) / riskVals.length : 0;

  const topThreats = threats.slice(0, 10).map((t) => ({
    id: t.id,
    title: t.title || t.threatId,
    severity: t.severity,
    riskScore: t.riskScore ?? 0,
    status: t.status,
    isKev: t.isKev,
    affectedAssetCount: t.assetLinks.length,
  }));

  // Daily risk trend for last 30 days.
  const buckets = new Map<string, { sum: number; count: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(dayKey(d), { sum: 0, count: 0 });
  }
  for (const t of threats) {
    if (!t.dateAdded) continue;
    const k = dayKey(new Date(t.dateAdded));
    const b = buckets.get(k);
    if (b) {
      b.sum += t.riskScore ?? 0;
      b.count += 1;
    }
  }
  const riskTrend = Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    avgRisk: v.count > 0 ? Math.round((v.sum / v.count) * 10) / 10 : 0,
    count: v.count,
  }));

  // Affected products (assets) with threat counts and max risk.
  const assets = await prisma.cybellumAsset.findMany({
    where: opts.isSuper || !opts.orgId ? {} : { organizationId: opts.orgId },
    select: {
      productName: true,
      department: true,
      riskScore: true,
      threatLinks: {
        select: { threat: { select: { riskScore: true } } },
      },
    },
  });
  const affectedProducts = assets
    .map((a) => {
      const linkRisks = a.threatLinks.map((l) => l.threat?.riskScore ?? 0);
      const maxLinkRisk = linkRisks.length ? Math.max(...linkRisks) : 0;
      return {
        productName: a.productName,
        department: a.department || '—',
        threatCount: a.threatLinks.length,
        maxRisk: Math.max(maxLinkRisk, a.riskScore ?? 0),
      };
    })
    .filter((p) => p.threatCount > 0)
    .sort((a, b) => b.maxRisk - a.maxRisk || b.threatCount - a.threatCount)
    .slice(0, 10);

  // Compliance snapshot from ComplianceTag coverage.
  const tags = await prisma.complianceTag.findMany({
    where: { threat: orgWhere },
    select: { framework: true, controlId: true },
  });
  const coveredByFw = new Map<string, Set<string>>();
  for (const t of tags) {
    if (!coveredByFw.has(t.framework)) coveredByFw.set(t.framework, new Set());
    coveredByFw.get(t.framework)!.add(t.controlId);
  }
  const complianceSnapshot = PRIMARY_FRAMEWORKS.map((fw) => {
    const total = CONTROL_CATALOG.filter((c) => c.framework === fw).length;
    const covered = coveredByFw.get(fw)?.size ?? 0;
    return {
      framework: FRAMEWORK_LABELS[fw] ?? fw,
      coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
    };
  });

  // Auto-generated key findings.
  const keyFindings: string[] = [];
  const kevCount = threats.filter((t) => t.isKev).length;
  const criticalKev = threats.filter((t) => t.isKev && (t.severity || '').toUpperCase() === 'CRITICAL').length;
  if (criticalKev > 0) {
    keyFindings.push(`${criticalKev} CRITICAL known-exploited (KEV) vulnerabilit${criticalKev === 1 ? 'y requires' : 'ies require'} immediate patching.`);
  }
  if (criticalCount > 0) {
    keyFindings.push(`${criticalCount} CRITICAL threat${criticalCount === 1 ? '' : 's'} currently tracked across the environment.`);
  }
  if (affectedProducts.length > 0) {
    const top = affectedProducts[0];
    keyFindings.push(`${top.productName} has the highest risk exposure at ${top.maxRisk.toFixed(1)} (${top.threatCount} linked threat${top.threatCount === 1 ? '' : 's'}).`);
  }
  if (newThisWeek > 0) {
    keyFindings.push(`${newThisWeek} new threat${newThisWeek === 1 ? '' : 's'} identified in the past 7 days.`);
  }
  const lowestFw = [...complianceSnapshot].sort((a, b) => a.coveragePercent - b.coveragePercent)[0];
  if (lowestFw) {
    keyFindings.push(`${lowestFw.framework} has the lowest compliance coverage at ${lowestFw.coveragePercent}%.`);
  }
  if (keyFindings.length === 0) {
    keyFindings.push('No significant threat activity detected in the reporting period.');
  }

  // Auto-generated recommendations.
  const recommendations: string[] = [];
  if (criticalKev > 0 || kevCount > 0) {
    recommendations.push(`Prioritize remediation of ${kevCount} KEV-listed vulnerabilit${kevCount === 1 ? 'y' : 'ies'} — these are actively exploited in the wild.`);
  }
  if (criticalCount + highCount > 0) {
    recommendations.push(`Establish SLAs to resolve the ${criticalCount + highCount} open CRITICAL/HIGH threats within defined timeframes.`);
  }
  if (affectedProducts.length > 0) {
    recommendations.push(`Focus asset-hardening efforts on ${affectedProducts[0].productName} and other high-exposure products.`);
  }
  if (lowestFw && lowestFw.coveragePercent < 80) {
    recommendations.push(`Close compliance gaps in ${lowestFw.framework} by mapping and remediating uncovered controls.`);
  }
  if (avgRiskScore >= 6) {
    recommendations.push(`Average risk score is elevated at ${avgRiskScore.toFixed(1)} — increase monitoring cadence and patch velocity.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Maintain current monitoring posture and continue routine vulnerability triage.');
  }

  return {
    generatedAt: now.toISOString(),
    period: { start: start.toISOString(), end: now.toISOString() },
    summary: {
      totalThreats,
      criticalCount,
      highCount,
      newThisWeek,
      resolvedThisWeek,
      avgRiskScore: Math.round(avgRiskScore * 10) / 10,
    },
    topThreats,
    riskTrend,
    affectedProducts,
    complianceSnapshot,
    keyFindings: keyFindings.slice(0, 5),
    recommendations: recommendations.slice(0, 5),
  };
}
