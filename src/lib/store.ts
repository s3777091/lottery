import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Command, Dataset, DrawPlan, EffectId, ListMode, Person, Settings, ShowState, State, Winner } from './types';
import { EFFECT_IDS, LIST_MODES, TIERS, plannedEffect, plannedWinnerCount } from './types';
import { eligiblePeople, selectWinner } from './eligibility';
import { query, transaction, dbEnabled } from './db';

// Where the show lives:
// - DATABASE_URL set (the VM): tables app_state + datasets in the separate `lottery` database (db/schema.sql).
// - otherwise (local dev): data/state.json.
// Either way the whole show is one document: shared settings + projector command + one Dataset per list.

type Doc = {
  version: number;
  mode: ListMode;
  settings: Settings;
  command: Command | null;
  lists: Record<ListMode, Dataset>;
};

const DIR = path.join(process.cwd(), 'data');
const FILE = path.join(DIR, 'state.json');

const defaultSettings = (): Settings => ({
  title: 'YEAR END PARTY 2026',
  subtitle: 'Tất niên · Đón Xuân Đinh Mùi 2027',
  effect: 'alternate',
  videoQuality: '2k',
});
const emptyDataset = (): Dataset => ({ people: [], sourceFile: '', winners: [], excluded: [], drawCount: 0 });
const defaultDoc = (): Doc => ({
  version: 1, mode: 'test', settings: defaultSettings(), command: null,
  lists: { test: emptyDataset(), real: emptyDataset() },
});

/* ---------------- normalisation (older files) ---------------- */

function legacyDepartment(record: { id?: string; personId?: string }): string {
  const info = (record as { info?: string }).info || '';
  const prefix = (record.id || record.personId || '') + ' · ';
  return info.startsWith(prefix) ? info.slice(prefix.length) : info;
}
const LEGACY_SETTINGS_KEYS = ['removeWinners', 'departmentLimits', 'winningDepartments', 'winnersPerDraw'];
const LEGACY_WINNER_KEYS = ['prizeId', 'prizeName'];
const omit = <T extends object>(o: T, keys: string[]): T => {
  const copy = { ...o } as Record<string, unknown>;
  for (const k of keys) delete copy[k];
  return copy as T;
};

function normalizeDataset(raw: Partial<Dataset> | undefined): Dataset {
  const d = { ...emptyDataset(), ...(raw || {}) };
  const out: Dataset = {
    people: (d.people || []).map((p) => ({ ...p, englishName: p.englishName || '', department: p.department ?? legacyDepartment(p) })),
    sourceFile: d.sourceFile || '',
    winners: (d.winners || []).map((w) => omit({ ...w, englishName: w.englishName || '', department: w.department ?? legacyDepartment(w) }, LEGACY_WINNER_KEYS)),
    excluded: d.excluded || [],
    drawCount: d.drawCount || 0,
  };
  // Older sessions could retain the round counter after their last result was deleted.
  if (!out.winners.length && !out.excluded.length) out.drawCount = 0;
  return out;
}

function normalizeDoc(raw: Record<string, unknown> | null): Doc {
  if (!raw) return defaultDoc();
  // Files written before the test/real split hold a single flat list: it becomes the test list.
  const lists = (raw.lists as Doc['lists'] | undefined) || { test: raw as Partial<Dataset> as Dataset, real: emptyDataset() };
  const settings = omit({ ...defaultSettings(), ...((raw.settings as Settings) || {}) }, LEGACY_SETTINGS_KEYS);
  settings.videoQuality = '2k';
  return {
    version: Number(raw.version) || 1,
    mode: raw.mode === 'real' ? 'real' : 'test',
    settings,
    command: (raw.command as Command | null) ?? null,
    lists: { test: normalizeDataset(lists.test), real: normalizeDataset(lists.real) },
  };
}

function readFileDoc(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
}

/* ---------------- backends ---------------- */

let cache: Doc | null = null;
let cacheKey = '';

async function readDoc(): Promise<Doc> {
  if (!dbEnabled()) {
    const key = String(fs.statSync(FILE, { throwIfNoEntry: false })?.mtimeMs ?? 0);
    if (cache && cacheKey === key) return cache;
    cacheKey = key;
    return (cache = normalizeDoc(readFileDoc()));
  }
  const head = await query<{ version: string }>('select version from app_state');
  if (!head.rows.length) return seedDatabase();
  const key = head.rows[0].version;
  if (cache && cacheKey === key) return cache;
  const [app, sets] = await Promise.all([
    query<{ version: string; mode: ListMode; settings: Settings; command: Command | null }>('select version, mode, settings, command from app_state'),
    query<{ mode: ListMode; people: Person[]; source_file: string; winners: Winner[]; excluded: string[]; draw_count: number }>(
      'select mode, people, source_file, winners, excluded, draw_count from datasets'),
  ]);
  const lists = Object.fromEntries(sets.rows.map((r) => [r.mode, {
    people: r.people, sourceFile: r.source_file, winners: r.winners, excluded: r.excluded, drawCount: r.draw_count,
  }]));
  const a = app.rows[0];
  cacheKey = a.version;
  return (cache = normalizeDoc({ version: Number(a.version), mode: a.mode, settings: a.settings, command: a.command, lists }));
}

/** First start against an empty database: import data/state.json if there is one (it becomes the test list). */
async function seedDatabase(): Promise<Doc> {
  const doc = normalizeDoc(readFileDoc());
  await writeDoc(doc, LIST_MODES);
  return doc;
}

async function writeDoc(doc: Doc, changed: ListMode[]) {
  if (!dbEnabled()) {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(doc, null, 1));
    fs.renameSync(tmp, FILE);
    cacheKey = String(fs.statSync(FILE).mtimeMs);
    cache = doc;
    return;
  }
  await transaction(async (q) => {
    await q(
      `insert into app_state (id, version, mode, settings, command, updated_at) values (true, $1, $2, $3, $4, now())
       on conflict (id) do update set version = excluded.version, mode = excluded.mode, settings = excluded.settings,
         command = excluded.command, updated_at = now()`,
      [doc.version, doc.mode, JSON.stringify(doc.settings), doc.command ? JSON.stringify(doc.command) : null],
    );
    for (const mode of changed) {
      const d = doc.lists[mode];
      await q(
        `insert into datasets (mode, people, source_file, winners, excluded, draw_count, updated_at) values ($1, $2, $3, $4, $5, $6, now())
         on conflict (mode) do update set people = excluded.people, source_file = excluded.source_file, winners = excluded.winners,
           excluded = excluded.excluded, draw_count = excluded.draw_count, updated_at = now()`,
        [mode, JSON.stringify(d.people), d.sourceFile, JSON.stringify(d.winners), JSON.stringify(d.excluded), d.drawCount],
      );
    }
  });
  cacheKey = String(doc.version);
  cache = doc;
}

/* ---------------- public API ---------------- */

// One Node process serves the show, so a promise chain is enough to keep read-modify-write steps
// (draws, uploads, resets) from interleaving now that storage is asynchronous.
let queue: Promise<unknown> = Promise.resolve();
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const summary = (d: Dataset) => ({ people: d.people.length, winners: d.winners.length, sourceFile: d.sourceFile });

function toState(doc: Doc): State {
  return {
    version: doc.version, mode: doc.mode, settings: doc.settings, command: doc.command,
    ...doc.lists[doc.mode],
    lists: { test: summary(doc.lists.test), real: summary(doc.lists.real) },
  };
}

export async function load(): Promise<State> {
  return toState(await readDoc());
}

/** Saves the active list (state.mode) together with the shared settings and command. */
export async function save(next: State): Promise<State> {
  const doc = await readDoc();
  const dataset: Dataset = {
    people: next.people, sourceFile: next.sourceFile, winners: next.winners, excluded: next.excluded,
    drawCount: !next.winners.length && !next.excluded.length ? 0 : next.drawCount,
  };
  const updated: Doc = {
    version: doc.version + 1, mode: doc.mode, settings: next.settings, command: next.command,
    lists: { ...doc.lists, [doc.mode]: dataset },
  };
  await writeDoc(updated, [doc.mode]);
  return toState(updated);
}

export async function setMode(mode: ListMode): Promise<State> {
  const doc = await readDoc();
  if (doc.mode === mode) return toState(doc);
  // A pending projector command belongs to the list it was issued for.
  const updated: Doc = { ...doc, version: doc.version + 1, mode, command: null };
  await writeDoc(updated, []);
  return toState(updated);
}

/** Clears the active list (players and results) and restores default settings; the other list is kept. */
export async function reset(): Promise<State> {
  const doc = await readDoc();
  const updated: Doc = {
    ...doc, version: doc.version + 1, settings: defaultSettings(), command: null,
    lists: { ...doc.lists, [doc.mode]: emptyDataset() },
  };
  await writeDoc(updated, [doc.mode]);
  return toState(updated);
}

/** Include the effective draw count because loading an older session can correct it in memory. */
export async function stateTag(view: string): Promise<string> {
  const s = await load();
  return `W/"${view}-${s.mode}-${s.version}-${s.drawCount}"`;
}

export function showState(s: State): ShowState {
  return {
    version: s.version,
    mode: s.mode,
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
export function draw(): Promise<DrawPlan | { error: string }> {
  return withLock(async () => {
    const s = await load();
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
    await save(next);
    return { drawId: winners[0].drawId, cardColor, description, winner, winners, candidates, effect, poolSize: pool.length };
  });
}
