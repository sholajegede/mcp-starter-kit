import { ConfigError } from '../errors.js';
import type { Store } from './types.js';

export type SqlDialect = 'postgres' | 'sqlite' | 'mysql';

/**
 * Runs one parameterized statement and resolves with the result rows.
 * Wrap whichever client you already use:
 *
 *   pg / Neon / Vercel Postgres:  (sql, params) => pool.query(sql, params).then(r => r.rows)
 *   postgres.js:                  (sql, params) => client.unsafe(sql, params)
 *   libSQL / Turso:               (sql, args) => db.execute({ sql, args }).then(r => r.rows)
 *   Cloudflare D1:                (sql, params) => env.DB.prepare(sql).bind(...params).all().then(r => r.results)
 *   mysql2:                       (sql, params) => pool.query(sql, params).then(([rows]) => rows)
 */
export type SqlQuery = (sql: string, params: unknown[]) => Promise<unknown[]>;

export interface SqlStoreOptions {
  query: SqlQuery;
  dialect: SqlDialect;
  /** Defaults to `mcp_kv`. Letters, digits and underscores only. */
  table?: string;
  /** Create the table on first use. Defaults to true. Turn off if you manage migrations yourself. */
  autoMigrate?: boolean;
}

/**
 * Store backed by any SQL database you already run: Postgres (Neon, Supabase,
 * RDS, Vercel), SQLite (libSQL, Turso, D1) or MySQL (PlanetScale, RDS).
 */
export function sqlStore(options: SqlStoreOptions): Store & { migrate(): Promise<void>; schema(): string } {
  const table = options.table ?? 'mcp_kv';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new ConfigError(`Invalid table name "${table}"`);
  const { query, dialect } = options;
  const p = (n: number) => (dialect === 'postgres' ? `$${n}` : '?');
  const q = (name: string) => (dialect === 'mysql' ? `\`${name}\`` : `"${name}"`);
  const t = q(table);

  const schema = () => {
    const key = dialect === 'mysql' ? 'VARCHAR(512)' : 'TEXT';
    return `CREATE TABLE IF NOT EXISTS ${t} (${q('key')} ${key} PRIMARY KEY, ${q('value')} TEXT NOT NULL, ${q('expires_at')} BIGINT NULL)`;
  };

  let ready: Promise<void> | undefined;
  const migrate = async () => {
    await query(schema(), []);
  };
  const ensure = () => {
    if (options.autoMigrate === false) return Promise.resolve();
    ready ??= migrate().catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  };

  const K = q('key');
  const V = q('value');
  const E = q('expires_at');

  return {
    name: `sql:${dialect}`,
    migrate,
    schema,
    async get(key) {
      await ensure();
      const rows = (await query(
        `SELECT ${V} AS value FROM ${t} WHERE ${K} = ${p(1)} AND (${E} IS NULL OR ${E} > ${p(2)})`,
        [key, Date.now()],
      )) as Array<{ value: string }>;
      return rows[0]?.value ?? null;
    },
    async set(key, value, opts) {
      await ensure();
      const expires = opts?.ttlMs ? Date.now() + opts.ttlMs : null;
      if (dialect === 'mysql') {
        await query(`INSERT INTO ${t} (${K}, ${V}, ${E}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${V} = VALUES(${V}), ${E} = VALUES(${E})`, [key, value, expires]);
      } else {
        await query(
          `INSERT INTO ${t} (${K}, ${V}, ${E}) VALUES (${p(1)}, ${p(2)}, ${p(3)}) ON CONFLICT (${K}) DO UPDATE SET ${V} = excluded.${V}, ${E} = excluded.${E}`,
          [key, value, expires],
        );
      }
    },
    async delete(key) {
      await ensure();
      await query(`DELETE FROM ${t} WHERE ${K} = ${p(1)}`, [key]);
    },
    async increment(key, by = 1, opts) {
      await ensure();
      const now = Date.now();
      const expires = opts?.ttlMs ? now + opts.ttlMs : null;
      const expired = (alias: string) => `(${alias}.${E} IS NOT NULL AND ${alias}.${E} <= ${dialect === 'postgres' ? p(4) : '?'})`;

      if (dialect === 'postgres') {
        const rows = (await query(
          `INSERT INTO ${t} AS cur (${K}, ${V}, ${E}) VALUES ($1, $2, $3)
           ON CONFLICT (${K}) DO UPDATE SET
             ${V} = CASE WHEN ${expired('cur')} THEN excluded.${V} ELSE ((cur.${V})::bigint + $5)::text END,
             ${E} = CASE WHEN ${expired('cur')} THEN excluded.${E} ELSE cur.${E} END
           RETURNING ${V} AS value`,
          [key, String(by), expires, now, by],
        )) as Array<{ value: string }>;
        return Number(rows[0]!.value);
      }

      if (dialect === 'sqlite') {
        const rows = (await query(
          `INSERT INTO ${t} (${K}, ${V}, ${E}) VALUES (?, ?, ?)
           ON CONFLICT (${K}) DO UPDATE SET
             ${V} = CASE WHEN (${t}.${E} IS NOT NULL AND ${t}.${E} <= ?) THEN excluded.${V} ELSE CAST(CAST(${t}.${V} AS INTEGER) + ? AS TEXT) END,
             ${E} = CASE WHEN (${t}.${E} IS NOT NULL AND ${t}.${E} <= ?) THEN excluded.${E} ELSE ${t}.${E} END
           RETURNING ${V} AS value`,
          [key, String(by), expires, now, by, now],
        )) as Array<{ value: string }>;
        return Number(rows[0]!.value);
      }

      await query(
        `INSERT INTO ${t} (${K}, ${V}, ${E}) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
           ${V} = IF(${E} IS NOT NULL AND ${E} <= ?, VALUES(${V}), CAST(CAST(${V} AS SIGNED) + ? AS CHAR)),
           ${E} = IF(${E} IS NOT NULL AND ${E} <= ?, VALUES(${E}), ${E})`,
        [key, String(by), expires, now, by, now],
      );
      const rows = (await query(`SELECT ${V} AS value FROM ${t} WHERE ${K} = ?`, [key])) as Array<{ value: string }>;
      return Number(rows[0]!.value);
    },
  };
}
