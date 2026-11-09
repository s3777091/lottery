import { NextResponse } from 'next/server';
import { draw, load } from '@/lib/store';
import { requestUser } from '@/lib/auth';
import { audit } from '@/lib/db';

export async function POST(req: Request) {
  const plan = await draw();
  if ('error' in plan) return NextResponse.json(plan, { status: 400 });
  await audit(requestUser(req), 'draw', { list: (await load()).mode, drawId: plan.drawId, effect: plan.effect, prize: plan.description, winners: plan.winners.map((w) => w.name) });
  return NextResponse.json(plan);
}
