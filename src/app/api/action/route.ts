import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { load, reset, save, withLock } from '@/lib/store';
import type { CommandType } from '@/lib/types';
import { requestUser } from '@/lib/auth';
import { audit } from '@/lib/db';

type Body =
  | { type: 'absent'; drawId: string }
  | { type: 'deleteWinner'; drawId: string }
  | { type: 'resetWinners' }
  | { type: 'resetAll' }
  | { type: 'command'; command: CommandType };

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  return withLock(async () => {
  const s = { ...(await load()) };
  if (body.type !== 'command') await audit(requestUser(req), `action:${body.type}`, { list: s.mode, ...('drawId' in body ? { drawId: body.drawId } : {}) });
  switch (body.type) {
    case 'absent': {
      // winner not present: prize goes back, person cannot win again
      const w = s.winners.find((x) => x.drawId === body.drawId);
      if (w) {
        s.winners = s.winners.filter((x) => x.drawId !== body.drawId);
        if (!s.excluded.includes(w.personId)) s.excluded = [...s.excluded, w.personId];
      }
      break;
    }
    case 'deleteWinner':
      s.winners = s.winners.filter((x) => x.drawId !== body.drawId);
      break;
    case 'resetWinners':
      s.winners = [];
      s.excluded = [];
      s.drawCount = 0;
      break;
    case 'resetAll':
      return NextResponse.json(await reset());
    case 'command':
      s.command = { id: crypto.randomUUID(), type: body.command, at: Date.now() };
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  return NextResponse.json(await save(s));
  });
}
