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

/**
 * Prisma generates `cuid()` ids in the application layer, so the DB column has
 * no default. We generate a compatible collision-resistant id here.
 */
export function generateId(): string {
  return 'clc' + Date.now().toString(36) + randomBytes(8).toString('hex');
}

/** Wait until the database is reachable (Postgres may still be starting). */
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
 * Resolve the organization that collected threats are attached to.
 * Threats are org-scoped, so the collector needs a target org.
 *   - Prefers COLLECTOR_ORG_SLUG (default "threatpulse-demo")
 *   - Falls back to the oldest organization in the table
 * Returns null if no organization exists yet (app seeds one on first boot).
 */
export async function resolveOrganizationId(): Promise<string | null> {
  const slug = process.env.COLLECTOR_ORG_SLUG || 'threatpulse-demo';

  const bySlug = await pool.query<{ id: string }>(
    'SELECT id FROM "Organization" WHERE slug = $1 LIMIT 1',
    [slug],
  );
  if (bySlug.rows.length > 0) return bySlug.rows[0].id;

  const first = await pool.query<{ id: string }>(
    'SELECT id FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1',
  );
  if (first.rows.length > 0) {
    log.warn(`Org slug "${slug}" not found; using oldest organization instead.`);
    return first.rows[0].id;
  }

  return null;
}

/** Normalized threat record ready to upsert. */
export interface ThreatRecord {
  threatId: string;
  title: string;
  type: string; // CVE | IOC | TTP | NEWS
  severity: string; // CRITICAL | HIGH | MEDIUM | LOW
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
 * Upsert a batch of threats keyed by the unique (organizationId, threatId).
 * On conflict we refresh the intelligence fields but PRESERVE the analyst's
 * workflow `status` (NEW / INVESTIGATING / RESOLVED) so collection never
 * clobbers triage work.
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

// ---------------------------------------------------------------------------
// CollectorRun observability (Track A)
// ---------------------------------------------------------------------------
//
// The collector records one CollectorRun row per source, per cycle. The row is
// created when a source starts ("running") and finalized on success/error so
// the app's Collector Health dashboard can show live status.

export interface RunTotals {
  itemsFound?: number;
  itemsNew?: number;
  itemsUpdated?: number;
  itemsSkipped?: number;
}

/** Insert a "running" CollectorRun and return its id. */
export async function startCollectorRun(source: string): Promise<string | null> {
  try {
    const id = generateId();
    await pool.query(
      `INSERT INTO "CollectorRun" (id, source, status, "startedAt", "itemsFound", "itemsNew", "itemsUpdated", "itemsSkipped")
       VALUES ($1, $2, 'running', NOW(), 0, 0, 0, 0)`,
      [id, source],
    );
    return id;
  } catch (err) {
    log.warn(`Could not record CollectorRun start for "${source}": ${errMsg(err)}`);
    return null;
  }
}

/** Finalize a CollectorRun as success with item counts and duration. */
export async function completeCollectorRun(
  id: string | null,
  totals: RunTotals,
  startedAtMs: number,
): Promise<void> {
  if (!id) return;
  try {
    await pool.query(
      `UPDATE "CollectorRun" SET
          status = 'success',
          "completedAt" = NOW(),
          "itemsFound" = $2,
          "itemsNew" = $3,
          "itemsUpdated" = $4,
          "itemsSkipped" = $5,
          "durationMs" = $6
       WHERE id = $1`,
      [
        id,
        totals.itemsFound ?? 0,
        totals.itemsNew ?? 0,
        totals.itemsUpdated ?? 0,
        totals.itemsSkipped ?? 0,
        Date.now() - startedAtMs,
      ],
    );
  } catch (err) {
    log.warn(`Could not record CollectorRun completion (${id}): ${errMsg(err)}`);
  }
}

/** Finalize a CollectorRun as error with the message and duration. */
export async function failCollectorRun(
  id: string | null,
  errorMessage: string,
  startedAtMs: number,
): Promise<void> {
  if (!id) return;
  try {
    await pool.query(
      `UPDATE "CollectorRun" SET
          status = 'error',
          "completedAt" = NOW(),
          "errorMessage" = $2,
          "durationMs" = $3
       WHERE id = $1`,
      [id, errorMessage.slice(0, 1000), Date.now() - startedAtMs],
    );
  } catch (err) {
    log.warn(`Could not record CollectorRun failure (${id}): ${errMsg(err)}`);
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
