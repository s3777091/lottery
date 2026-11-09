import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ACCESS_COOKIE, REFRESH_COOKIE, requestUser, signOut } from '@/lib/auth';
import { audit } from '@/lib/db';

export async function POST(req: Request) {
  const jar = await cookies();
  const at = jar.get(ACCESS_COOKIE)?.value;
  if (at) await signOut(at);
  await audit(requestUser(req), 'logout');
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ACCESS_COOKIE);
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
