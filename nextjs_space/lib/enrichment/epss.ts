/**
 * EPSS enrichment — Intelligence engine (Track A)
 *
 * EPSS (Exploit Prediction Scoring System) estimates the probability that a
 * CVE will be exploited in the wild in the next 30 days. FIRST.org exposes it
 * as a free, key-less API that accepts up to ~100 CVE ids per request:
 *
 *   https://api.first.org/data/v1/epss?cve=CVE-2021-44228,CVE-2021-45046
 *
 * This module extracts CVE ids from threat fields and fetches EPSS scores in
 * batches, failing soft so a slow/unavailable upstream never breaks ingestion.
 */

const EPSS_ENDPOINT = 'https://api.first.org/data/v1/epss';
const BATCH_SIZE = 100;
const REQUEST_TIMEOUT_MS = 15_000;

const CVE_REGEX = /CVE-\d{4}-\d{4,7}/i;
const CVE_REGEX_GLOBAL = /CVE-\d{4}-\d{4,7}/gi;

export interface EpssScore {
  probability: number; // 0-1
  percentile: number; // 0-1
}

/** Extract and normalise the first CVE id found in the given strings. */
export function extractCveId(...fields: (string | null | undefined)[]): string | null {
  for (const field of fields) {
    if (!field) continue;
    const m = field.match(CVE_REGEX);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

/** Extract ALL distinct CVE ids found across the given strings. */
export function extractAllCveIds(...fields: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const field of fields) {
    if (!field) continue;
    const matches = field.match(CVE_REGEX_GLOBAL) ?? [];
    for (const m of matches) found.add(m.toUpperCase());
  }
  return Array.from(found);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchBatch(cveIds: string[]): Promise<Map<string, EpssScore>> {
  const result = new Map<string, EpssScore>();
  if (cveIds.length === 0) return result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${EPSS_ENDPOINT}?cve=${encodeURIComponent(cveIds.join(','))}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      // EPSS data changes at most daily; let the platform cache briefly.
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`EPSS API returned HTTP ${res.status}`);
    }
    const json: any = await res.json();
    const rows: any[] = Array.isArray(json?.data) ? json.data : [];
    for (const row of rows) {
      const cve = String(row?.cve || '').toUpperCase();
      const probability = Number(row?.epss);
      const percentile = Number(row?.percentile);
      if (cve && !Number.isNaN(probability) && !Number.isNaN(percentile)) {
        result.set(cve, { probability, percentile });
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return result;
}

/**
 * Fetch EPSS scores for a list of CVE ids. Batches into groups of 100 and
 * fails soft per batch — a failed batch is logged and simply omitted from the
 * result map rather than throwing.
 */
export async function fetchEpssScores(
  cveIds: string[],
): Promise<Map<string, EpssScore>> {
  const unique = Array.from(new Set(cveIds.map((c) => c.toUpperCase()).filter(Boolean)));
  const result = new Map<string, EpssScore>();
  if (unique.length === 0) return result;

  for (const batch of chunk(unique, BATCH_SIZE)) {
    try {
      const scores = await fetchBatch(batch);
      for (const [cve, score] of scores) result.set(cve, score);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fail soft: skip this batch, keep whatever we already have.
      console.warn(`[epss] batch of ${batch.length} failed: ${msg}`);
    }
  }
  return result;
}
