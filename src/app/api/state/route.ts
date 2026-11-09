import { NextResponse } from 'next/server';
import { load, save, showState, stateTag } from '@/lib/store';
import type { Person, Settings, State } from '@/lib/types';
import { EFFECT_LABEL, isSingleDrawChoice, isWinnerCount } from '@/lib/types';
import { departmentKey } from '@/lib/eligibility';

// Pollers revalidate with If-None-Match; an unchanged state costs a body-less 304.
export async function GET(req: Request) {
  const view = new URL(req.url).searchParams.get('view') === 'show' ? 'show' : 'full';
  const etag = stateTag(view);
  const headers = { 'Cache-Control': 'private, no-cache', ETag: etag };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });
  const s = load();
  return NextResponse.json(view === 'show' ? showState(s) : s, { headers });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<{ people: Person[]; sourceFile: string; settings: Partial<Settings> }>;
  const s: State = { ...load() };
  if (body.settings?.videoQuality !== undefined && !['2k', '4k'].includes(body.settings.videoQuality)) {
    return NextResponse.json({ error: 'Chất lượng video phải là 2K hoặc 4K.' }, { status: 400 });
  }
  if (body.settings?.departmentWeights !== undefined) {
    const weights = body.settings.departmentWeights;
    if (!weights || typeof weights !== 'object' || Array.isArray(weights) ||
      Object.entries(weights).some(([key, value]) => key.length > 160 || typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) {
      return NextResponse.json({ error: 'Tỷ lệ phải là số từ 0 đến 100.' }, { status: 400 });
    }
    body.settings.departmentWeights = Object.fromEntries(Object.entries(weights).map(([key, value]) => [departmentKey(key), value]));
  }
  if (body.settings?.effect !== undefined && !Object.hasOwn(EFFECT_LABEL, body.settings.effect)) {
    return NextResponse.json({ error: 'Hiệu ứng không hợp lệ.' }, { status: 400 });
  }
  if (body.settings?.nextEffect !== undefined && body.settings.nextEffect !== null && !isSingleDrawChoice(body.settings.nextEffect)) {
    return NextResponse.json({ error: 'Hiệu ứng cho lượt tới không hợp lệ.' }, { status: 400 });
  }
  if (body.settings?.winnerCountPlan !== undefined) {
    const plan = body.settings.winnerCountPlan;
    if (!Array.isArray(plan) || plan.some((count) => count !== null && !isWinnerCount(count))) {
      return NextResponse.json({ error: 'Số người trúng của mỗi lượt phải là số nguyên dương hoặc để trống.' }, { status: 400 });
    }
    let end = plan.length;
    while (end > 0 && plan[end - 1] === null) end--;
    body.settings.winnerCountPlan = plan.slice(0, end);
  }
  if (body.settings?.effectPlan !== undefined) {
    const plan = body.settings.effectPlan;
    if (!Array.isArray(plan) || plan.length > 500 || plan.some((e) => e !== '' && !isSingleDrawChoice(e))) {
      return NextResponse.json({ error: 'Kịch bản hiệu ứng không hợp lệ.' }, { status: 400 });
    }
    // Trailing "default" rows carry no information.
    let end = plan.length;
    while (end > 0 && plan[end - 1] === '') end--;
    body.settings.effectPlan = plan.slice(0, end);
  }
  if (Array.isArray(body.people)) {
    s.people = body.people
      .filter((p) => p && typeof p.name === 'string' && p.name.trim())
      .map((p, i) => ({ id: String(p.id || `p${i + 1}`), name: p.name.trim().slice(0, 80), englishName: String(p.englishName || '').trim().slice(0, 80), department: String(p.department || '').trim().slice(0, 160) }));
    s.excluded = [];
    if (typeof body.sourceFile === 'string') s.sourceFile = body.sourceFile;
  }
  if (body.settings) {
    s.settings = { ...s.settings, ...body.settings };
    if (body.settings.rewardDescription !== undefined) s.settings.rewardDescription = String(body.settings.rewardDescription).trim().slice(0, 240);
  }
  return NextResponse.json(save(s));
}
