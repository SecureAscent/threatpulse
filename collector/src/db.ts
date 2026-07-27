/**
 * Direct PostgreSQL access for the collector.
 *
 * The collector talks to the SAME database as the Next.js app but connects
 * directly with `pg` (no Prisma runtime) to keep the worker image small.
 * It writes into the Prisma-managed `"Threat"` table, matching that schema
 * exactly (quoted camelCase columns, app-generated ids, etc.).
 */
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { createLogger } from './logger';

const log = createLogger('db');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  log.error('DATABASE_URL is not set — cannot start collector.');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on('error', (err) => {
  log.error('Unexpected idle client error', err.message);
});

export function generateId(): string {
  return 'clc' + Date.now().toString(36) + randomBytes(8).toString('hex');
}

export async function waitForDatabase(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      log.info('Database connection established.');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`Database not ready (attempt ${attempt}/${retries}): ${msg}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('Could not connect to database after multiple attempts.');
}

/**
 * Resolve the explicit organization that collected threats are attached to.
 * This intentionally fails closed: it never chooses another organization when
 * COLLECTOR_ORG_SLUG is missing or invalid.
 */
export async function resolveOrganizationId(): Promise<string | null> {
  const slug = process.env.COLLECTOR_ORG_SLUG?.trim();
  if (!slug) {
    log.error('COLLECTOR_ORG_SLUG is required; refusing to select a tenant implicitly.');
    return null;
  }

  const bySlug = await pool.query<{ id: string }>(
    'SELECT id FROM "Organization" WHERE slug = $1 LIMIT 1',
    [slug],
  );
  if (bySlug.rows.length > 0) return bySlug.rows[0].id;

  log.error(`Organization slug "${slug}" was not found; collection will be skipped.`);
  return null;
}

export interface ThreatRecord {
  threatId: string;
  title: string;
  type: string;
  severity: string;
  description?: string | null;
  affectedAssets?: string | null;
  source?: string | null;
  indicators?: string | null;
  mitreTactic?: string | null;
  mitreTechnique?: string | null;
  cvssScore?: number | null;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Upsert a batch of threats using the tenant-scoped unique key.
 * Analyst workflow status is preserved on updates.
 */
export async function upsertThreats(
  records: ThreatRecord[],
  organizationId: string,
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0 };
  if (records.length === 0) return result;

  const client = await pool.connect();
  try {
    for (const r of records) {
      if (!r.threatId || !r.title) continue;
      const id = generateId();
      const now = new Date();
      const res = await client.query<{ inserted: boolean }>(
        `INSERT INTO "Threat" (
            id, "threatId", title, type, severity, status, description,
            "affectedAssets", source, indicators, "mitreTactic", "mitreTechnique",
            "cvssScore", "dateAdded", "lastUpdated", "organizationId"
         ) VALUES (
            $1, $2, $3, $4, $5, 'NEW', $6,
            $7, $8, $9, $10, $11,
            $12, $13, $13, $14
         )
         ON CONFLICT ("organizationId", "threatId") DO UPDATE SET
            title = EXCLUDED.title,
            type = EXCLUDED.type,
            severity = EXCLUDED.severity,
            description = EXCLUDED.description,
            "affectedAssets" = EXCLUDED."affectedAssets",
            source = EXCLUDED.source,
            indicators = EXCLUDED.indicators,
            "mitreTactic" = EXCLUDED."mitreTactic",
            "mitreTechnique" = EXCLUDED."mitreTechnique",
            "cvssScore" = EXCLUDED."cvssScore",
            "lastUpdated" = EXCLUDED."lastUpdated"
         RETURNING (xmax = 0) AS inserted`,
        [
          id,
          r.threatId.slice(0, 191),
          r.title.slice(0, 500),
          r.type,
          r.severity,
          r.description ?? null,
          r.affectedAssets ?? null,
          r.source ?? null,
          r.indicators ?? null,
          r.mitreTactic ?? null,
          r.mitreTechnique ?? null,
          r.cvssScore ?? null,
          now,
          organizationId,
        ],
      );
      if (res.rows[0]?.inserted) result.inserted++;
      else result.updated++;
    }
  } finally {
    client.release();
  }
  return result;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
