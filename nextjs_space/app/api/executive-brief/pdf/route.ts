import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { buildBriefData, type BriefData } from '@/lib/executive-brief';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sevColor(sev: string): string {
  switch ((sev || '').toUpperCase()) {
    case 'CRITICAL':
      return '#dc2626';
    case 'HIGH':
      return '#ea580c';
    case 'MEDIUM':
      return '#ca8a04';
    case 'LOW':
      return '#16a34a';
    default:
      return '#6b7280';
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function coverageColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#ca8a04';
  return '#dc2626';
}

function buildHtml(data: BriefData): string {
  const { summary } = data;

  const summaryCards = [
    { label: 'Total Threats', value: String(summary.totalThreats) },
    { label: 'Critical', value: String(summary.criticalCount) },
    { label: 'High', value: String(summary.highCount) },
    { label: 'New (7d)', value: String(summary.newThisWeek) },
    { label: 'Resolved (7d)', value: String(summary.resolvedThisWeek) },
    { label: 'Avg Risk', value: summary.avgRiskScore.toFixed(1) },
  ]
    .map(
      (c) => `
      <td class="metric">
        <div class="metric-value">${esc(c.value)}</div>
        <div class="metric-label">${esc(c.label)}</div>
      </td>`,
    )
    .join('');

  const topThreatRows = data.topThreats
    .map(
      (t, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td>${esc(t.title)}</td>
        <td><span class="sev" style="background:${sevColor(t.severity)}">${esc(t.severity)}</span></td>
        <td class="num">${t.riskScore.toFixed(1)}</td>
        <td>${t.isKev ? '<span class="kev">KEV</span>' : '—'}</td>
        <td class="num">${t.affectedAssetCount}</td>
        <td>${esc(t.status)}</td>
      </tr>`,
    )
    .join('');

  const productRows = data.affectedProducts
    .map(
      (p) => `
      <tr>
        <td>${esc(p.productName)}</td>
        <td>${esc(p.department)}</td>
        <td class="num">${p.threatCount}</td>
        <td class="num">${p.maxRisk.toFixed(1)}</td>
      </tr>`,
    )
    .join('');

  const complianceRows = data.complianceSnapshot
    .map(
      (c) => `
      <tr>
        <td>${esc(c.framework)}</td>
        <td>
          <div class="bar-track">
            <div class="bar-fill" style="width:${c.coveragePercent}%;background:${coverageColor(c.coveragePercent)}"></div>
          </div>
        </td>
        <td class="num" style="color:${coverageColor(c.coveragePercent)};font-weight:700">${c.coveragePercent}%</td>
      </tr>`,
    )
    .join('');

  const findings = data.keyFindings.map((f) => `<li>${esc(f)}</li>`).join('');
  const recs = data.recommendations.map((r) => `<li>${esc(r)}</li>`).join('');

  // Inline SVG risk trend line chart (last 30 days).
  const trend = data.riskTrend;
  const chartW = 720;
  const chartH = 180;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const maxRisk = Math.max(10, ...trend.map((d) => d.avgRisk));
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;
  const points = trend.map((d, i) => {
    const x = padL + (trend.length <= 1 ? 0 : (i / (trend.length - 1)) * innerW);
    const y = padT + innerH - (d.avgRisk / maxRisk) * innerH;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    points.length > 0
      ? `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${points[points.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} Z`
      : '';
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = Math.round(maxRisk * f * 10) / 10;
    const y = padT + innerH - f * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${chartW - padR}" y2="${y.toFixed(1)}" stroke="#e5e7eb" stroke-width="1"/>
      <text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#9ca3af">${val}</text>`;
  }).join('');
  const firstLabel = trend.length ? trend[0].date.slice(5) : '';
  const lastLabel = trend.length ? trend[trend.length - 1].date.slice(5) : '';

  const chartSvg = `
    <svg width="100%" viewBox="0 0 ${chartW} ${chartH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      ${yTicks}
      ${areaPath ? `<path d="${areaPath}" fill="rgba(37,99,235,0.10)" stroke="none"/>` : ''}
      ${linePath ? `<path d="${linePath}" fill="none" stroke="#2563eb" stroke-width="2"/>` : ''}
      ${points.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#2563eb"/>`).join('')}
      <text x="${padL}" y="${chartH - 6}" font-size="9" fill="#9ca3af">${esc(firstLabel)}</text>
      <text x="${chartW - padR}" y="${chartH - 6}" text-anchor="end" font-size="9" fill="#9ca3af">${esc(lastLabel)}</text>
    </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ThreatPulse Executive Briefing</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-size: 12px;
    line-height: 1.45;
  }
  .page { max-width: 820px; margin: 0 auto; padding: 32px 40px 48px; }
  .cover {
    background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
    color: #fff;
    border-radius: 12px;
    padding: 36px 40px;
    margin-bottom: 28px;
  }
  .cover .brand { font-size: 13px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.75; }
  .cover h1 { font-size: 28px; margin: 10px 0 6px; font-weight: 800; }
  .cover .sub { font-size: 13px; opacity: 0.85; }
  .cover .meta { margin-top: 18px; font-size: 11px; opacity: 0.7; }
  h2 {
    font-size: 15px;
    font-weight: 700;
    margin: 28px 0 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #e5e7eb;
    color: #0f172a;
  }
  table { width: 100%; border-collapse: collapse; }
  .metrics { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin-top: 4px; }
  .metric {
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    text-align: center;
    padding: 14px 6px;
    width: 16.6%;
  }
  .metric-value { font-size: 22px; font-weight: 800; color: #1e3a8a; }
  .metric-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-top: 2px; }
  .data-table th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    padding: 8px 8px;
  }
  .data-table td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  .data-table .idx { color: #9ca3af; width: 22px; }
  .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
  .sev { display: inline-block; color: #fff; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .kev { display: inline-block; background: #fee2e2; color: #b91c1c; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
  .bar-track { background: #f1f5f9; border-radius: 999px; height: 10px; width: 100%; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 999px; }
  .cols { display: flex; gap: 20px; }
  .col { flex: 1; }
  .callout { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; }
  .callout.findings { border-left: 4px solid #2563eb; }
  .callout.recs { border-left: 4px solid #16a34a; }
  .callout h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .callout ul { margin: 0; padding-left: 18px; }
  .callout li { margin-bottom: 6px; }
  .chart-box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
  .footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
  .print-hint { text-align: center; margin: 0 0 18px; }
  .print-btn {
    background: #2563eb; color: #fff; border: none; border-radius: 8px;
    padding: 10px 22px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  @media print {
    .print-hint { display: none; }
    .page { padding: 0; max-width: none; }
    body { font-size: 11px; }
    h2 { page-break-after: avoid; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="print-hint">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="cover">
      <div class="brand">ThreatPulse</div>
      <h1>Executive Security Briefing</h1>
      <div class="sub">Threat &amp; Vulnerability Posture Summary</div>
      <div class="meta">
        Reporting period: ${esc(fmtDate(data.period.start))} &ndash; ${esc(fmtDate(data.period.end))}<br/>
        Generated: ${esc(fmtDate(data.generatedAt))}
      </div>
    </div>

    <h2>Summary Metrics</h2>
    <table class="metrics"><tr>${summaryCards}</tr></table>

    <h2>30-Day Risk Trend</h2>
    <div class="chart-box">${chartSvg}</div>

    <div class="cols" style="margin-top:24px">
      <div class="col">
        <div class="callout findings">
          <h3 style="color:#2563eb">Key Findings</h3>
          <ul>${findings}</ul>
        </div>
      </div>
      <div class="col">
        <div class="callout recs">
          <h3 style="color:#16a34a">Recommendations</h3>
          <ul>${recs}</ul>
        </div>
      </div>
    </div>

    <h2>Top Threats by Risk</h2>
    <table class="data-table">
      <thead><tr><th></th><th>Threat</th><th>Severity</th><th class="num">Risk</th><th>KEV</th><th class="num">Assets</th><th>Status</th></tr></thead>
      <tbody>${topThreatRows || '<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:16px">No threats recorded.</td></tr>'}</tbody>
    </table>

    <h2>Most Affected Products</h2>
    <table class="data-table">
      <thead><tr><th>Product</th><th>Department</th><th class="num">Threats</th><th class="num">Max Risk</th></tr></thead>
      <tbody>${productRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px">No affected products.</td></tr>'}</tbody>
    </table>

    <h2>Compliance Coverage</h2>
    <table class="data-table">
      <thead><tr><th style="width:180px">Framework</th><th>Coverage</th><th class="num" style="width:60px"></th></tr></thead>
      <tbody>${complianceRows}</tbody>
    </table>

    <div class="footer">
      ThreatPulse Executive Briefing &middot; Confidential &middot; Generated ${esc(fmtDate(data.generatedAt))}
    </div>
  </div>
</body>
</html>`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as any;
  const isSuper = user?.role === 'SUPERADMIN';
  const orgId = user?.organizationId as string | undefined;

  if (!isSuper && !orgId) {
    return NextResponse.json({ error: 'No organization associated with user' }, { status: 400 });
  }

  try {
    const data = await buildBriefData({ isSuper, orgId });
    const html = buildHtml(data);
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[executive-brief/pdf] failed to build brief', err);
    return NextResponse.json({ error: 'Failed to build executive brief PDF' }, { status: 500 });
  }
}
