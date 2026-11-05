import { describe, expect, it } from 'vitest';
import { StageError, parseStory } from '../../src/data/stageSchema';
import { obstacleStage } from '../../src/dev/obstacleStage';
import storyRaw from '../../public/stages/story.json?raw';

/** SPEC v0.2 4.3 예시를 5×5로 줄인 것 */
const stage = (over: Record<string, unknown> = {}) => ({
  id: 1,
  rows: 5,
  cols: 5,
  colors: 5,
  moves: 20,
  layout: ['.....', '.FF..', '.....', 'LK...', 'JJJJJ'],
  layers: {
    F: { type: 'frost', hp: 3 },
    L: { type: 'lock' },
    J: { type: 'jelly', hp: 1 },
    K: [{ type: 'lock' }, { type: 'jelly', hp: 2 }],
  },
  goals: [{ type: 'clearJelly' }],
  stars: [3000, 6000, 9000],
  seed: 1027,
  ...over,
});

/** 키를 뺀 사본 */
function without(o: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
}

function failsAt(raw: unknown, path: string) {
  let error: unknown;
  try {
    parseStory([raw]);
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(StageError);
  expect((error as Error).message).toContain(`${path}:`);
}

describe('data/stageSchema: layout·layers (SPEC v0.2 4.3, PLAN2 5.4)', () => {
  it('layout + layers → 칸마다 층 (index = r * cols + c, "."은 null)', () => {
    const [def] = parseStory([stage()]);
    const layers = def!.layers!;
    expect(layers).toHaveLength(25);
    expect(layers[0]).toBeNull();
    expect(layers[6]).toEqual({ frost: 3 });
    expect(layers[7]).toEqual({ frost: 3 });
    expect(layers[15]).toEqual({ lock: true });
    expect(layers[16]).toEqual({ lock: true, jelly: 2 });
    expect(layers.slice(20)).toEqual(Array(5).fill({ jelly: 1 }));
    expect(def!.goals).toEqual([{ type: 'clearJelly' }]);
  });

  it('layout이 없으면 layers도 없다 (v0.1 형식)', () => {
    const v01 = without(stage(), 'layout', 'layers');
    const [def] = parseStory([{ ...v01, goals: [{ type: 'score', target: 100 }] }]);
    expect(def).not.toHaveProperty('layers');
  });

  it('layout 행 수·길이가 rows·cols와 다르면 실패', () => {
    failsAt(stage({ layout: ['.....', '.....', '.....', '.....'] }), 'story[0].layout');
    failsAt(stage({ layout: 'JJJJJ' }), 'story[0].layout');
    failsAt(stage({ layout: ['.....', '....', '.....', '.....', 'JJJJJ'] }), 'story[0].layout[1]');
    failsAt(stage({ layout: ['.....', 5, '.....', '.....', 'JJJJJ'] }), 'story[0].layout[1]');
  });

  it('layers에 정의 없는 문자 → 실패 (위치는 그 칸)', () => {
    failsAt(
      stage({ layout: ['.....', '.FX..', '.....', '.....', 'JJJJJ'] }),
      'story[0].layout[1][2]',
    );
  });

  it('hp 범위: 얼음벽 1~3, 젤리 1~2', () => {
    failsAt(
      stage({ layers: { ...stage().layers, F: { type: 'frost', hp: 4 } } }),
      'story[0].layers.F.hp',
    );
    failsAt(
      stage({ layers: { ...stage().layers, F: { type: 'frost', hp: 0 } } }),
      'story[0].layers.F.hp',
    );
    failsAt(stage({ layers: { ...stage().layers, F: { type: 'frost' } } }), 'story[0].layers.F.hp');
    failsAt(
      stage({ layers: { ...stage().layers, J: { type: 'jelly', hp: 3 } } }),
      'story[0].layers.J.hp',
    );
  });

  it('얼음벽 + 잠금·젤리는 실패, 잠금 + 젤리는 된다', () => {
    const frostLock = [{ type: 'frost', hp: 1 }, { type: 'lock' }];
    const frostJelly = [
      { type: 'jelly', hp: 1 },
      { type: 'frost', hp: 2 },
    ];
    failsAt(stage({ layers: { ...stage().layers, F: frostLock } }), 'story[0].layers.F');
    failsAt(stage({ layers: { ...stage().layers, F: frostJelly } }), 'story[0].layers.F');
    expect(() => parseStory([stage()])).not.toThrow(); // K = 잠금 + 젤리
  });

  it('정의 형식: 모르는 type, 같은 type 두 번, 빈 배열, 여러 글자·"." 키, layout 없는 layers', () => {
    const layers = stage().layers;
    failsAt(stage({ layers: { ...layers, L: { type: 'ice' } } }), 'story[0].layers.L.type');
    failsAt(
      stage({ layers: { ...layers, L: [{ type: 'lock' }, { type: 'lock' }] } }),
      'story[0].layers.L[1].type',
    );
    failsAt(stage({ layers: { ...layers, L: [] } }), 'story[0].layers.L');
    failsAt(stage({ layers: { ...layers, LL: { type: 'lock' } } }), 'story[0].layers.LL');
    failsAt(stage({ layers: { ...layers, '.': { type: 'lock' } } }), 'story[0].layers..');
    failsAt(stage({ layers: [] }), 'story[0].layers');
    const noLayout = without(stage({ goals: [{ type: 'score', target: 1 }] }), 'layout');
    failsAt(noLayout, 'story[0].layers');
  });

  it('clearJelly: layout에 젤리가 없으면 실패', () => {
    failsAt(
      stage({ layout: ['.....', '.FF..', '.....', 'L....', '.....'] }),
      'story[0].goals[0].type',
    );
    const v01 = without(stage(), 'layout', 'layers');
    failsAt(v01, 'story[0].goals[0].type');
  });

  it('clearObstacle: obstacle은 lock·frost·jelly이고 layout에 있어야 하며 count ≥ 1', () => {
    const goal = (g: unknown) => stage({ goals: [g] });
    const [def] = parseStory([goal({ type: 'clearObstacle', obstacle: 'frost', count: 2 })]);
    expect(def!.goals).toEqual([{ type: 'clearObstacle', obstacle: 'frost', count: 2 }]);
    failsAt(
      goal({ type: 'clearObstacle', obstacle: 'ice', count: 2 }),
      'story[0].goals[0].obstacle',
    );
    failsAt(goal({ type: 'clearObstacle', obstacle: 'lock', count: 0 }), 'story[0].goals[0].count');
    failsAt(
      stage({
        layout: ['.....', '.....', '.....', '.....', 'JJJJJ'],
        goals: [{ type: 'clearObstacle', obstacle: 'lock', count: 1 }],
      }),
      'story[0].goals[0].obstacle',
    );
  });

  it('clearObstacle.count는 그 장애물의 처음 칸 수까지 (V2-W2-01 리뷰 3)', () => {
    // stage(): 얼음 2칸, 잠금 2칸(L·K), 젤리 6칸(J 5 + K 1)
    const goal = (obstacle: string, count: number) =>
      stage({ goals: [{ type: 'clearObstacle', obstacle, count }] });
    for (const [obstacle, max] of [
      ['frost', 2],
      ['lock', 2],
      ['jelly', 6],
    ] as const) {
      expect(() => parseStory([goal(obstacle, max)])).not.toThrow();
      failsAt(goal(obstacle, max + 1), 'story[0].goals[0].count');
    }
  });

  it('잠금에 hp가 있으면 실패 (V2-W2-01 리뷰 4)', () => {
    const layers = { ...stage().layers, L: { type: 'lock', hp: 999 } };
    failsAt(stage({ layers }), 'story[0].layers.L.hp');
    const inList = {
      ...stage().layers,
      K: [
        { type: 'lock', hp: 1 },
        { type: 'jelly', hp: 1 },
      ],
    };
    failsAt(stage({ layers: inList }), 'story[0].layers.K[0].hp');
  });

  it('기존 story.json 1~30은 layout 없이 그대로 로드된다', () => {
    const story = parseStory(JSON.parse(storyRaw));
    expect(story).toHaveLength(30);
    story.forEach((s) => expect(s).not.toHaveProperty('layers'));
  });

  it('DEV ?obstacles 시험 스테이지: 잠금·얼음 1~3·젤리 1~2·잠금+젤리가 다 있고 clearJelly', () => {
    const def = obstacleStage();
    const layers = def.layers!.filter((l) => l !== null);
    expect(layers).toContainEqual({ lock: true });
    for (const frost of [1, 2, 3]) expect(layers).toContainEqual({ frost });
    for (const jelly of [1, 2]) expect(layers).toContainEqual({ jelly });
    expect(layers).toContainEqual({ lock: true, jelly: 1 });
    expect(def.goals).toEqual([{ type: 'clearJelly' }]);
  });
});
