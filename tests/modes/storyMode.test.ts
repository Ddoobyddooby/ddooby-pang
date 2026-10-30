import { describe, expect, it } from 'vitest';
import { resolveSwap } from '../../src/core/engine';
import { createRng } from '../../src/core/rng';
import type { ResolveResult } from '../../src/core/types';
import type { Goal, StageDef } from '../../src/data/stageSchema';
import type { GameMode } from '../../src/modes/GameMode';
import { StoryMode } from '../../src/modes/StoryMode';
import { parseBoard } from '../helpers/board';

function stageWith(goals: Goal[], moves = 5): StageDef {
  return { id: 7, rows: 8, cols: 8, colors: 5, moves, goals, stars: [100, 200, 300] };
}

/** onResolve는 valid, scoreDelta, removedByColor만 본다 */
function fake(scoreDelta: number, removed: Partial<Record<number, number>> = {}): ResolveResult {
  const removedByColor = [0, 1, 2, 3, 4, 5].map((c) => removed[c] ?? 0);
  return {
    state: { board: parseBoard('R'), rngState: createRng(1), colors: 5 },
    steps: [],
    scoreDelta,
    removedByColor,
    valid: true,
  };
}

const INVALID: ResolveResult = { ...fake(0), valid: false };

/** (0,2) Y ↔ (1,2) R → 0행 R R R. seed 1에서는 연쇄 없이 30점, 빨강 3개 (engine.test.ts와 같은 보드) */
function realThreeRed(): ResolveResult {
  const board = parseBoard(`
    R R Y B
    G B R G
    Y G B Y
    B Y G R
  `);
  return resolveSwap({ board, rngState: createRng(1), colors: 6 }, { r: 0, c: 2 }, { r: 1, c: 2 });
}

/** (0,0) 컬러 ↔ (0,1) Y: 노랑 2개 + 컬러 블록 자신이 특수 효과로 지워진다 (engine.test.ts의 컬러 스왑 보드) */
function realColorBurst(): ResolveResult {
  const board = parseBoard(`
    C Y R
    G R B
    Y B G
  `);
  return resolveSwap({ board, rngState: createRng(1), colors: 5 }, { r: 0, c: 0 }, { r: 0, c: 1 });
}

describe('modes/StoryMode (PLAN 5절)', () => {
  it('시작: 이동 수 그대로, 입력 가능, 진행 중, 미션 진행 0', () => {
    const mode = new StoryMode(stageWith([{ type: 'score', target: 100 }], 20));
    expect(mode.kind).toBe('story');
    expect(mode.movesLeft()).toBe(20);
    expect(mode.canInput()).toBe(true);
    expect(mode.isOver()).toBe(false);
    expect(mode.score()).toBe(0);
    expect(mode.goalProgress()).toEqual([
      { goal: { type: 'score', target: 100 }, current: 0, done: false },
    ]);
  });

  it('무효 스왑은 이동을 깎지 않는다. tick은 아무것도 안 한다', () => {
    const mode = new StoryMode(stageWith([{ type: 'score', target: 100 }], 3));
    mode.onResolve(INVALID);
    const asMode: GameMode = mode; // 씬은 GameMode로 부른다
    asMode.tick(60000);
    expect(mode.movesLeft()).toBe(3);
    expect(mode.isOver()).toBe(false);
  });

  it('실제 resolveSwap 결과: 점수와 색 수집이 들어간다', () => {
    const mode = new StoryMode(
      stageWith([
        { type: 'score', target: 100 },
        { type: 'collect', color: 0, count: 5 },
      ]),
    );
    const real = realThreeRed();
    expect(real.scoreDelta).toBe(30);
    mode.onResolve(real);
    expect(mode.movesLeft()).toBe(4);
    expect(mode.score()).toBe(30);
    expect(mode.goalProgress().map((g) => g.current)).toEqual([30, 3]);
    expect(mode.isOver()).toBe(false);
  });

  it('collect는 특수 효과로 제거된 블록도 센다 (컬러 스왑 발동)', () => {
    const mode = new StoryMode(stageWith([{ type: 'collect', color: 1, count: 2 }]));
    const real = realColorBurst();
    // 이 결과에서 노랑은 전부 컬러 블록 효과(bySpecial)로 지워졌다
    const removed = real.steps[1]!.flatMap((e) => (e.type === 'remove' ? e.blocks : []));
    expect(removed.every((b) => b.bySpecial)).toBe(true);
    mode.onResolve(real);
    expect(mode.goalProgress()[0]!.current).toBe(real.removedByColor[1]);
    expect(mode.goalProgress()[0]!.done).toBe(true);
    expect(mode.result()).toMatchObject({ cleared: true });
  });

  it('마지막 이동에서 미션을 달성하면 클리어', () => {
    const mode = new StoryMode(stageWith([{ type: 'score', target: 100 }], 2));
    mode.onResolve(fake(40));
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake(60));
    expect(mode.movesLeft()).toBe(0);
    expect(mode.isOver()).toBe(true);
    expect(mode.canInput()).toBe(false);
    expect(mode.result()).toMatchObject({ kind: 'story', stageId: 7, cleared: true });
  });

  it('이동 0 + 미달성 → 실패', () => {
    const mode = new StoryMode(stageWith([{ type: 'score', target: 100 }], 2));
    mode.onResolve(fake(40));
    mode.onResolve(fake(40));
    expect(mode.isOver()).toBe(true);
    expect(mode.canInput()).toBe(false);
    expect(mode.result()).toMatchObject({ cleared: false, score: 80, stars: 0 });
  });

  it('복수 미션은 전부 달성해야 클리어', () => {
    const mode = new StoryMode(
      stageWith([
        { type: 'score', target: 100 },
        { type: 'collect', color: 2, count: 6 },
      ]),
    );
    mode.onResolve(fake(150, { 2: 3 }));
    expect(mode.goalProgress().map((g) => g.done)).toEqual([true, false]);
    expect(mode.isOver()).toBe(false);
    mode.onResolve(fake(30, { 2: 4 }));
    // current는 목표를 넘어도 그대로 센다
    expect(mode.goalProgress().map((g) => g.current)).toEqual([180, 7]);
    expect(mode.isOver()).toBe(true);
    expect(mode.result()).toMatchObject({ cleared: true });
  });

  it('끝난 뒤에 들어온 결과는 무시한다', () => {
    const mode = new StoryMode(stageWith([{ type: 'score', target: 50 }], 3));
    mode.onResolve(fake(60));
    expect(mode.isOver()).toBe(true);
    mode.onResolve(fake(100));
    expect(mode.score()).toBe(60);
    expect(mode.movesLeft()).toBe(2);
  });
});
