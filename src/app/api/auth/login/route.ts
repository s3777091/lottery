import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_MAX_AGE, authConfigured, cookieOptions, emailAllowed, signIn, signOut } from '@/lib/auth';
import { audit, recordLogin } from '@/lib/db';

// Password guessing: after too many failures from one IP, or against one email, sign-in is paused for a
// while. Kept in memory (one server process); Supabase Auth also applies its own limits behind this.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 10;
const MAX_FAILS_PER_EMAIL = 5;
const fails = new Map<string, number[]>();

function recent(key: string) {
  const now = Date.now();
  const list = (fails.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length) fails.set(key, list);
  else fails.delete(key);
  return list;
}
function addFail(key: string) {
  if (fails.size > 10_000) fails.clear();
  fails.set(key, [...recent(key), Date.now()]);
}

// Caddy (the only way in) sets X-Forwarded-For to the real client address.
const clientIp = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: 'Đăng nhập chưa được cấu hình.' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email || '').trim().slice(0, 254);
  const password = String(body.password || '').slice(0, 256);
  if (!email || !password) return NextResponse.json({ error: 'Nhập email và mật khẩu.' }, { status: 400 });

  const ipKey = `ip:${clientIp(req)}`;
  const emailKey = `email:${email.toLowerCase()}`;
  if (recent(ipKey).length >= MAX_FAILS_PER_IP || recent(emailKey).length >= MAX_FAILS_PER_EMAIL) {
    await audit(null, 'login:blocked', { email, ip: clientIp(req) });
    return NextResponse.json({ error: 'Sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' }, { status: 429 });
  }

  const { session, error, status } = await signIn(email, password);
  if (!session) {
    if (status === 401) {
      addFail(ipKey);
      addFail(emailKey);
    }
    await audit(null, 'login:failed', { email, ip: clientIp(req) });
    return NextResponse.json({ error }, { status });
  }
  if (!emailAllowed(session.user.email)) {
    await signOut(session.accessToken);
    await audit(session.user, 'login:denied', { ip: clientIp(req) });
    return NextResponse.json({ error: 'Tài khoản này không có quyền vào trang quay số.' }, { status: 403 });
  }

  fails.delete(emailKey);
  await recordLogin(session.user);
  const res = NextResponse.json({ ok: true, email: session.user.email });
  res.cookies.set(ACCESS_COOKIE, session.accessToken, cookieOptions(session.expiresIn));
  res.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  return res;
}
