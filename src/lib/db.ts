import 'server-only';
import { Pool } from 'pg';
import type { AuthUser } from './auth';

// The separate `lottery` database (see docs/supabase.md). It is optional: without DATABASE_URL the app
// still runs, it just keeps no login history or audit log. Failures here never block the show.
let pool: Pool | null | undefined;
function db() {
  if (pool === undefined) pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 3000, query_timeout: 5000 }) : null;
  return pool;
}

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
