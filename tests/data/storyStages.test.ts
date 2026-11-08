// public/stages/story.json 30개의 데이터 규칙 (PLAN2 6.6, SPEC 6절). 숫자 조정(V2-W4-01)이 이 규칙을 깨지 않게 막는다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HUD } from '../../src/config';
import { createInitialState } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import { parseStory, type ObstacleKind, type StageDef } from '../../src/data/stageSchema';

const stages: StageDef[] = parseStory(JSON.parse(readFileSync('public/stages/story.json', 'utf8')));

/** 시작 보드에 깔린 장애물 종류 */
const kindsIn = (s: StageDef): Set<ObstacleKind> => {
  const kinds = new Set<ObstacleKind>();
  for (const l of s.layers ?? []) {
    if (l?.lock) kinds.add('lock');
    if (l?.frost) kinds.add('frost');
    if (l?.jelly) kinds.add('jelly');
  }
  return kinds;
};
const range = (from: number, to: number) => stages.filter((s) => s.id >= from && s.id <= to);

describe('story.json 30개', () => {
  // 30개·id 1~30·스키마·별 오름차순은 stories.test.ts

  it('미션 수가 화면 줄 수(HUD.story.maxGoalLines) 이하다', () => {
    for (const s of stages) {
      expect(s.goals.length, `#${s.id}`).toBeLessThanOrEqual(HUD.story.maxGoalLines);
    }
  });

  describe('장애물 첫 등장 순서 (있으면 그 구간 이후에만)', () => {
    it.each([
      ['lock', 11],
      ['frost', 16],
      ['jelly', 21],
    ] as const)('%s는 %i번부터', (kind, first) => {
      for (const s of stages.filter((x) => x.id < first)) {
        expect(kindsIn(s).has(kind), `#${s.id}에 ${kind}`).toBe(false);
      }
    });

    it('장애물 미션도 같은 순서를 지킨다', () => {
      const first = { lock: 11, frost: 16, jelly: 21 };
      for (const s of stages) {
        for (const g of s.goals) {
          if (g.type === 'clearObstacle')
            expect(s.id, `#${s.id} ${g.obstacle}`).toBeGreaterThanOrEqual(first[g.obstacle]);
          if (g.type === 'clearJelly')
            expect(s.id, `#${s.id} clearJelly`).toBeGreaterThanOrEqual(first.jelly);
        }
      }
    });

    // 데이터가 나온 뒤 켠다 (claude-1의 story.json 재조정). 지금은 장애물이 없어 실패한다
    it.skip('11·16·21번에 해당 장애물이 실제로 있다', () => {
      expect(kindsIn(stages[10]!).has('lock')).toBe(true);
      expect(kindsIn(stages[15]!).has('frost')).toBe(true);
      expect(kindsIn(stages[20]!).has('jelly')).toBe(true);
    });
  });

  describe('구간별 색 수', () => {
    // 1~10번은 v0.1 값 그대로 (SPEC 6절 "색 4~6개 유지")
    it('1~10번은 지금 값이다', () => {
      expect(range(1, 10).map((s) => s.colors)).toEqual([4, 4, 4, 5, 5, 5, 5, 6, 6, 6]);
    });

    it('16~20번은 5~6색이다', () => {
      for (const s of range(16, 20)) expect(s.colors, `#${s.id}`).toBeGreaterThanOrEqual(5);
    });

    // 새 데이터(PLAN2 6.6)가 들어오면 켠다. 지금 story.json에서는 실패한다 (22·26번 5색)
    it.skip('11~15번은 5색, 21~30번은 6색이다 (PLAN2 6.6)', () => {
      for (const s of range(11, 15)) expect(s.colors, `#${s.id}`).toBe(5);
      for (const s of range(21, 30)) expect(s.colors, `#${s.id}`).toBe(6);
    });
  });

  describe('이동 수 (PLAN2 6.6)', () => {
    // 1~10번의 v0.1(W4-27) 이동 수. 재조정 전 값이라 story.json이 바뀐 뒤에도 기준이다
    const V01_MOVES = [38, 38, 33, 38, 33, 33, 30, 30, 27, 27];

    // 새 데이터가 들어오면 켠다. 지금은 v0.1 값 그대로라 실패한다
    it.skip('1~10번은 v0.1 이동의 85~90%다', () => {
      for (const s of range(1, 10)) {
        const base = V01_MOVES[s.id - 1]!;
        expect(s.moves, `#${s.id}`).toBeGreaterThanOrEqual(Math.floor(base * 0.85));
        expect(s.moves, `#${s.id}`).toBeLessThanOrEqual(Math.ceil(base * 0.9));
      }
    });

    it.skip('11~30번은 25~32다', () => {
      for (const s of range(11, 30)) {
        expect(s.moves, `#${s.id}`).toBeGreaterThanOrEqual(25);
        expect(s.moves, `#${s.id}`).toBeLessThanOrEqual(32);
      }
    });
  });

  describe('시작 보드', () => {
    it.each(stages.map((s) => [s.id, s] as const))(
      '#%i seed 1~20 모두 가능한 수가 있다',
      (_, s) => {
        for (let seed = 1; seed <= 20; seed++) {
          const state = createInitialState({
            rows: s.rows,
            cols: s.cols,
            colors: s.colors,
            seed,
            layers: s.layers,
          });
          expect(findHint(state.board), `seed ${seed}`).not.toBeNull();
        }
      },
    );
  });
});
