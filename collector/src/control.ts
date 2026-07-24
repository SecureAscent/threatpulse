/**
 * Collector control server — Intelligence engine (Track A)
 *
 * A tiny HTTP server that lets the Next.js app trigger a manual collection
 * ("Run Now" on the Collector Health dashboard). It listens on the internal
 * Docker network only (no host port is published), so it is reachable from the
 * app container at http://collector:COLLECTOR_CONTROL_PORT.
 *
 * Endpoints:
 *   GET  /health          → { ok, running }
 *   POST /run             → trigger a full cycle
 *   POST /run?source=nvd  → trigger a single source
 *
 * An optional shared secret (COLLECTOR_CONTROL_TOKEN) can be required via the
 * `x-collector-token` header.
 */
import http from 'http';
import { createLogger } from './logger';

const log = createLogger('control');

const PORT = Number(process.env.COLLECTOR_CONTROL_PORT || 9464);
const TOKEN = process.env.COLLECTOR_CONTROL_TOKEN || '';

export interface ControlHandlers {
  isRunning: () => boolean;
  trigger: (sourceKey?: string) => Promise<{
    ok: boolean;
    message: string;
    totalInserted: number;
    totalUpdated: number;
  }>;
  knownSourceKeys: string[];
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

export function startControlServer(handlers: ControlHandlers): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);

    // Auth (optional shared secret)
    if (TOKEN) {
      const provided = req.headers['x-collector-token'];
      if (provided !== TOKEN) {
        return send(res, 401, { ok: false, error: 'Unauthorized' });
      }
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, running: handlers.isRunning() });
    }

    if (req.method === 'POST' && url.pathname === '/run') {
      const source = url.searchParams.get('source') || undefined;
      if (source && !handlers.knownSourceKeys.includes(source)) {
        return send(res, 400, {
          ok: false,
          error: `Unknown source "${source}". Known: ${handlers.knownSourceKeys.join(', ')}`,
        });
      }
      if (handlers.isRunning()) {
        return send(res, 409, { ok: false, error: 'A collection cycle is already running.' });
      }
      // Kick the cycle off in the BACKGROUND and acknowledge immediately.
      //
      // A full cycle (KEV + NVD + RSS) routinely takes far longer than the
      // app's request timeout — NVD alone sleeps several seconds between pages
      // when no API key is set. If we blocked the HTTP response until the cycle
      // finished, the app's fetch would abort with "Collector did not respond
      // in time" even though collection was proceeding fine. The Collector
      // Health dashboard polls CollectorRun rows to surface live progress and
      // final results, so a fire-and-forget acknowledgement is sufficient.
      handlers
        .trigger(source)
        .then((result) => log.info(`Manual run finished: ${result.message}`))
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`Manual run failed: ${msg}`);
        });
      return send(res, 202, {
        ok: true,
        started: true,
        message: source
          ? `Collection started for "${source}". Results will appear shortly.`
          : 'Collection started for all sources. Results will appear shortly.',
      });
    }

    send(res, 404, { ok: false, error: 'Not found' });
  });

  server.listen(PORT, () => {
    log.info(`Control server listening on port ${PORT}${TOKEN ? ' (token required)' : ''}.`);
  });

  server.on('error', (err) => {
    log.error(`Control server error: ${err instanceof Error ? err.message : String(err)}`);
  });

  return server;
}
