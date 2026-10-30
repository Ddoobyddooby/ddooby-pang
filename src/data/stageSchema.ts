// 스테이지 JSON 타입 + 런타임 검증 (SPEC 6절, PLAN 7.1). 순수 TS: fetch는 stageLoader.ts만 쓴다.
// 잘못된 값은 조용히 고치지 않고 위치를 담은 StageError를 던진다 (예: story[3].goals[0].count).

import type { Color } from '../core/types';

export const COLOR_NAMES = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export type Goal =
  | { readonly type: 'score'; readonly target: number }
  | { readonly type: 'collect'; readonly color: Color; readonly count: number };

export interface StageDef {
  readonly id: number;
  readonly rows: number;
  readonly cols: number;
  readonly colors: number;
  readonly moves: number;
  readonly goals: readonly Goal[];
  readonly stars: readonly [number, number, number];
  /** 없으면 매번 다른 보드 */
  readonly seed?: number;
}

export interface TimeAttackDef {
  readonly rows: number;
  readonly cols: number;
  readonly colors: number;
  /** 초 */
  readonly timeLimit: number;
  readonly seed?: number;
}

export class StageError extends Error {
  constructor(path: string, problem: string) {
    super(`${path}: ${problem}`);
    this.name = 'StageError';
  }
}

/** 스키마 범위 (PLAN 7.1). colors 3은 연쇄가 너무 길어 제외 (SPEC 6절) */
const LIMITS = { size: { min: 5, max: 10 }, colors: { min: 4, max: 6 } } as const;

export function colorFromName(name: string): Color | null {
  const i = COLOR_NAMES.indexOf(name as ColorName);
  return i < 0 ? null : (i as Color);
}

export function colorName(color: Color): ColorName {
  return COLOR_NAMES[color];
}

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function object(v: unknown, path: string): Obj {
  if (!isObject(v)) throw new StageError(path, '객체여야 한다');
  return v;
}

/** min 이상 (max 이하) 정수 */
function int(o: Obj, key: string, path: string, min: number, max = Infinity): number {
  const v = o[key];
  const where = `${path}.${key}`;
  if (v === undefined) throw new StageError(where, '필수 항목이 없다');
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    const range = max === Infinity ? `${min} 이상의 정수` : `${min}~${max} 정수`;
    throw new StageError(where, `${range}여야 한다`);
  }
  return v;
}

function optionalSeed(o: Obj, path: string): { seed?: number } {
  if (o.seed === undefined) return {};
  if (typeof o.seed !== 'number' || !Number.isInteger(o.seed)) {
    throw new StageError(`${path}.seed`, '정수여야 한다');
  }
  return { seed: o.seed };
}

/** rows, cols, colors: 스토리·타임어택 공통 */
function boardShape(o: Obj, path: string) {
  return {
    rows: int(o, 'rows', path, LIMITS.size.min, LIMITS.size.max),
    cols: int(o, 'cols', path, LIMITS.size.min, LIMITS.size.max),
    colors: int(o, 'colors', path, LIMITS.colors.min, LIMITS.colors.max),
  };
}

function goal(raw: unknown, path: string, colors: number): Goal {
  const o = object(raw, path);
  if (o.type === 'score') return { type: 'score', target: int(o, 'target', path, 1) };
  if (o.type === 'collect') {
    const color = typeof o.color === 'string' ? colorFromName(o.color) : null;
    if (color === null) {
      throw new StageError(`${path}.color`, `색 이름(${COLOR_NAMES.join(', ')})이어야 한다`);
    }
    if (color >= colors) {
      const allowed = COLOR_NAMES.slice(0, colors).join(', ');
      throw new StageError(`${path}.color`, `이 스테이지의 색(${allowed}) 안이어야 한다`);
    }
    return { type: 'collect', color, count: int(o, 'count', path, 1) };
  }
  throw new StageError(`${path}.type`, "'score' 또는 'collect'여야 한다");
}

function stars(o: Obj, path: string): [number, number, number] {
  const v = o.stars;
  const where = `${path}.stars`;
  if (v === undefined) throw new StageError(where, '필수 항목이 없다');
  if (
    !Array.isArray(v) ||
    v.length !== 3 ||
    !v.every((s) => typeof s === 'number' && Number.isInteger(s) && s >= 0) ||
    !(v[0] < v[1] && v[1] < v[2])
  ) {
    throw new StageError(where, '정수 3개가 엄격히 오름차순이어야 한다 (예: [3000, 6000, 9000])');
  }
  return [v[0], v[1], v[2]];
}

function storyStage(raw: unknown, index: number): StageDef {
  const path = `story[${index}]`;
  const o = object(raw, path);
  const id = int(o, 'id', path, 1);
  if (id !== index + 1) {
    throw new StageError(`${path}.id`, `1부터 빈틈없이 순서대로여야 한다 (여기는 ${index + 1})`);
  }
  const shape = boardShape(o, path);
  const moves = int(o, 'moves', path, 1);

  const goalsWhere = `${path}.goals`;
  if (o.goals === undefined) throw new StageError(goalsWhere, '필수 항목이 없다');
  if (!Array.isArray(o.goals) || o.goals.length === 0) {
    throw new StageError(goalsWhere, '미션이 1개 이상 있는 배열이어야 한다');
  }
  const goals = o.goals.map((g, i) => goal(g, `${goalsWhere}[${i}]`, shape.colors));

  return { id, ...shape, moves, goals, stars: stars(o, path), ...optionalSeed(o, path) };
}

/** public/stages/story.json: 스테이지 배열 */
export function parseStory(raw: unknown): StageDef[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new StageError('story', '스테이지가 1개 이상 있는 배열이어야 한다');
  }
  return raw.map(storyStage);
}

/** public/stages/timeattack.json: 객체 하나 (moves·goals·stars 대신 timeLimit 초) */
export function parseTimeAttack(raw: unknown): TimeAttackDef {
  const path = 'timeattack';
  const o = object(raw, path);
  return {
    ...boardShape(o, path),
    timeLimit: int(o, 'timeLimit', path, 1),
    ...optionalSeed(o, path),
  };
}
