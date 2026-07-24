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
 * Upsert a batch of threats keyed by (organizationId, threatId).
 *
 * Implemented as update-first / insert-if-missing rather than SQL ON CONFLICT,
 * so it does NOT require a DB unique constraint to exist (collection keeps
 * working even if the unique index could not be created yet). Existing rows
 * refresh their intelligence fields but PRESERVE the analyst's workflow
 * `status` (NEW / INVESTIGATING / RESOLVED) so collection never clobbers
 * triage work.
 */
export async function upsertThreats(
  records: ThreatRecord[],
  organizationId: string,
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, updated: 0 };
  if (records.length === 0) return result;

  const client = await pool.connect();

  // Column list + UPDATE SET clause shared by the update-first and the
  // unique-violation fallback paths. Analyst workflow `status` is deliberately
  // NOT updated so collection never clobbers triage state.
  const updateSql = `UPDATE "Threat" SET
      title = $3, type = $4, severity = $5, description = $6,
      "affectedAssets" = $7, source = $8, indicators = $9,
      "mitreTactic" = $10, "mitreTechnique" = $11, "cvssScore" = $12,
      "lastUpdated" = $13
   WHERE "organizationId" = $14 AND "threatId" = $2`;

  try {
    for (const r of records) {
      if (!r.threatId || !r.title) continue;
      const now = new Date();
      const params = [
        generateId(), // $1 (used only by INSERT)
        r.threatId.slice(0, 191), // $2
        r.title.slice(0, 500), // $3
        r.type, // $4
        r.severity, // $5
        r.description ?? null, // $6
        r.affectedAssets ?? null, // $7
        r.source ?? null, // $8
        r.indicators ?? null, // $9
        r.mitreTactic ?? null, // $10
        r.mitreTechnique ?? null, // $11
        r.cvssScore ?? null, // $12
        now, // $13
        organizationId, // $14
      ];

      // Upsert WITHOUT relying on a DB unique constraint: update first, and
      // only insert when no existing row matched. This keeps collection working
      // even if the (organizationId, threatId) unique index has not been
      // created yet (e.g. blocked by pre-existing duplicate rows), and it never
      // creates new duplicates for a key that already exists.
      const upd = await client.query(updateSql, params);
      if ((upd.rowCount ?? 0) > 0) {
        result.updated++;
        continue;
      }

      try {
        await client.query(
          `INSERT INTO "Threat" (
              id, "threatId", title, type, severity, status, description,
              "affectedAssets", source, indicators, "mitreTactic", "mitreTechnique",
              "cvssScore", "dateAdded", "lastUpdated", "organizationId"
           ) VALUES (
              $1, $2, $3, $4, $5, 'NEW', $6,
              $7, $8, $9, $10, $11,
              $12, $13, $13, $14
           )`,
          params,
        );
        result.inserted++;
      } catch (err: any) {
        // If the unique index DOES exist and a race/duplicate slipped in
        // between the update and the insert, fall back to an update rather
        // than failing the entire batch. (23505 = unique_violation.)
        if (err?.code === '23505') {
          await client.query(updateSql, params);
          result.updated++;
        } else {
          throw err;
        }
      }
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
