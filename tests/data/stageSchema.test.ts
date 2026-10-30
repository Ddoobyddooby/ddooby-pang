import { describe, expect, it } from 'vitest';
import {
  COLOR_NAMES,
  StageError,
  colorFromName,
  colorName,
  parseStory,
  parseTimeAttack,
} from '../../src/data/stageSchema';

/** SPEC 6절 예시 */
const stage = (over: Record<string, unknown> = {}) => ({
  id: 1,
  rows: 8,
  cols: 8,
  colors: 5,
  moves: 20,
  goals: [
    { type: 'score', target: 3000 },
    { type: 'collect', color: 'red', count: 15 },
  ],
  stars: [3000, 6000, 9000],
  seed: 1001,
  ...over,
});

/** 실패해야 하고, 메시지에 위치(path)가 들어 있어야 한다 */
function failsAt(raw: unknown, path: string) {
  let error: unknown;
  try {
    parseStory(raw);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(StageError);
  expect((error as Error).message).toContain(`${path}:`);
}

describe('data/stageSchema: 색 이름', () => {
  it('red~orange ↔ Color 0~5', () => {
    expect(COLOR_NAMES).toEqual(['red', 'yellow', 'green', 'blue', 'purple', 'orange']);
    expect(COLOR_NAMES.map((n) => colorFromName(n))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(colorName(4)).toBe('purple');
    expect(colorFromName('pink')).toBeNull();
  });
});

describe('data/stageSchema: parseStory (PLAN 7.1)', () => {
  it('정상 스테이지 → StageDef. collect 색은 Color 숫자로 바뀐다', () => {
    const [def] = parseStory([stage()]);
    expect(def).toEqual({
      id: 1,
      rows: 8,
      cols: 8,
      colors: 5,
      moves: 20,
      goals: [
        { type: 'score', target: 3000 },
        { type: 'collect', color: 0, count: 15 },
      ],
      stars: [3000, 6000, 9000],
      seed: 1001,
    });
  });

  it('seed는 선택이고, 모르는 필드는 무시한다', () => {
    const raw = stage({ memo: '테스트', extra: { a: 1 } });
    delete (raw as Record<string, unknown>).seed;
    const [def] = parseStory([raw, stage({ id: 2 })]);
    expect(def).not.toHaveProperty('seed');
    expect(def).not.toHaveProperty('memo');
    expect(def).not.toHaveProperty('extra');
  });

  it('여러 스테이지: id가 1부터 순서대로', () => {
    const defs = parseStory([stage(), stage({ id: 2 }), stage({ id: 3, colors: 4 })]);
    expect(defs.map((d) => d.id)).toEqual([1, 2, 3]);
  });

  it('최상위가 배열이 아니거나 비어 있으면 실패', () => {
    failsAt({}, 'story');
    failsAt([], 'story');
    failsAt([42], 'story[0]');
  });

  it.each(['id', 'rows', 'cols', 'colors', 'moves', 'goals', 'stars'])('%s 누락 → 실패', (key) => {
    const raw = stage();
    delete (raw as Record<string, unknown>)[key];
    failsAt([raw], `story[0].${key}`);
  });

  it('id: 빈틈·중복·0부터 → 실패 (위치는 그 스테이지)', () => {
    failsAt([stage(), stage({ id: 3 })], 'story[1].id');
    failsAt([stage(), stage({ id: 1 })], 'story[1].id');
    failsAt([stage({ id: 0 })], 'story[0].id');
  });

  it('rows / cols: 5~10 정수', () => {
    failsAt([stage({ rows: 4 })], 'story[0].rows');
    failsAt([stage({ rows: 11 })], 'story[0].rows');
    failsAt([stage({ cols: 7.5 })], 'story[0].cols');
    expect(parseStory([stage({ rows: 5, cols: 10 })])[0]).toMatchObject({ rows: 5, cols: 10 });
  });

  it('colors: 4~6', () => {
    failsAt([stage({ colors: 3 })], 'story[0].colors');
    failsAt([stage({ colors: 7 })], 'story[0].colors');
    expect(parseStory([stage({ colors: 4 })])[0]!.colors).toBe(4);
    expect(parseStory([stage({ colors: 6 })])[0]!.colors).toBe(6);
  });

  it('moves: 1 이상 정수', () => {
    failsAt([stage({ moves: 0 })], 'story[0].moves');
    failsAt([stage({ moves: '20' })], 'story[0].moves');
  });

  it('goals: 1개 이상, 종류별 검사', () => {
    failsAt([stage({ goals: [] })], 'story[0].goals');
    failsAt([stage({ goals: [{ type: 'time', target: 1 }] })], 'story[0].goals[0].type');
    failsAt([stage({ goals: [{ type: 'score', target: 0 }] })], 'story[0].goals[0].target');
    failsAt(
      [stage({ goals: [{ type: 'collect', color: 'red', count: 0 }] })],
      'story[0].goals[0].count',
    );
    failsAt(
      [stage({ goals: [{ type: 'collect', color: 'pink', count: 3 }] })],
      'story[0].goals[0].color',
    );
  });

  it('collect 색은 그 스테이지 colors 안이어야 한다', () => {
    // colors 4 = red, yellow, green, blue. purple(4)은 밖
    failsAt(
      [stage({ colors: 4, goals: [{ type: 'collect', color: 'purple', count: 3 }] })],
      'story[0].goals[0].color',
    );
    const [def] = parseStory([
      stage({ colors: 4, goals: [{ type: 'collect', color: 'blue', count: 3 }] }),
    ]);
    expect(def!.goals).toEqual([{ type: 'collect', color: 3, count: 3 }]);
  });

  it('stars: 정수 3개, 엄격히 오름차순', () => {
    failsAt([stage({ stars: [9000, 6000, 3000] })], 'story[0].stars');
    failsAt([stage({ stars: [3000, 3000, 9000] })], 'story[0].stars');
    failsAt([stage({ stars: [3000, 6000] })], 'story[0].stars');
    failsAt([stage({ stars: [3000, 6000, 9000.5] })], 'story[0].stars');
  });

  it('seed가 있으면 정수', () => {
    failsAt([stage({ seed: 'abc' })], 'story[0].seed');
  });

  it('에러 메시지 예: story[3].goals[0].count', () => {
    const raw = [1, 2, 3, 4].map((id) => stage({ id }));
    raw[3] = stage({ id: 4, goals: [{ type: 'collect', color: 'red', count: -1 }] });
    expect(() => parseStory(raw)).toThrow('story[3].goals[0].count: 1 이상의 정수여야 한다');
  });
});

describe('data/stageSchema: parseTimeAttack', () => {
  const ta = (over: Record<string, unknown> = {}) => ({
    rows: 8,
    cols: 8,
    colors: 5,
    timeLimit: 60,
    ...over,
  });

  it('정상 → TimeAttackDef (seed 선택, 모르는 필드 무시)', () => {
    expect(parseTimeAttack(ta({ memo: 'x' }))).toEqual({
      rows: 8,
      cols: 8,
      colors: 5,
      timeLimit: 60,
    });
    expect(parseTimeAttack(ta({ seed: 7 }))).toMatchObject({ seed: 7 });
  });

  it('실패: 객체가 아님, timeLimit 누락·0, colors 3, rows 11', () => {
    const fails = (raw: unknown, path: string) => {
      expect(() => parseTimeAttack(raw)).toThrow(StageError);
      expect(() => parseTimeAttack(raw)).toThrow(`${path}:`);
    };
    fails([], 'timeattack');
    const missing = ta();
    delete (missing as Record<string, unknown>).timeLimit;
    fails(missing, 'timeattack.timeLimit');
    fails(ta({ timeLimit: 0 }), 'timeattack.timeLimit');
    fails(ta({ colors: 3 }), 'timeattack.colors');
    fails(ta({ rows: 11 }), 'timeattack.rows');
  });
});
