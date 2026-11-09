import { NextResponse } from 'next/server';
import { draw } from '@/lib/store';

export async function POST() {
  const plan = draw();
  if ('error' in plan) return NextResponse.json(plan, { status: 400 });
  return NextResponse.json(plan);
}
