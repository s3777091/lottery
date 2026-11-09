import 'server-only';
import { Pool, type QueryResultRow } from 'pg';
import type { AuthUser } from './auth';

// The separate `lottery` database (see docs/supabase.md). With DATABASE_URL set it holds the show itself
// (app_state, datasets), the admins who signed in and the audit log. Without it the show is kept in
// data/state.json and nothing is logged.
let pool: Pool | null | undefined;
function db() {
  if (pool === undefined) pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 3000, query_timeout: 10000 }) : null;
  return pool;
}

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

export function query<R extends QueryResultRow>(sql: string, params: unknown[] = []) {
  return db()!.query<R>(sql, params);
}

export async function transaction(fn: (q: (sql: string, params?: unknown[]) => Promise<unknown>) => Promise<void>) {
  const client = await db()!.connect();
  try {
    await client.query('begin');
    await fn((sql, params = []) => client.query(sql, params));
    await client.query('commit');
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Logging never blocks the show: failures are reported to the server log only. */
async function run(sql: string, params: unknown[]) {
  const p = db();
  if (!p) return;
  try {
    await p.query(sql, params);
  } catch (err) {
    console.error('[lottery-db]', (err as Error).message);
  }
}

export function audit(user: AuthUser | null, action: string, detail?: unknown) {
  return run('insert into audit_log (user_id, email, action, detail) values ($1, $2, $3, $4)', [
    user?.id ?? null,
    user?.email ?? null,
    action,
    detail === undefined ? null : JSON.stringify(detail),
  ]);
}

export async function recordLogin(user: AuthUser) {
  await run(
    `insert into admins (user_id, email) values ($1, $2)
     on conflict (user_id) do update set email = excluded.email, last_login_at = now(), login_count = admins.login_count + 1`,
    [user.id, user.email],
  );
  await audit(user, 'login');
}
