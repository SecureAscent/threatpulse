/**
 * ThreatPulse Intelligence Collector
 * ----------------------------------
 * A standalone scheduled worker that ingests threat intelligence into the
 * ThreatPulse PostgreSQL database (the same DB the Next.js app uses).
 *
 * Sources:
 *   - CISA KEV  (known exploited vulnerabilities, JSON)
 *   - NVD       (CVE feed, REST API v2)
 *   - RSS feeds (US-CERT, Krebs, Bleeping Computer, Dark Reading, SANS ISC,
 *                Threatpost, SecurityWeek, Recorded Future, Unit42, Talos, CISA)
 *
 * Schedule: every COLLECTOR_INTERVAL_MINUTES (default 15) via node-cron.
 * Set RUN_ONCE=true to run a single collection cycle and exit (useful for
 * cron-in-container, manual `make` targets, or debugging).
 */
import cron from 'node-cron';
import {
  waitForDatabase,
  resolveOrganizationId,
  upsertThreats,
  closePool,
  ThreatRecord,
} from './db';
import { createLogger } from './logger';
import { collectKev } from './sources/kev';
import { collectNvd } from './sources/nvd';
import { collectRss } from './sources/rss';

const log = createLogger('collector');

const INTERVAL_MINUTES = Math.max(
  1,
  Number(process.env.COLLECTOR_INTERVAL_MINUTES || 15),
);
const RUN_ONCE = String(process.env.RUN_ONCE || '').toLowerCase() === 'true';

type SourceFn = () => Promise<ThreatRecord[]>;

const SOURCES: { name: string; fn: SourceFn; enabled: boolean }[] = [
  { name: 'CISA KEV', fn: collectKev, enabled: envFlag('COLLECT_KEV', true) },
  { name: 'NVD', fn: collectNvd, enabled: envFlag('COLLECT_NVD', true) },
  { name: 'RSS', fn: collectRss, enabled: envFlag('COLLECT_RSS', true) },
];

function envFlag(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
}

let running = false;

async function runCycle(): Promise<void> {
  if (running) {
    log.warn('Previous collection cycle still running — skipping this tick.');
    return;
  }
  running = true;
  const startedAt = Date.now();
  log.info('──────────── Collection cycle START ────────────');

  try {
    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      log.warn(
        'No organization found yet (app may not have seeded). Skipping cycle; will retry next tick.',
      );
      return;
    }
    log.info(`Target organizationId=${organizationId}`);

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const source of SOURCES) {
      if (!source.enabled) {
        log.info(`Source "${source.name}" disabled via env — skipping.`);
        continue;
      }
      try {
        const records = await source.fn();
        const { inserted, updated } = await upsertThreats(records, organizationId);
        totalInserted += inserted;
        totalUpdated += updated;
        log.info(
          `Source "${source.name}" done: ${inserted} new, ${updated} updated (${records.length} fetched).`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Source "${source.name}" failed: ${msg}`);
      }
    }

    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    log.info(
      `──────────── Collection cycle DONE in ${secs}s — ${totalInserted} new, ${totalUpdated} updated ────────────`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Collection cycle aborted: ${msg}`);
  } finally {
    running = false;
  }
}

async function main(): Promise<void> {
  log.info('ThreatPulse Intelligence Collector starting up.');
  log.info(
    `Config: interval=${INTERVAL_MINUTES}m, runOnce=${RUN_ONCE}, ` +
      `enabledSources=[${SOURCES.filter((s) => s.enabled).map((s) => s.name).join(', ')}]`,
  );

  await waitForDatabase();

  if (RUN_ONCE) {
    await runCycle();
    await closePool();
    log.info('RUN_ONCE complete — exiting.');
    process.exit(0);
  }

  // Run one cycle immediately on boot, then on the schedule.
  await runCycle();

  const expr = `*/${INTERVAL_MINUTES} * * * *`;
  if (!cron.validate(expr)) {
    log.error(`Invalid cron expression "${expr}" — falling back to every 15m.`);
  }
  const schedule = cron.validate(expr) ? expr : '*/15 * * * *';
  cron.schedule(schedule, () => {
    runCycle().catch((err) => log.error('Scheduled cycle error', String(err)));
  });
  log.info(`Scheduled collection with cron "${schedule}".`);
}

// ── Graceful shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  log.info(`Received ${signal} — shutting down.`);
  try {
    await closePool();
  } catch {
    /* ignore */
  }
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

main().catch(async (err) => {
  const msg = err instanceof Error ? err.message : String(err);
  log.error(`Fatal startup error: ${msg}`);
  await closePool().catch(() => undefined);
  process.exit(1);
});
