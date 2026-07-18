/**
 * Direct PostgreSQL access for the collector.
 *
 * The collector talks to the same database as the Next.js app but connects
 * directly with pg. All writes must remain explicitly organization-scoped.
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

export async function waitForDatabase(
  retries = 30,
  delayMs = 2000,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      log.info('Database connection established.');
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`Database not ready (attempt ${attempt}/${retries}): ${msg}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Could not connect to database after multiple attempts.');
}

/**
 * Resolve the explicitly configured organization for collector writes.
 *
 * The collector never falls back to another organization. A missing or
 * misspelled COLLECTOR_ORG_SLUG therefore fails closed instead of routing
 * intelligence to the wrong tenant.
 */
export async function resolveOrganizationId(): Promise<string | null> {
  const slug = String(process.env.COLLECTOR_ORG_SLUG || '').trim();
  if (!slug) {
    log.error('COLLECTOR_ORG_SLUG is required; refusing to select a tenant implicitly.');
    return null;
  }

  const result = await pool.query<{ id: string }>(
    'SELECT id FROM "Organization" WHERE slug = $1 LIMIT 1',
    [slug],
  );

  if (result.rows.length === 0) {
    log.error(`Organization slug "${slug}" was not found; collection is disabled for this cycle.`);
    return null;
  }

  return result.rows[0].id;
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

export async function upsertThreats(
  records: ThreatRecord[],
  organizationId: string,
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0 };
  if (records.length === 0) return result;

  const client = await pool.connect();
  try {
    for (const record of records) {
      if (!record.threatId || !record.title) continue;

      const id = generateId();
      const now = new Date();
      const response = await client.query<{ inserted: boolean }>(
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
          record.threatId.slice(0, 191),
          record.title.slice(0, 500),
          record.type,
          record.severity,
          record.description ?? null,
          record.affectedAssets ?? null,
          record.source ?? null,
          record.indicators ?? null,
          record.mitreTactic ?? null,
          record.mitreTechnique ?? null,
          record.cvssScore ?? null,
          now,
          organizationId,
        ],
      );

      if (response.rows[0]?.inserted) result.inserted++;
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
