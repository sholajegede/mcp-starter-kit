import { ConfigError } from './errors.js';

const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function toMs(value: number | string): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) throw new ConfigError(`Invalid duration: ${value}`);
    return value;
  }
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) throw new ConfigError(`Invalid duration "${value}". Use a number of milliseconds or a value like 30s, 5m, 1h, 1d.`);
  return Number(match[1]) * units[match[2]!]!;
}
