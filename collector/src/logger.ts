/**
 * Minimal structured logger. Writes single-line, timestamped messages to
 * stdout/stderr so that `docker compose logs -f collector` is easy to read.
 */

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

const DEBUG = process.env.LOG_LEVEL === 'debug';

function emit(level: Level, scope: string, msg: string, meta?: unknown): void {
  const ts = new Date().toISOString();
  let line = `${ts} [${level}] [${scope}] ${msg}`;
  if (meta !== undefined) {
    try {
      line += ` ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
    } catch {
      /* ignore serialization issues */
    }
  }
  if (level === 'ERROR') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, meta?: unknown) => emit('INFO', scope, msg, meta),
    warn: (msg: string, meta?: unknown) => emit('WARN', scope, msg, meta),
    error: (msg: string, meta?: unknown) => emit('ERROR', scope, msg, meta),
    debug: (msg: string, meta?: unknown) => {
      if (DEBUG) emit('DEBUG', scope, msg, meta);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
