/**
 * NVD CVE feed (NIST National Vulnerability Database) — API v2.
 * https://services.nvd.nist.gov/rest/json/cves/2.0
 *
 * We pull CVEs modified within a recent lookback window (paginated) and map
 * CVSS base scores to ThreatPulse severities. An API key (NVD_API_KEY) raises
 * the public rate limit from 5 to 50 requests / 30s.
 */
import { ThreatRecord } from '../db';
import { createLogger } from '../logger';
import { getWithRetry } from './http';

const log = createLogger('nvd');

const NVD_URL =
  process.env.NVD_API_URL || 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const NVD_API_KEY = process.env.NVD_API_KEY || '';
const LOOKBACK_DAYS = Number(process.env.NVD_LOOKBACK_DAYS || 2);
const RESULTS_PER_PAGE = 200; // NVD max is 2000; keep pages modest.
const MAX_PAGES = Number(process.env.NVD_MAX_PAGES || 5);

interface NvdCvssData {
  baseScore?: number;
  baseSeverity?: string;
}
interface NvdMetric {
  cvssData?: NvdCvssData;
}
interface NvdCve {
  id: string;
  descriptions?: { lang: string; value: string }[];
  metrics?: {
    cvssMetricV31?: NvdMetric[];
    cvssMetricV30?: NvdMetric[];
    cvssMetricV2?: NvdMetric[];
  };
}
interface NvdVulnerability {
  cve: NvdCve;
}
interface NvdResponse {
  totalResults: number;
  vulnerabilities?: NvdVulnerability[];
}

function severityFromScore(score: number | null): string {
  if (score === null) return 'MEDIUM';
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

function extractCvss(cve: NvdCve): { score: number | null; severity: string } {
  const m =
    cve.metrics?.cvssMetricV31?.[0]?.cvssData ||
    cve.metrics?.cvssMetricV30?.[0]?.cvssData ||
    cve.metrics?.cvssMetricV2?.[0]?.cvssData;
  const score = typeof m?.baseScore === 'number' ? m.baseScore : null;
  const severity = m?.baseSeverity?.toUpperCase() || severityFromScore(score);
  // Normalize NVD "NONE"/unknown to our 4-level scale.
  const normalized = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity)
    ? severity
    : severityFromScore(score);
  return { score, severity: normalized };
}

export async function collectNvd(): Promise<ThreatRecord[]> {
  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const headers: Record<string, string> = {};
  if (NVD_API_KEY) headers.apiKey = NVD_API_KEY;

  log.info(
    `Fetching NVD CVEs modified in the last ${LOOKBACK_DAYS} day(s)` +
      (NVD_API_KEY ? ' (using API key).' : ' (no API key — lower rate limit).'),
  );

  const records: ThreatRecord[] = [];
  let startIndex = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = {
      lastModStartDate: start.toISOString(),
      lastModEndDate: now.toISOString(),
      resultsPerPage: RESULTS_PER_PAGE,
      startIndex,
    };

    let data: NvdResponse;
    try {
      data = await getWithRetry<NvdResponse>(NVD_URL, { params, headers });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`NVD request failed at startIndex=${startIndex}: ${msg}`);
      break;
    }

    const vulns = data.vulnerabilities ?? [];
    for (const { cve } of vulns) {
      if (!cve?.id) continue;
      const desc =
        cve.descriptions?.find((d) => d.lang === 'en')?.value ||
        cve.descriptions?.[0]?.value ||
        '';
      const { score, severity } = extractCvss(cve);
      records.push({
        threatId: cve.id,
        title: desc ? desc.slice(0, 140) : cve.id,
        type: 'CVE',
        severity,
        description: desc || null,
        affectedAssets: null,
        source: 'NVD',
        indicators: null,
        mitreTactic: null,
        mitreTechnique: null,
        cvssScore: score,
      });
    }

    startIndex += RESULTS_PER_PAGE;
    log.debug(`NVD page ${page + 1}: ${vulns.length} CVEs (total ${data.totalResults}).`);
    if (startIndex >= (data.totalResults || 0) || vulns.length === 0) break;

    // Respect rate limits between pages.
    await new Promise((r) => setTimeout(r, NVD_API_KEY ? 800 : 6500));
  }

  log.info(`Prepared ${records.length} NVD CVE records.`);
  return records;
}
