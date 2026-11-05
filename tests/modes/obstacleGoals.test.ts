// V2-W2-04: 장애물 미션 판정 (PLAN2 5.4) — clearJelly 진행 = 지운 젤리 칸 / 처음 젤리 칸, clearObstacle = clearedObstacles 누적
import { describe, expect, it } from 'vitest';
import { measureStage, playStage } from '../../scripts/sim/stageSim';
import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import { createRng } from '../../src/core/rng';
import type { ObstacleKind, ResolveResult } from '../../src/core/types';
import type { Goal, StageDef } from '../../src/data/stageSchema';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { StoryMode } from '../../src/modes/StoryMode';
import { missionLine } from '../../src/view/missionCardLines';
import { goalLine } from '../../src/view/storyLines';
import { parseBoard } from '../helpers/board';

/** obstacleStage: 잠금 6칸(L 2 + K 4), 얼음벽 3칸, 젤리 20칸 */
const JELLY_CELLS = 20;
const stageWith = (goals: Goal[], moves = 10): StageDef => ({ ...obstacleStage(), goals, moves });

/** onResolve는 valid, scoreDelta, removedByColor, clearedObstacles만 본다 */
function fake(
  cleared: Partial<Record<ObstacleKind, number>> = {},
  scoreDelta = 100,
): ResolveResult {
  return {
    state: { board: parseBoard('R'), rngState: createRng(1), colors: 5 },
    steps: [],
    scoreDelta,
    removedByColor: [0, 0, 0, 0, 0, 0],
    clearedObstacles: { lock: 0, frost: 0, jelly: 0, ...cleared },
    valid: true,
  };
}

describe('modes: clearJelly (PLAN2 5.4)', () => {
  it('시작: 진행 0 / 처음 젤리 칸 수', () => {
    const mode = new StoryMode(stageWith([{ type: 'clearJelly' }]));
    expect(mode.goalProgress()).toEqual([
      { goal: { type: 'clearJelly' }, current: 0, target: JELLY_CELLS, done: false },
    ]);
  });

  it('지운 젤리 칸이 쌓이고, 모두 지우면 완료 → 클리어', () => {
    const mode = new StoryMode(stageWith([{ type: 'clearJelly' }]));
    mode.onResolve(fake({ jelly: 7, lock: 3, frost: 1 }));
    expect(mode.goalProgress()[0]).toMatchObject({ current: 7, done: false });
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake({ jelly: JELLY_CELLS - 7 }));
    expect(mode.goalProgress()[0]).toMatchObject({ current: JELLY_CELLS, done: true });
    expect(mode.result()).toMatchObject({ cleared: true });
  });

  it('이동을 다 써도 젤리가 남으면 실패', () => {
    const mode = new StoryMode(stageWith([{ type: 'clearJelly' }], 2));
    mode.onResolve(fake({ jelly: 10 }));
    mode.onResolve(fake({ jelly: JELLY_CELLS - 11 }));
    expect(mode.isOver()).toBe(true);
    expect(mode.result()).toMatchObject({ cleared: false, stars: 0 });
  });

  it('무효 스왑은 세지 않는다', () => {
    const mode = new StoryMode(stageWith([{ type: 'clearJelly' }]));
    mode.onResolve({ ...fake({ jelly: 5 }), valid: false });
    expect(mode.goalProgress()[0]!.current).toBe(0);
  });

  it('실제 플레이: 진행 = 처음 젤리 칸 - 보드에 남은 젤리 칸', () => {
    const stage = stageWith([{ type: 'clearJelly' }], 40);
    let state = createInitialState({ ...stage, seed: stage.seed!, layers: stage.layers });
    const mode = new StoryMode(stage);
    while (!mode.isOver()) {
      const hint = findHint(state.board)!;
      const result = resolveSwap(state, hint.a, hint.b);
      state = result.state;
      mode.onResolve(result);
      const left = state.board.layers!.filter((l) => l?.jelly).length;
      expect(mode.goalProgress()[0]!.current).toBe(JELLY_CELLS - left);
      expect(mode.goalProgress()[0]!.done).toBe(left === 0);
    }
  });
});

describe('modes: clearObstacle (PLAN2 5.4)', () => {
  const goals: Goal[] = [
    { type: 'clearObstacle', obstacle: 'lock', count: 3 },
    { type: 'clearObstacle', obstacle: 'frost', count: 2 },
    { type: 'clearObstacle', obstacle: 'jelly', count: 5 },
  ];

  it('종류마다 clearedObstacles를 누적하고, 셋 다 채워야 클리어', () => {
    const mode = new StoryMode(stageWith(goals));
    mode.onResolve(fake({ lock: 2, frost: 1, jelly: 5 }));
    expect(mode.goalProgress().map((g) => [g.current, g.target, g.done])).toEqual([
      [2, 3, false],
      [1, 2, false],
      [5, 5, true],
    ]);
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake({ lock: 2 }));
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake({ frost: 1 }));
    expect(mode.goalProgress().map((g) => g.current)).toEqual([4, 2, 5]);
    expect(mode.result()).toMatchObject({ cleared: true });
  });
});

describe('modes: 복합 미션과 점수 (PLAN 5절 규칙 그대로)', () => {
  it('clearJelly + 점수: 둘 다 채워야 클리어', () => {
    const mode = new StoryMode(stageWith([{ type: 'clearJelly' }, { type: 'score', target: 500 }]));
    mode.onResolve(fake({ jelly: JELLY_CELLS }, 200));
    expect(mode.goalProgress().map((g) => g.done)).toEqual([true, false]);
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake({}, 300));
    expect(mode.result()).toMatchObject({ cleared: true });
  });

  it('점수·별은 scoreDelta만 본다 (장애물 수는 점수에 따로 더하지 않는다)', () => {
    const plain = new StoryMode(stageWith([{ type: 'score', target: 50 }]));
    const withObstacles = new StoryMode(stageWith([{ type: 'score', target: 50 }]));
    plain.onResolve(fake({}, 100));
    withObstacles.onResolve(fake({ lock: 3, frost: 2, jelly: 9 }, 100));
    expect(withObstacles.result()).toEqual(plain.result());
  });
});

describe('view: 장애물 미션 문구 (카드·패널)', () => {
  it('미션 카드', () => {
    expect(missionLine({ type: 'clearJelly' })).toEqual({ color: null, text: '젤리 모두 없애기!' });
    const line = (obstacle: ObstacleKind, count: number) =>
      missionLine({ type: 'clearObstacle', obstacle, count }).text;
    expect(line('lock', 3)).toBe('자물쇠 3개 풀기!');
    expect(line('frost', 4)).toBe('얼음 4개 깨기!');
    expect(line('jelly', 6)).toBe('젤리 6칸 지우기!');
  });

  it('패널 진행: 이름 지운 수 / 목표 (목표를 넘으면 목표까지만)', () => {
    expect(goalLine({ goal: { type: 'clearJelly' }, current: 7, target: 20, done: false })).toEqual(
      { color: null, text: '젤리 7 / 20', done: false },
    );
    const goal = { type: 'clearObstacle', obstacle: 'lock', count: 3 } as const;
    expect(goalLine({ goal, current: 5, target: 3, done: true })).toEqual({
      color: null,
      text: '자물쇠 3 / 3',
      done: true,
    });
    const frost = { type: 'clearObstacle', obstacle: 'frost', count: 2 } as const;
    expect(goalLine({ goal: frost, current: 1, target: 2, done: false }).text).toBe('얼음 1 / 2');
  });
});

describe('scripts/sim: 봇도 장애물 미션을 StoryMode로 판정한다', () => {
  // 봇은 첫 힌트만 두므로 구석 젤리는 오래 남는다: 가운데 2×2에만 젤리를 둔다
  const center: StageDef = {
    id: 1,
    rows: 8,
    cols: 8,
    colors: 5,
    moves: 60,
    goals: [{ type: 'clearJelly' }],
    stars: [100, 200, 300],
    layers: Array.from({ length: 64 }, (_, i) =>
      [27, 28, 35, 36].includes(i) ? { jelly: 1 as const } : null,
    ),
  };

  it('이동이 넉넉하면 clearJelly를 클리어하고, 1번이면 실패', () => {
    const outcomes = [1, 2, 3, 4].map((seed) => playStage(center, seed));
    expect(outcomes.some((o) => o.cleared)).toBe(true);
    expect(playStage({ ...center, moves: 1 }, 1).cleared).toBe(false);
  });

  it('clearObstacle 세 종류도 판정되고 같은 seed는 같은 결과', () => {
    const stage = stageWith(
      [
        { type: 'clearObstacle', obstacle: 'lock', count: 2 },
        { type: 'clearObstacle', obstacle: 'frost', count: 1 },
        { type: 'clearObstacle', obstacle: 'jelly', count: 4 },
      ],
      200,
    );
    expect(playStage(stage, 5)).toEqual(playStage(stage, 5));
    expect(measureStage(stage, [1, 2, 3, 4]).clearRate).toBeGreaterThan(0);
  });
});
