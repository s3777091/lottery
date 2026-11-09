import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_MAX_AGE, USER_EMAIL_HEADER, USER_ID_HEADER,
  authConfigured, cookieOptions, emailAllowed, getUser, refresh, type AuthUser, type Session,
} from '@/lib/auth';

const PUBLIC_PATHS = new Set(['/login', '/api/auth/login']);

// Everything except build assets, fonts and logos needs a signed-in Supabase user.
export async function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.delete(USER_ID_HEADER); // never trust these from the client
  headers.delete(USER_EMAIL_HEADER);
  const path = req.nextUrl.pathname;
  if (PUBLIC_PATHS.has(path)) return NextResponse.next({ request: { headers } });

  if (!authConfigured()) return new NextResponse('Đăng nhập chưa được cấu hình (SUPABASE_URL / SUPABASE_ANON_KEY).', { status: 503 });

  let user: AuthUser | null = null;
  let renewed: Session | null = null;
  const at = req.cookies.get(ACCESS_COOKIE)?.value;
  if (at) user = await getUser(at);
  if (!user) {
    const rt = req.cookies.get(REFRESH_COOKIE)?.value;
    if (rt) renewed = await refresh(rt);
    if (renewed) user = renewed.user;
  }

  if (!user || !emailAllowed(user.email)) {
    const res = path.startsWith('/api/') || path.startsWith('/videos/') || path.startsWith('/effects/')
      ? NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
      : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path + req.nextUrl.search)}`, req.url));
    // Stale or rejected session: drop it so the next request does not retry it.
    if (req.cookies.has(ACCESS_COOKIE)) res.cookies.delete(ACCESS_COOKIE);
    if (req.cookies.has(REFRESH_COOKIE)) res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  headers.set(USER_ID_HEADER, user.id);
  headers.set(USER_EMAIL_HEADER, user.email);
  const res = NextResponse.next({ request: { headers } });
  if (renewed) {
    res.cookies.set(ACCESS_COOKIE, renewed.accessToken, cookieOptions(renewed.expiresIn));
    res.cookies.set(REFRESH_COOKIE, renewed.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|brand/).*)'],
};
