import { NextResponse } from 'next/server';
import { draw } from '@/lib/store';
import { requestUser } from '@/lib/auth';
import { audit } from '@/lib/db';

export async function POST(req: Request) {
  const plan = draw();
  if ('error' in plan) return NextResponse.json(plan, { status: 400 });
  await audit(requestUser(req), 'draw', { drawId: plan.drawId, effect: plan.effect, prize: plan.description, winners: plan.winners.map((w) => w.name) });
  return NextResponse.json(plan);
}
