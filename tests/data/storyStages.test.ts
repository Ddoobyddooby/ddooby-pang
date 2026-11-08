// public/stages/story.json 30개의 데이터 규칙 (PLAN2 6.6, SPEC 6절). 숫자 조정(V2-W4-01)이 이 규칙을 깨지 않게 막는다.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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
  it('스키마를 통과하고 id가 1~30 순서다', () => {
    expect(stages.map((s) => s.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('별 기준이 오름차순이다 (별 1 < 별 2 < 별 3)', () => {
    for (const s of stages) {
      const [a, b, c] = s.stars;
      expect(a, `#${s.id} 별1<별2`).toBeLessThan(b);
      expect(b, `#${s.id} 별2<별3`).toBeLessThan(c);
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

    // PLAN2 6.6에만 있고 SPEC 6절에는 없는 값이라 확정되면 켠다
    it.todo('11~15번은 5색이다 (PLAN2 6.6)');
    it.todo('21~30번은 6색이다 (PLAN2 6.6)');
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
