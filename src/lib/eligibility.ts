import type { Person, State } from './types';

export const departmentKey = (value: string) => value.trim().replace(/\s+/g, ' ').normalize('NFC').toLocaleLowerCase('vi');

export function departmentWinnerCounts(s: State): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of s.winners) {
    const key = departmentKey(w.department || s.people.find((p) => p.id === w.personId)?.department || '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function eligiblePeople(s: State): Person[] {
  const excluded = new Set([...s.excluded, ...s.winners.map((w) => w.personId)]);
  return s.people.filter((p) => !excluded.has(p.id));
}

// Integer tickets keep selection unbiased, with resolution of 0.0000000001%.
// Below the 2^48 bound supported by crypto.randomInt and exact in JavaScript.
export const DRAW_TICKETS = 1_000_000_000_000;
export const WIN_WEIGHT_FACTOR = 0.4;
// Each additional win receives a stronger penalty, with no fixed team quota.
export function departmentWeightFactor(wonCount: number): number {
  if (wonCount <= 0) return 1;
  if (wonCount === 1) return WIN_WEIGHT_FACTOR;
  if (wonCount === 2) return 0.06;
  if (wonCount === 3) return 0.0015
  // A tiny floor preserves a chance of selection at the integer ticket resolution.
  return Math.max(1e-9, 0.0001 * 0.1 ** (wonCount - 4));
}
function allocate(weights: number[], total = DRAW_TICKETS): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => w / sum * total);
  const result = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, remainder: v - result[i] })).sort((a, b) => b.remainder - a.remainder);
  for (let n = total - result.reduce((a, b) => a + b, 0), i = 0; i < n; i++) result[order[i].i]++;
  return result;
}

export function rebalanceDepartment(chances: ReturnType<typeof departmentChances>, key: string, percent: number): Record<string, number> {
  const active = chances.filter((g) => g.eligible > 0);
  if (!active.some((g) => g.key === key)) return Object.fromEntries(chances.map((g) => [g.key, g.percent]));
  const target = active.length === 1 ? DRAW_TICKETS : Math.round(Math.max(0, Math.min(100, percent)) / 100 * DRAW_TICKETS);
  const others = active.filter((g) => g.key !== key);
  const weights = others.some((g) => g.percent > 0) ? others.map((g) => g.percent) : others.map(() => 1);
  const shares = allocate(weights, DRAW_TICKETS - target);
  const result = Object.fromEntries(chances.map((g) => [g.key, 0]));
  result[key] = target / DRAW_TICKETS * 100;
  others.forEach((g, i) => { result[g.key] = shares[i] / DRAW_TICKETS * 100; });
  // Recover base weights so editing odds does not apply cumulative penalties twice.
  for (const g of chances) result[g.key] /= departmentWeightFactor(g.wonCount);
  const unwon = active.filter((g) => g.wonCount === 0);
  const removed = active.filter((g) => g.wonCount > 0).reduce((sum, g) => sum + result[g.key] * (1 - departmentWeightFactor(g.wonCount)), 0);
  for (const g of unwon) result[g.key] = Math.max(0, result[g.key] - removed);
  const baseTotal = Object.values(result).reduce((sum, value) => sum + value, 0);
  if (baseTotal > 0) for (const key of Object.keys(result)) result[key] = result[key] / baseTotal * 100;
  return result;
}

export function departmentChances(s: State) {
  const pool = eligiblePeople(s);
  const counts = departmentWinnerCounts(s);
  const groups = new Map<string, { key: string; name: string; eligible: number; wonCount: number; percent: number }>();
  for (const p of s.people) {
    const key = departmentKey(p.department);
    const wonCount = counts.get(key) || 0;
    if (!groups.has(key)) groups.set(key, { key, name: p.department.trim() || 'Chưa có phòng ban', eligible: 0, wonCount, percent: 0 });
  }
  for (const p of pool) groups.get(departmentKey(p.department))!.eligible++;
  const rows = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  let weights = rows.map((g) => {
    const configured = s.settings.departmentWeights;
    // Teams start equally, regardless of headcount; manual weights remain optional.
    const base = configured && Object.hasOwn(configured, g.key) ? Math.max(0, configured[g.key]) : 1;
    return base;
  });
  // If every remaining team had 0%, resume with equal team base weights.
  if (!weights.some((w) => w > 0)) weights = rows.map((g) => g.eligible > 0 ? 1 : 0);
  // Each never-winning team receives the full removed weight before normalization.
  const removed = rows.reduce((sum, g, i) => sum + weights[i] * (1 - (g.eligible > 0 ? departmentWeightFactor(g.wonCount) : 0)), 0);
  const adjusted = rows.map((g, i) => {
    if (!g.eligible) return 0;
    return g.wonCount === 0 ? weights[i] + removed : weights[i] * departmentWeightFactor(g.wonCount);
  });
  // After the last team with positive odds is exhausted, keep the remaining teams drawable.
  const finalWeights = adjusted.some((weight) => weight > 0) ? adjusted
    : rows.map((g) => g.eligible > 0 ? departmentWeightFactor(g.wonCount) : 0);
  const shares = allocate(finalWeights);
  return rows.map((g, i) => ({ ...g, weight: finalWeights[i], tickets: shares[i], percent: shares[i] / DRAW_TICKETS * 100 }));
}

/** Select independently on every draw, with no department quota or forced balancing. */
export function selectDepartment(chances: ReturnType<typeof departmentChances>, ticket: number) {
  if (!Number.isSafeInteger(ticket) || ticket < 0 || ticket >= DRAW_TICKETS) throw new RangeError('Invalid draw ticket');
  let cumulative = 0;
  return chances.find((g) => {
    cumulative += g.tickets;
    return ticket < cumulative;
  });
}

/** The complete selection used by the server, testable without writing draw results. */
export function selectWinner(s: State, randomInt: (max: number) => number) {
  const pool = eligiblePeople(s);
  if (!pool.length) return null;
  const chances = departmentChances(s);
  if (chances.reduce((sum, g) => sum + g.tickets, 0) !== DRAW_TICKETS) throw new Error('Invalid probability total');
  const team = selectDepartment(chances, randomInt(DRAW_TICKETS));
  if (!team) throw new Error('Draw did not select a department');
  const people = pool.filter((p) => departmentKey(p.department) === team.key);
  const index = randomInt(people.length);
  if (!Number.isInteger(index) || index < 0 || index >= people.length) throw new Error('Invalid person selection');
  return { winner: people[index], pool, chances };
}
