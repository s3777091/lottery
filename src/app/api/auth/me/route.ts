import { NextResponse } from 'next/server';
import { requestUser } from '@/lib/auth';

export async function GET(req: Request) {
  return NextResponse.json({ user: requestUser(req) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
