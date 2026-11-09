import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DrawPlan, EffectId, Person, ShowState, State, Winner } from './types';
import { EFFECT_IDS, TIERS, plannedEffect, plannedWinnerCount } from './types';
import { eligiblePeople, selectWinner } from './eligibility';

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'state.json');

function defaults(): State {
  return {
    version: 1,
    people: [],
    sourceFile: '',
    winners: [],
    excluded: [],
    settings: {
      title: 'YEAR END PARTY 2026',
      subtitle: 'Tất niên · Đón Xuân Đinh Mùi 2027',
      effect: 'alternate',
      videoQuality: '2k',
    },
    command: null,
    drawCount: 0,
  };
}

let cache: State | null = null;
let cacheMtime = 0;

function legacyDepartment(record: { id?: string; personId?: string }): string {
  const info = (record as { info?: string }).info || '';
  const prefix = (record.id || record.personId || '') + ' · ';
  return info.startsWith(prefix) ? info.slice(prefix.length) : info;
}

/** Keys written by older versions of the app; dropped on load and gone from the file after the next save. */
const LEGACY_STATE_KEYS = ['prizes', 'currentPrizeId'];
const LEGACY_SETTINGS_KEYS = ['removeWinners', 'departmentLimits', 'winningDepartments', 'winnersPerDraw'];
const LEGACY_WINNER_KEYS = ['prizeId', 'prizeName'];
const omit = <T extends object>(o: T, keys: string[]): T => {
  const copy = { ...o } as Record<string, unknown>;
  for (const k of keys) delete copy[k];
  return copy as T;
};

export function load(): State {
  const mtime = fs.statSync(FILE, { throwIfNoEntry: false })?.mtimeMs ?? 0;
  if (cache && cacheMtime === mtime) return cache;
  cacheMtime = mtime;
  let s: State;
  try {
    s = omit({ ...defaults(), ...JSON.parse(fs.readFileSync(FILE, 'utf8')) } as State, LEGACY_STATE_KEYS);
  } catch {
    s = defaults();
  }
  s.settings = omit({ ...defaults().settings, ...s.settings }, LEGACY_SETTINGS_KEYS);
  s.settings.videoQuality = '2k';
  // Keep existing lists readable without inventing missing English names.
  s.people = s.people.map((p) => ({ ...p, englishName: p.englishName || '', department: p.department ?? legacyDepartment(p) }));
  s.winners = s.winners.map((w) => omit({ ...w, englishName: w.englishName || '', department: w.department ?? legacyDepartment(w) }, LEGACY_WINNER_KEYS));
  // Older sessions could retain the round counter after their last result was deleted.
  if (!s.winners.length && !s.excluded.length) s.drawCount = 0;
  return (cache = s);
}

/** Include the effective draw count because loading an older session can correct it in memory. */
export function stateTag(view: string): string {
  const s = load();
  return `W/"${view}-${s.version}-${cacheMtime}-${s.drawCount}"`;
}

export function save(next: State): State {
  if (!next.winners.length && !next.excluded.length) next.drawCount = 0;
  next.version = (next.version || 0) + 1;
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 1));
  fs.renameSync(tmp, FILE);
  cacheMtime = fs.statSync(FILE).mtimeMs;
  cache = next;
  return next;
}

export function reset(): State {
  return save({ ...defaults(), version: load().version });
}

export function showState(s: State): ShowState {
  return {
    version: s.version,
    settings: s.settings,
    eligible: eligiblePeople(s).length,
    command: s.command,
    drawCount: s.drawCount,
  };
}

function secureInt(n: number) {
  return n <= 1 ? 0 : crypto.randomInt(n);
}
function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Reapply the current department odds after each pick and save the whole round together. */
export function draw(): DrawPlan | { error: string } {
  const s = load();
  const first = selectWinner(s, secureInt);
  if (!first) return { error: 'Không còn người nào đủ điều kiện để quay.' };
  // Priority: one-off pick for this draw > per-draw script > default mode.
  const planned = plannedEffect(s.settings, s.drawCount).effect;
  const effect: EffectId = planned === 'random' ? EFFECT_IDS[secureInt(EFFECT_IDS.length)] : planned;
  const cardColor = TIERS[secureInt(TIERS.length)];
  const { winner, pool } = first;
  const time = Date.now();
  const winners: Winner[] = [];
  const next: State = { ...s, winners: [...s.winners], drawCount: s.drawCount + 1 };
  const recordWinner = (person: Person) => {
    const record: Winner = {
      drawId: crypto.randomUUID(), personId: person.id, name: person.name, englishName: person.englishName,
      department: person.department, effect, time,
    };
    winners.push(record);
    next.winners.push(record);
  };
  recordWinner(winner);
  const count = Math.min(plannedWinnerCount(s.settings, s.drawCount), pool.length);
  while (winners.length < count) {
    const selection = selectWinner(next, secureInt);
    if (!selection) break;
    recordWinner(selection.winner);
  }
  const description = winners.length === 1 ? s.settings.rewardDescription || '' : '';
  if (description) winners[0].prizeDescription = description;
  const winningIds = new Set(winners.map((w) => w.personId));
  const remaining = pool.filter((p) => !winningIds.has(p.id));
  const candidates = shuffle(remaining.length || winners.length === 1 ? remaining : pool).slice(0, 80);
  if (s.settings.nextEffect) next.settings = { ...s.settings, nextEffect: null };
  save(next);
  return { drawId: winners[0].drawId, cardColor, description, winner, winners, candidates, effect, poolSize: pool.length };
}
