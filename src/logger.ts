export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export interface LoggerOptions {
  level?: LogLevel;
  /** Defaults to one JSON object per line on stderr. stdout is never used: it carries the stdio protocol. */
  write?: (line: string) => void;
}

export function createLogger(options: LoggerOptions = {}, base: Record<string, unknown> = {}): Logger {
  const level = options.level ?? 'info';
  const write = options.write ?? ((line: string) => console.error(line));

  const emit = (lvl: Exclude<LogLevel, 'silent'>, message: string, fields?: Record<string, unknown>) => {
    if (order[lvl] < order[level]) return;
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, message, ...base, ...serialize(fields) }));
  };

  return {
    debug: (m, f) => emit('debug', m, f),
    info: (m, f) => emit('info', m, f),
    warn: (m, f) => emit('warn', m, f),
    error: (m, f) => emit('error', m, f),
    child: (fields) => createLogger(options, { ...base, ...fields }),
  };
}

function serialize(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;
  }
  return out;
}
