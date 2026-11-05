import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMBO } from '../../src/config';
import type { ComboKind, GameEvent, Pos } from '../../src/core/types';
import {
  blastCells,
  comboBlastTimes,
  comboOf,
  comboPhases,
  comboPrepMs,
  runSteps,
} from '../../src/view/fx/comboTimeline';

const p = (r: number, c: number): Pos => ({ r, c });
const combo = (kind: ComboKind = 'lineLine'): GameEvent => ({
  type: 'combo',
  combo: kind,
  at: p(1, 2),
  partner: p(1, 1),
  cleared: [p(1, 1), p(1, 2)],
});
const remove: GameEvent = {
  type: 'remove',
  blocks: [
    { id: 1, at: p(1, 1), bySpecial: true },
    { id: 2, at: p(1, 2), bySpecial: true },
  ],
};
const transform: GameEvent = { type: 'transform', changes: [] };
const activate: GameEvent = {
  type: 'activate',
  special: 'lineH',
  at: p(1, 1),
  cleared: [],
  depth: 1,
};

describe('조합 시간표', () => {
  it('모이기 → 슬로모션 → 이름 순서이고 합이 준비 시간이다', () => {
    expect(comboPhases().map((x) => x.name)).toEqual(['merge', 'slow', 'name']);
    expect(comboPrepMs()).toBe(COMBO.mergeMs + COMBO.slowMs + COMBO.nameMs);
  });

  it('bombBomb만 폭발이 두 번이다', () => {
    expect(comboBlastTimes('bombBomb')).toEqual([0, COMBO.bombBombSecondMs]);
    expect(comboBlastTimes('lineLine')).toEqual([0]);
    expect(comboBlastTimes('colorColor')).toEqual([0]);
  });

  it('combo 이벤트와 터질 칸을 step에서 찾는다', () => {
    expect(comboOf([combo('bombBomb')])?.combo).toBe('bombBomb');
    expect(comboOf([remove])).toBeUndefined();
    expect(blastCells([transform, activate, remove])).toEqual([p(1, 1), p(1, 2)]);
  });
});

describe('runSteps: combo step이 끝나기 전에는 다음 step을 시작하지 않는다', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('remove·transform·activate는 준비 시간이 지난 뒤에 시작한다', async () => {
    const started: [string, number][] = [];
    const t0 = Date.now();
    const steps: GameEvent[][] = [[combo('colorLine')], [transform, activate, remove]];
    const done = runSteps(steps, async (step) => {
      for (const e of step) started.push([e.type, Date.now() - t0]);
      if (comboOf(step)) await new Promise((r) => setTimeout(r, comboPrepMs()));
    });
    await vi.advanceTimersByTimeAsync(comboPrepMs() - 1);
    expect(started.map(([t]) => t)).toEqual(['combo']);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(started).toEqual([
      ['combo', 0],
      ['transform', comboPrepMs()],
      ['activate', comboPrepMs()],
      ['remove', comboPrepMs()],
    ]);
  });

  it('다음 step에 앞 step을 넘긴다', async () => {
    const prevs: (readonly GameEvent[] | undefined)[] = [];
    const steps: GameEvent[][] = [[combo()], [remove]];
    await runSteps(steps, async (_s, prev) => void prevs.push(prev));
    expect(prevs).toEqual([undefined, steps[0]]);
  });
});
