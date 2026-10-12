import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DAY_MS = 86400000;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Pull threats & products as the service role — no user auth required
    // (this is a public endpoint powering the investor pitch page).
    const threats = await base44.asServiceRole.entities.Threat.list('-created_date', 1000);
    const products = await base44.asServiceRole.entities.Product.list('-created_date', 500);

    const now = Date.now();
    const bySeverity = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    const sourceSet = new Set<string>();
    let withCve = 0;
    let last7Count = 0;
    let last30Count = 0;
    let minDate: number | null = null;
    let maxDate: number | null = null;

    const sevenDaysAgo = now - 7 * DAY_MS;
    const thirtyDaysAgo = now - 30 * DAY_MS;

    for (const t of threats) {
      const sev = (t.severity || 'Medium') as keyof typeof bySeverity;
      if (bySeverity[sev] !== undefined) bySeverity[sev]++;
      if (t.source) sourceSet.add(t.source);
      if (t.cve_id) withCve++;

      const cd = t.created_date ? new Date(t.created_date).getTime() : null;
      if (cd) {
        if (minDate === null || cd < minDate) minDate = cd;
        if (maxDate === null || cd > maxDate) maxDate = cd;
        if (cd >= sevenDaysAgo) last7Count++;
        if (cd >= thirtyDaysAgo) last30Count++;
      }
    }

    const total = threats.length;
    const spanDays = minDate !== null && maxDate !== null
      ? Math.max(1, Math.round((maxDate - minDate) / DAY_MS))
      : 0;

    // Daily ingestion: prefer last-7-day average; fall back to total/span.
    let dailyIngestion = 0;
    if (last7Count > 0) {
      dailyIngestion = Math.round((last7Count / 7) * 10) / 10;
    } else if (spanDays > 0) {
      dailyIngestion = Math.round((total / spanDays) * 10) / 10;
    }

    const criticalHigh = bySeverity.Critical + bySeverity.High;
    const criticalHighPct = total ? Math.round((criticalHigh / total) * 1000) / 10 : 0;
    const cveEnrichmentPct = total ? Math.round((withCve / total) * 1000) / 10 : 0;

    const activeProducts = products.filter((p: any) => p.status === 'Active').length;

    return Response.json({
      totalThreats: total,
      dailyIngestion,
      sources: sourceSet.size,
      criticalHighPct,
      cveEnrichmentPct,
      activeProducts,
      dataSpanDays: spanDays,
      last7Count,
      last30Count,
      severityBreakdown: bySeverity,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || 'Failed to fetch investor metrics.' },
      { status: 500 }
    );
  }
}