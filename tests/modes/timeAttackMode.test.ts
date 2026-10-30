import { describe, expect, it } from 'vitest';
import { TIMEATTACK } from '../../src/config';
import { resolveSwap } from '../../src/core/engine';
import { createRng } from '../../src/core/rng';
import type { ResolveResult } from '../../src/core/types';
import { TimeAttackMode } from '../../src/modes/TimeAttackMode';
import { parseBoard } from '../helpers/board';

/** onResolve는 scoreDelta만 본다 */
const fake = (scoreDelta: number, valid = true): ResolveResult => ({
  state: { board: parseBoard('R'), rngState: createRng(1), colors: 6 },
  steps: [],
  scoreDelta,
  removedByColor: [0, 0, 0, 0, 0, 0],
  valid,
});

/** (0,2) Y ↔ (1,2) R → 0행 R R R, seed 1에서는 연쇄 없이 30점 (engine.test.ts와 같은 보드) */
function realResult(): ResolveResult {
  const board = parseBoard(`
    R R Y B
    G B R G
    Y G B Y
    B Y G R
  `);
  return resolveSwap({ board, rngState: createRng(1), colors: 6 }, { r: 0, c: 2 }, { r: 1, c: 2 });
}

describe('modes/TimeAttackMode (PLAN 5절)', () => {
  it('시작: 60초 남음, 입력 가능, 진행 중', () => {
    const mode = new TimeAttackMode();
    expect(mode.kind).toBe('timeattack');
    expect(mode.timeLeftMs()).toBe(TIMEATTACK.timeLimitMs);
    expect(mode.timeLeftMs()).toBe(60000);
    expect(mode.canInput()).toBe(true);
    expect(mode.isOver()).toBe(false);
    expect(mode.score()).toBe(0);
  });

  it('tick은 시간을 줄인다. 0 이하·유한수가 아닌 값은 무시', () => {
    const mode = new TimeAttackMode();
    mode.tick(1000);
    expect(mode.timeLeftMs()).toBe(59000);
    for (const dt of [0, -5, NaN, Infinity, -Infinity]) mode.tick(dt);
    expect(mode.timeLeftMs()).toBe(59000);
  });

  it('시간이 다 되면 0에서 멈추고 입력을 막는다', () => {
    const mode = new TimeAttackMode();
    mode.tick(70000);
    expect(mode.timeLeftMs()).toBe(0);
    expect(mode.canInput()).toBe(false);
    expect(mode.isOver()).toBe(true);
    mode.tick(1000);
    expect(mode.timeLeftMs()).toBe(0);
  });

  it('timeLimitMs를 생성자로 바꿀 수 있다', () => {
    const mode = new TimeAttackMode({ timeLimitMs: 5000 });
    expect(mode.timeLeftMs()).toBe(5000);
    mode.tick(5000);
    expect(mode.isOver()).toBe(true);
  });

  it('onResolve: scoreDelta를 누적한다. 무효 스왑(0점)은 변화 없음', () => {
    const mode = new TimeAttackMode();
    const real = realResult();
    expect(real.scoreDelta).toBe(30);
    mode.onResolve(real);
    mode.onResolve(fake(120));
    expect(mode.score()).toBe(150);
    mode.onResolve(fake(0, false));
    expect(mode.score()).toBe(150);
  });

  it('시간 0 이후에 들어온 onResolve도 점수에 더한다 (진행 중 연쇄 반영)', () => {
    const mode = new TimeAttackMode();
    mode.onResolve(fake(100));
    mode.tick(60000);
    expect(mode.isOver()).toBe(true);
    mode.onResolve(fake(45));
    expect(mode.score()).toBe(145);
    expect(mode.result().score).toBe(145);
  });

  it('result: newBest는 점수가 bestScore보다 클 때만, bestScore는 생성자 값 그대로', () => {
    const run = (bestScore: number | undefined, delta: number) => {
      const mode = new TimeAttackMode(bestScore === undefined ? {} : { bestScore });
      mode.onResolve(fake(delta));
      mode.tick(60000);
      return mode.result();
    };
    expect(run(100, 150)).toEqual({
      kind: 'timeattack',
      score: 150,
      bestScore: 100,
      newBest: true,
    });
    expect(run(150, 150)).toEqual({
      kind: 'timeattack',
      score: 150,
      bestScore: 150,
      newBest: false,
    });
    expect(run(200, 150)).toEqual({
      kind: 'timeattack',
      score: 150,
      bestScore: 200,
      newBest: false,
    });
    expect(run(undefined, 30)).toEqual({
      kind: 'timeattack',
      score: 30,
      bestScore: 0,
      newBest: true,
    });
  });

  it('결정적: 같은 입력 → 같은 결과', () => {
    const play = () => {
      const mode = new TimeAttackMode({ bestScore: 50 });
      const inputs: [number, number][] = [
        [1000, 30],
        [16.7, 0],
        [2500, 120],
        [70000, 45],
      ];
      for (const [dt, delta] of inputs) {
        mode.tick(dt);
        mode.onResolve(fake(delta, delta > 0));
      }
      return { timeLeft: mode.timeLeftMs(), result: mode.result() };
    };
    expect(play()).toEqual(play());
  });
});
