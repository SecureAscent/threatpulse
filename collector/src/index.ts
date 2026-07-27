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
  startCollectorRun,
  completeCollectorRun,
  failCollectorRun,
  closePool,
  ThreatRecord,
} from './db';
import { createLogger } from './logger';
import { startControlServer } from './control';
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

const SOURCES: { key: string; name: string; fn: SourceFn; enabled: boolean }[] = [
  { key: 'cisa_kev', name: 'CISA KEV', fn: collectKev, enabled: envFlag('COLLECT_KEV', true) },
  { key: 'nvd', name: 'NVD', fn: collectNvd, enabled: envFlag('COLLECT_NVD', true) },
  { key: 'rss', name: 'RSS', fn: collectRss, enabled: envFlag('COLLECT_RSS', true) },
];

function envFlag(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return !['0', 'false', 'no', 'off'].includes(v.toLowerCase());
}

let running = false;
let controlServer: ReturnType<typeof startControlServer> | null = null;

interface CycleResult {
  ok: boolean;
  message: string;
  totalInserted: number;
  totalUpdated: number;
}

async function runCycle(sourceKey?: string): Promise<CycleResult> {
  if (running) {
    log.warn('Previous collection cycle still running — skipping this tick.');
    return {
      ok: false,
      message: 'A collection cycle is already running.',
      totalInserted: 0,
      totalUpdated: 0,
    };
  }
  running = true;
  const startedAt = Date.now();
  const selectedSources = SOURCES.filter(
    (source) => source.enabled && (!sourceKey || source.key === sourceKey),
  );
  log.info(
    `──────────── Collection cycle START${sourceKey ? ` (${sourceKey})` : ''} ────────────`,
  );

  try {
    const organizationId = await resolveOrganizationId();
    if (!organizationId) {
      log.warn(
        'No organization found yet (app may not have seeded). Skipping cycle; will retry next tick.',
      );
      return {
        ok: false,
        message: 'Collector organization is unavailable.',
        totalInserted: 0,
        totalUpdated: 0,
      };
    }
    log.info(`Target organizationId=${organizationId}`);

    let totalInserted = 0;
    let totalUpdated = 0;
    let failedSources = 0;

    for (const source of selectedSources) {
      const sourceStartedAt = Date.now();
      let collectorRunId: string | null = null;
      try {
        collectorRunId = await startCollectorRun(source.key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`Could not record start of source "${source.name}": ${msg}`);
      }

      try {
        const records = await source.fn();
        const { inserted, updated } = await upsertThreats(records, organizationId);
        totalInserted += inserted;
        totalUpdated += updated;
        if (collectorRunId) {
          try {
            await completeCollectorRun(collectorRunId, {
              itemsFound: records.length,
              itemsNew: inserted,
              itemsUpdated: updated,
              itemsSkipped: Math.max(0, records.length - inserted - updated),
              durationMs: Date.now() - sourceStartedAt,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error(`Could not record completion of source "${source.name}": ${msg}`);
          }
        }
        log.info(
          `Source "${source.name}" done: ${inserted} new, ${updated} updated (${records.length} fetched).`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failedSources++;
        if (collectorRunId) {
          try {
            await failCollectorRun(
              collectorRunId,
              msg,
              Date.now() - sourceStartedAt,
            );
          } catch (trackingError) {
            const trackingMessage =
              trackingError instanceof Error
                ? trackingError.message
                : String(trackingError);
            log.error(
              `Could not record failure of source "${source.name}": ${trackingMessage}`,
            );
          }
        }
        log.error(`Source "${source.name}" failed: ${msg}`);
      }
    }

    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    log.info(
      `──────────── Collection cycle DONE in ${secs}s — ${totalInserted} new, ${totalUpdated} updated ────────────`,
    );
    return {
      ok: failedSources === 0,
      message:
        failedSources === 0
          ? `Collection completed: ${totalInserted} new, ${totalUpdated} updated.`
          : `Collection completed with ${failedSources} source failure(s).`,
      totalInserted,
      totalUpdated,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Collection cycle aborted: ${msg}`);
    return {
      ok: false,
      message: `Collection cycle aborted: ${msg}`,
      totalInserted: 0,
      totalUpdated: 0,
    };
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

  controlServer = startControlServer({
    isRunning: () => running,
    trigger: runCycle,
    knownSourceKeys: SOURCES.filter((source) => source.enabled).map(
      (source) => source.key,
    ),
  });

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
    controlServer?.close();
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
