// Login goes through the self-hosted Supabase Auth (GoTrue) shared with Jetsona: any account that exists
// there can sign in. Only the Auth REST API is called; nothing here writes to Jetsona's database tables
// except the session rows GoTrue itself keeps for every login.

export const ACCESS_COOKIE = 'lt_at';
export const REFRESH_COOKIE = 'lt_rt';
export const USER_ID_HEADER = 'x-lottery-user-id';
export const USER_EMAIL_HEADER = 'x-lottery-user-email';

export type AuthUser = { id: string; email: string };
export type Session = { accessToken: string; refreshToken: string; expiresIn: number; user: AuthUser };

const url = () => process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = () => process.env.SUPABASE_ANON_KEY;
export const authConfigured = () => Boolean(url() && key());

/** Optional extra gate: comma-separated emails in LOTTERY_ALLOWED_EMAILS. Empty = every Supabase user. */
export function emailAllowed(email: string) {
  const list = (process.env.LOTTERY_ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

async function gotrue(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = { apikey: key()!, 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${url()}/auth/v1${path}`, { ...init, headers, cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const toSession = (b: { access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }): Session => ({
  accessToken: b.access_token,
  refreshToken: b.refresh_token,
  expiresIn: b.expires_in,
  user: { id: b.user.id, email: b.user.email || '' },
});

export async function signIn(email: string, password: string): Promise<{ session?: Session; error?: string; status: number }> {
  const r = await gotrue('/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (r.ok) return { session: toSession(r.body), status: 200 };
  const code = r.body?.error_code;
  if (code === 'invalid_credentials') return { error: 'Sai email hoặc mật khẩu.', status: 401 };
  if (code === 'email_not_confirmed') return { error: 'Email chưa được xác nhận.', status: 401 };
  if (r.status === 429) return { error: 'Thử quá nhiều lần, vui lòng đợi một lát.', status: 429 };
  return { error: 'Không đăng nhập được, vui lòng thử lại.', status: 502 };
}

export async function refresh(refreshToken: string): Promise<Session | null> {
  const r = await gotrue('/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
  return r.ok ? toSession(r.body) : null;
}

// Every protected request (including video range requests) verifies its token; a short cache keeps that
// from hitting GoTrue each time. Entries never outlive the token itself.
const cache = new Map<string, { user: AuthUser; until: number }>();
const CACHE_MS = 60_000;

export async function getUser(accessToken: string): Promise<AuthUser | null> {
  const hit = cache.get(accessToken);
  if (hit && hit.until > Date.now()) return hit.user;
  const r = await gotrue('/user', { token: accessToken });
  if (!r.ok || !r.body?.id) {
    cache.delete(accessToken);
    return null;
  }
  const user = { id: r.body.id as string, email: (r.body.email as string) || '' };
  let until = Date.now() + CACHE_MS;
  try {
    const exp = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()).exp;
    if (typeof exp === 'number') until = Math.min(until, exp * 1000);
  } catch {}
  if (cache.size > 500) cache.clear();
  cache.set(accessToken, { user, until });
  return user;
}

export async function signOut(accessToken: string) {
  cache.delete(accessToken);
  await gotrue('/logout?scope=local', { method: 'POST', token: accessToken }).catch(() => {});
}

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;

/** The signed-in user, as stamped onto the request by src/proxy.ts. */
export function requestUser(req: Request): AuthUser | null {
  const id = req.headers.get(USER_ID_HEADER);
  return id ? { id, email: req.headers.get(USER_EMAIL_HEADER) || '' } : null;
}
