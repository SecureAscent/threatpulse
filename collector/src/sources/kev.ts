/**
 * CISA Known Exploited Vulnerabilities (KEV) catalog.
 * https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 *
 * Every entry is a CVE that is being actively exploited in the wild, so we
 * classify them as CVE / HIGH by default (ransomware-linked -> CRITICAL).
 */
import { ThreatRecord } from '../db';
import { createLogger } from '../logger';
import { getWithRetry } from './http';

const log = createLogger('kev');

const KEV_URL =
  process.env.CISA_KEV_URL ||
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

interface KevVuln {
  cveID: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  knownRansomwareCampaignUse?: string;
}

interface KevFeed {
  vulnerabilities?: KevVuln[];
}

// How many of the most-recently-added KEV entries to ingest per run.
const KEV_LIMIT = Number(process.env.KEV_LIMIT || 150);

export async function collectKev(): Promise<ThreatRecord[]> {
  log.info(`Fetching CISA KEV catalog: ${KEV_URL}`);
  const data = await getWithRetry<KevFeed>(KEV_URL);
  const vulns = data.vulnerabilities ?? [];
  log.info(`KEV catalog contains ${vulns.length} vulnerabilities.`);

  // Newest additions first, then cap.
  const sorted = [...vulns].sort((a, b) =>
    (b.dateAdded || '').localeCompare(a.dateAdded || ''),
  );

  const records: ThreatRecord[] = sorted.slice(0, KEV_LIMIT).map((v) => {
    const ransomware =
      (v.knownRansomwareCampaignUse || '').toLowerCase() === 'known';
    const assetParts = [v.vendorProject, v.product].filter(Boolean);
    const descParts = [
      v.shortDescription,
      v.requiredAction ? `Required action: ${v.requiredAction}` : null,
      ransomware ? 'Known to be used in ransomware campaigns.' : null,
    ].filter(Boolean);

    return {
      threatId: v.cveID,
      title: v.vulnerabilityName || v.cveID,
      type: 'CVE',
      severity: ransomware ? 'CRITICAL' : 'HIGH',
      description: descParts.join(' ') || null,
      affectedAssets: assetParts.length ? assetParts.join(' / ') : null,
      source: 'CISA KEV',
      indicators: null,
      mitreTactic: null,
      mitreTechnique: null,
      cvssScore: null,
    };
  });

  log.info(`Prepared ${records.length} KEV records.`);
  return records;
}
