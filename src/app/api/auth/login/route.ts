import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_MAX_AGE, authConfigured, cookieOptions, emailAllowed, signIn, signOut } from '@/lib/auth';
import { audit, recordLogin } from '@/lib/db';

export async function POST(req: Request) {
  if (!authConfigured()) return NextResponse.json({ error: 'Đăng nhập chưa được cấu hình.' }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || !password) return NextResponse.json({ error: 'Nhập email và mật khẩu.' }, { status: 400 });

  const { session, error, status } = await signIn(email, password);
  if (!session) {
    await audit(null, 'login:failed', { email });
    return NextResponse.json({ error }, { status });
  }
  if (!emailAllowed(session.user.email)) {
    await signOut(session.accessToken);
    await audit(session.user, 'login:denied');
    return NextResponse.json({ error: 'Tài khoản này không có quyền vào trang quay số.' }, { status: 403 });
  }

  await recordLogin(session.user);
  const res = NextResponse.json({ ok: true, email: session.user.email });
  res.cookies.set(ACCESS_COOKIE, session.accessToken, cookieOptions(session.expiresIn));
  res.cookies.set(REFRESH_COOKIE, session.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  return res;
}
