export type Tier = 'dog' | 'ox' | 'blue' | 'gold' | 'water' | 'dragon' | 'snake' | 'tiger' | 'rooster' | 'monkey';
/** Every winner-card design, in the order the admin previews them. */
export const TIERS: Tier[] = ['blue', 'gold', 'water', 'dragon', 'snake', 'tiger', 'rooster', 'monkey', 'ox', 'dog'];
export type EffectId = 'effect1-female' | 'effect1-male' | 'effect2-female' | 'effect2-male' | 'effect3-female' | 'effect3-male';
export const EFFECT_IDS: EffectId[] = ['effect1-female', 'effect1-male', 'effect2-female', 'effect2-male', 'effect3-female', 'effect3-male'];
export type EffectMode = EffectId | 'alternate' | 'random';

export interface Person {
  id: string;
  name: string;
  englishName: string;
  department: string;
}

export interface Winner {
  drawId: string;
  personId: string;
  name: string;
  englishName: string;
  department: string;
  prizeDescription?: string;
  effect: EffectId;
  time: number;
}

// Only 2K clips are shipped; the field stays so existing state.json files remain valid.
export type VideoQuality = '2k';

export interface Settings {
  videoQuality: VideoQuality;
  departmentWeights?: Record<string, number>;
  rewardDescription?: string;
  title: string;
  subtitle: string;
  effect: EffectMode;
  /** Keep the winner's name off the last shots of the video; it only appears on the final card. */
  hideWinnerName?: boolean;
  /** Per-draw effect script: entry i applies to draw number i + 1. Empty string = use `effect`. */
  effectPlan?: EffectPlanEntry[];
  /** Per-draw winner count. Empty entries draw one winner. */
  winnerCountPlan?: (number | null)[];
  /** One-off pick for the very next draw (set from the projector or admin); cleared once that draw happens. */
  nextEffect?: EffectId | 'random' | null;
}

export type EffectPlanEntry = EffectId | 'random' | '';

export type CommandType = 'spin' | 'continue';

export interface Command {
  id: string;
  type: CommandType;
  at: number;
}

export interface State {
  version: number;
  people: Person[];
  sourceFile: string;
  winners: Winner[];
  excluded: string[];
  settings: Settings;
  command: Command | null;
  drawCount: number;
}

/** Lightweight view for the projector page. */
export interface ShowState {
  version: number;
  settings: Settings;
  eligible: number;
  command: Command | null;
  drawCount: number;
}

export interface DrawPlan {
  cardColor: Tier;
  drawId: string;
  description: string;
  winner: Person;
  winners: Winner[];
  candidates: Person[];
  effect: EffectId;
  poolSize: number;
}

export const EFFECT_LABEL: Record<EffectMode, string> = {
  'effect1-female': 'Lý Bạch vui xuân · Nữ',
  'effect1-male': 'Lý Bạch vui xuân · Nam',
  'effect2-female': 'Thiên Cung Hội Đăng · Nữ',
  'effect2-male': 'Thiên Cung Hội Đăng · Nam',
  'effect3-female': 'Pháo Hoa Đêm Xuân · Nữ',
  'effect3-male': 'Pháo Hoa Đêm Xuân · Nam',
  alternate: 'Luân phiên cả 6 hiệu ứng',
  random: 'Ngẫu nhiên',
};

/** Choices that make sense for one single draw (no "alternate"). */
export const SINGLE_DRAW_CHOICES: (EffectId | 'random')[] = [...EFFECT_IDS, 'random'];

export function isSingleDrawChoice(v: unknown): v is EffectId | 'random' {
  return typeof v === 'string' && (SINGLE_DRAW_CHOICES as string[]).includes(v);
}

export type EffectSource = 'next' | 'plan' | 'default';

export function isWinnerCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

export function plannedWinnerCount(settings: Settings, drawCount: number): number {
  return settings.winnerCountPlan?.[drawCount] ?? 1;
}

/**
 * Which effect the draw with index `drawCount` (0-based) will use, and why.
 * `effect` is concrete when it is predictable, or 'random' when the server will roll it.
 */
export function plannedEffect(settings: Settings, drawCount: number): { effect: EffectId | 'random'; source: EffectSource } {
  if (settings.nextEffect && isSingleDrawChoice(settings.nextEffect)) return { effect: settings.nextEffect, source: 'next' };
  const scripted = settings.effectPlan?.[drawCount];
  if (scripted && isSingleDrawChoice(scripted)) return { effect: scripted, source: 'plan' };
  const mode = settings.effect;
  return { effect: mode === 'alternate' ? EFFECT_IDS[drawCount % EFFECT_IDS.length] : mode, source: 'default' };
}
