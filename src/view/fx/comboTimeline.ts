// 특수 블록 조합 연출의 시간표 (PLAN2 3.3). Phaser 없는 순수 함수. 값은 모두 config.ts COMBO.
import { COMBO } from '../../config';
import type { ComboKind, GameEvent, Pos } from '../../core/types';

export type ComboPhaseName = 'merge' | 'slow' | 'name';

/** combo step 안에서 차례로 재생하는 준비 연출: 모이기 → 슬로모션 → 이름 팝업 */
export function comboPhases(): { name: ComboPhaseName; ms: number }[] {
  return [
    { name: 'merge', ms: COMBO.mergeMs },
    { name: 'slow', ms: COMBO.slowMs },
    { name: 'name', ms: COMBO.nameMs },
  ];
}

/** combo step이 끝나기까지 (ms). 다음 step(remove·transform·activate)은 이 뒤에 시작한다 */
export function comboPrepMs(): number {
  return comboPhases().reduce((sum, p) => sum + p.ms, 0);
}

/** 제거 연출(파티클·흔들림·소리)을 터뜨릴 시각 (다음 step 시작 기준 ms). bombBomb은 두 번 */
export function comboBlastTimes(combo: ComboKind): number[] {
  return combo === 'bombBomb' ? [0, COMBO.bombBombSecondMs] : [0];
}

/** 이 step이 조합 준비 연출을 담고 있으면 그 이벤트 */
export function comboOf(
  step: readonly GameEvent[],
): Extract<GameEvent, { type: 'combo' }> | undefined {
  return step.find((e): e is Extract<GameEvent, { type: 'combo' }> => e.type === 'combo');
}

type ComboEvent = Extract<GameEvent, { type: 'combo' }>;

const isColorCombo = (kind: ComboKind): boolean => kind.startsWith('color');
const same = (a: Pos, b: Pos): boolean => a.r === b.r && a.c === b.c;

/** 컬러 조합의 첫 컬러 발동 (다음 step의 차례 0 activate). 컬러가 없는 조합이면 undefined */
function colorActivate(ev: ComboEvent, next: readonly GameEvent[] | undefined) {
  if (!isColorCombo(ev.combo)) return undefined;
  return next?.find(
    (e): e is Extract<GameEvent, { type: 'activate' }> =>
      e.type === 'activate' && e.special === 'color' && e.depth === 0,
  );
}

/**
 * 모이기·폭발 링의 중심. 컬러 조합은 실제 컬러 발동 칸 (끌어온 방향에 따라 combo.at이 아닐 수 있다), 나머지는 combo.at
 */
export function comboCenter(ev: ComboEvent, next: readonly GameEvent[] | undefined): Pos {
  return colorActivate(ev, next)?.at ?? ev.at;
}

/** 중심으로 모여 드는 쪽 칸 (두 칸 중 중심이 아닌 쪽) */
export function comboMover(ev: ComboEvent, center: Pos): Pos {
  return same(center, ev.at) ? ev.partner : ev.at;
}

export interface ComboBlast {
  /** 링·흔들림·소리의 중심 */
  at: Pos;
  /** 다음 step 시작부터 터뜨리기까지 (ms): 직접 범위가 실제로 지워지기 시작하는 시각 */
  delay: number;
  /** 별이 터질 칸과 delay 기준 상대 지연 (ms) */
  cells: { at: Pos; delay: number }[];
}

/**
 * 조합 제거 연출 계획 (PLAN2 3.3). 조합이 직접 겨냥한 칸만 센다:
 * 컬러 조합은 첫 컬러 발동의 범위, 나머지는 combo.cleared. 연쇄로 휘말린 칸은 v0.1 차례 연출에 맡긴다.
 * 시각은 removeAt(chainTimeline.removeDelays) 그대로라 변신·차례를 기다린 만큼 늦는다.
 */
export function comboBlast(
  ev: ComboEvent,
  next: readonly GameEvent[],
  removeAt: ReadonlyMap<number, number>,
): ComboBlast {
  const direct = colorActivate(ev, next)?.cleared ?? ev.cleared;
  const cells: { at: Pos; delay: number }[] = [];
  for (const e of next) {
    if (e.type !== 'remove') continue;
    for (const b of e.blocks) {
      if (direct.some((p) => same(p, b.at)))
        cells.push({ at: b.at, delay: removeAt.get(b.id) ?? 0 });
    }
  }
  const delay = cells.length ? Math.min(...cells.map((c) => c.delay)) : 0;
  return {
    at: comboCenter(ev, next),
    delay,
    cells: cells.map((c) => ({ at: c.at, delay: c.delay - delay })),
  };
}

/**
 * steps를 차례로 재생한다. 한 step이 끝나야 다음 step을 시작한다.
 * prev·next: 앞뒤 step (combo step은 next로 컬러 발동 칸을, 그 다음 step은 prev로 조합 여부를 안다)
 */
export async function runSteps(
  steps: readonly (readonly GameEvent[])[],
  playStep: (
    step: readonly GameEvent[],
    prev: readonly GameEvent[] | undefined,
    next: readonly GameEvent[] | undefined,
  ) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) await playStep(steps[i]!, steps[i - 1], steps[i + 1]);
}
