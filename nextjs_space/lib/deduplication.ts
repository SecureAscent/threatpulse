/**
 * Source deduplication — Intelligence engine (Track A)
 *
 * Many feeds report the same underlying vulnerability (a CVE surfaced by KEV,
 * NVD and three news outlets). We collapse these into a single canonical
 * threat keyed by a normalised CVE id (the `dedupKey`), appending each new
 * source URL to the primary threat's `sourceUrls` rather than creating dupes.
 *
 * Non-CVE threats (generic news, TTPs without a CVE) have no stable key and
 * are left un-deduplicated (dedupKey = null).
 */
import { prisma } from '@/lib/db';

const CVE_REGEX = /CVE-\d{4}-\d{4,7}/i;

export interface DedupInput {
  threatId: string;
  title: string;
  type: string;
}

/**
 * Derive a canonical dedup key for a threat. Currently this is the normalised
 * CVE id (upper-cased) when present in the threatId or title; otherwise null.
 */
export function extractDedupKey(threat: DedupInput): string | null {
  const fromId = threat.threatId?.match(CVE_REGEX)?.[0];
  if (fromId) return fromId.toUpperCase();
  const fromTitle = threat.title?.match(CVE_REGEX)?.[0];
  if (fromTitle) return fromTitle.toUpperCase();
  return null;
}

/**
 * Find an existing threat that shares the given dedup key.
 *
 * The threat catalog is a GLOBAL shared dataset (all orgs see the same CVE /
 * KEV / NVD / feed data), so dedup is performed catalog-wide. The
 * `organizationId` argument is accepted for API compatibility and future
 * per-tenant scoping but is not used to restrict the lookup today.
 *
 * Returns the primary (non-duplicate) threat id, or null when none exists.
 */
export async function findDuplicate(
  dedupKey: string,
  _organizationId: string,
): Promise<string | null> {
  if (!dedupKey) return null;
  const existing = await prisma.threat.findFirst({
    // Prefer a primary (not itself a duplicate) match; fall back to any match.
    where: { dedupKey, duplicateOf: null },
    orderBy: { dateAdded: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const any = await prisma.threat.findFirst({
    where: { dedupKey },
    orderBy: { dateAdded: 'asc' },
    select: { id: true, duplicateOf: true },
  });
  return any?.duplicateOf ?? any?.id ?? null;
}

/** Merge a new source URL into a threat's sourceUrls array (deduplicated). */
export async function appendSourceUrl(
  threatId: string,
  sourceUrl: string | null | undefined,
): Promise<void> {
  if (!sourceUrl) return;
  const t = await prisma.threat.findUnique({
    where: { id: threatId },
    select: { sourceUrls: true },
  });
  if (!t) return;
  if (t.sourceUrls.includes(sourceUrl)) return;
  await prisma.threat.update({
    where: { id: threatId },
    data: { sourceUrls: { set: [...t.sourceUrls, sourceUrl] } },
  });
}
