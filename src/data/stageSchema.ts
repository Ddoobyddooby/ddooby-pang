// 스테이지 JSON 타입 + 런타임 검증 (SPEC 6절·v0.2 4.3, PLAN 7.1·PLAN2 5.4). 순수 TS: fetch는 stageLoader.ts만 쓴다.
// 잘못된 값은 조용히 고치지 않고 위치를 담은 StageError를 던진다 (예: story[3].goals[0].count).

import type { CellLayer, Color } from '../core/types';

export const COLOR_NAMES = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

export const OBSTACLE_KINDS = ['lock', 'frost', 'jelly'] as const;
export type ObstacleKind = (typeof OBSTACLE_KINDS)[number];

export type Goal =
  | { readonly type: 'score'; readonly target: number }
  | { readonly type: 'collect'; readonly color: Color; readonly count: number }
  /** 보드의 젤리를 모두 없앤다 (진행 = 지운 젤리 칸 / 처음 젤리 칸) */
  | { readonly type: 'clearJelly' }
  /** 그 장애물을 count개 완전히 없앤다 (ResolveResult.clearedObstacles 누적, PLAN2 5.4) */
  | { readonly type: 'clearObstacle'; readonly obstacle: ObstacleKind; readonly count: number };

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
  /** layout·layers를 칸마다 펼친 장애물 층 (index = r * cols + c). layout이 없으면 없다 */
  readonly layers?: readonly (CellLayer | null)[];
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

function goal(
  raw: unknown,
  path: string,
  colors: number,
  layers: readonly (CellLayer | null)[] | undefined,
): Goal {
  const o = object(raw, path);
  const cellsWith = (kind: ObstacleKind) =>
    layers?.filter((l) => l?.[kind] !== undefined).length ?? 0;
  const has = (kind: ObstacleKind) => cellsWith(kind) > 0;
  if (o.type === 'score') return { type: 'score', target: int(o, 'target', path, 1) };
  if (o.type === 'clearJelly') {
    if (!has('jelly')) throw new StageError(`${path}.type`, 'layout에 젤리가 있어야 한다');
    return { type: 'clearJelly' };
  }
  if (o.type === 'clearObstacle') {
    const obstacle = o.obstacle as ObstacleKind;
    if (!OBSTACLE_KINDS.includes(obstacle)) {
      throw new StageError(`${path}.obstacle`, `${OBSTACLE_KINDS.join(', ')} 중 하나여야 한다`);
    }
    if (!has(obstacle)) {
      throw new StageError(`${path}.obstacle`, `layout에 ${obstacle}가 있어야 한다`);
    }
    // 장애물은 새로 생기지 않으므로 처음 칸 수가 상한이다
    return {
      type: 'clearObstacle',
      obstacle,
      count: int(o, 'count', path, 1, cellsWith(obstacle)),
    };
  }
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
  throw new StageError(
    `${path}.type`,
    "'score', 'collect', 'clearJelly', 'clearObstacle' 중 하나여야 한다",
  );
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

/** 장애물 정의 하나 → 그 칸 층에 더한다. hp 범위: 얼음벽 1~3, 젤리 1~2 (SPEC v0.2 4절) */
function addObstacle(layer: CellLayer, raw: unknown, path: string): CellLayer {
  const o = object(raw, path);
  const type = o.type as ObstacleKind;
  if (!OBSTACLE_KINDS.includes(type)) {
    throw new StageError(`${path}.type`, `${OBSTACLE_KINDS.join(', ')} 중 하나여야 한다`);
  }
  if (layer[type] !== undefined) throw new StageError(`${path}.type`, `${type}가 두 번 있다`);
  if (type === 'lock') {
    if (o.hp !== undefined) throw new StageError(`${path}.hp`, '잠금에는 hp가 없다');
    return { ...layer, lock: true };
  }
  if (type === 'frost') return { ...layer, frost: int(o, 'hp', path, 1, 3) as 1 | 2 | 3 };
  return { ...layer, jelly: int(o, 'hp', path, 1, 2) as 1 | 2 };
}

/** layers: 문자 하나 → 정의 또는 정의 배열. 얼음벽은 다른 장애물과 같이 둘 수 없다 (PLAN2 5.1) */
function layerDefs(raw: unknown, path: string): Map<string, CellLayer> {
  const o = object(raw, path);
  const defs = new Map<string, CellLayer>();
  for (const [ch, value] of Object.entries(o)) {
    const where = `${path}.${ch}`;
    if ([...ch].length !== 1 || ch === '.') {
      throw new StageError(where, "문자 하나여야 한다 ('.'은 빈 칸이라 쓸 수 없다)");
    }
    const list = Array.isArray(value) ? value : [value];
    if (list.length === 0) throw new StageError(where, '장애물 정의가 1개 이상 있어야 한다');
    const layer = list.reduce<CellLayer>(
      (acc, def, i) => addObstacle(acc, def, Array.isArray(value) ? `${where}[${i}]` : where),
      {},
    );
    if (layer.frost !== undefined && (layer.lock || layer.jelly !== undefined)) {
      throw new StageError(where, '얼음벽은 다른 장애물과 같이 둘 수 없다');
    }
    defs.set(ch, layer);
  }
  return defs;
}

/** layout(행 문자열 rows개, 각 길이 cols) + layers → 칸마다 층. layout이 없으면 undefined */
function stageLayers(
  o: Obj,
  path: string,
  rows: number,
  cols: number,
): (CellLayer | null)[] | undefined {
  if (o.layout === undefined) {
    if (o.layers !== undefined) throw new StageError(`${path}.layers`, 'layout이 있어야 한다');
    return undefined;
  }
  const where = `${path}.layout`;
  const layout = o.layout;
  if (!Array.isArray(layout) || layout.length !== rows) {
    throw new StageError(where, `문자열 ${rows}개(rows)의 배열이어야 한다`);
  }
  const defs = o.layers === undefined ? new Map() : layerDefs(o.layers, `${path}.layers`);
  const layers: (CellLayer | null)[] = [];
  layout.forEach((line: unknown, r) => {
    const chars = typeof line === 'string' ? [...line] : null;
    if (chars?.length !== cols) {
      throw new StageError(`${where}[${r}]`, `길이 ${cols}(cols)의 문자열이어야 한다`);
    }
    chars.forEach((ch, c) => {
      if (ch === '.') return void layers.push(null);
      const layer = defs.get(ch);
      if (!layer) throw new StageError(`${where}[${r}][${c}]`, `'${ch}'의 정의가 layers에 없다`);
      layers.push(layer);
    });
  });
  return layers;
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
  const layers = stageLayers(o, path, shape.rows, shape.cols);

  const goalsWhere = `${path}.goals`;
  if (o.goals === undefined) throw new StageError(goalsWhere, '필수 항목이 없다');
  if (!Array.isArray(o.goals) || o.goals.length === 0) {
    throw new StageError(goalsWhere, '미션이 1개 이상 있는 배열이어야 한다');
  }
  const goals = o.goals.map((g, i) => goal(g, `${goalsWhere}[${i}]`, shape.colors, layers));

  return {
    id,
    ...shape,
    moves,
    goals,
    stars: stars(o, path),
    ...optionalSeed(o, path),
    ...(layers ? { layers } : {}),
  };
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
