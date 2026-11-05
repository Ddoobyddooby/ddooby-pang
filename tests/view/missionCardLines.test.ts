import { describe, expect, it } from 'vitest';
import type { Goal } from '../../src/data/stageSchema';
import { missionCardLines, missionLine } from '../../src/view/missionCardLines';

const stage = (goals: Goal[], id = 9, moves = 18) => ({ id, moves, goals });

describe('missionLine', () => {
  it('점수 미션은 쉼표 넣은 목표 + 넘기기', () => {
    expect(missionLine({ type: 'score', target: 2000 })).toEqual({
      color: null,
      text: '점수 2,000 넘기기!',
    });
  });

  it('수집 미션은 색 이름 없이 블록 그림(color) + 개수', () => {
    expect(missionLine({ type: 'collect', color: 4, count: 10 })).toEqual({
      color: 4,
      text: '10개 모으기!',
    });
  });

  it.each([
    [900, '점수 900 넘기기!'],
    [12500, '점수 12,500 넘기기!'],
    [1000000, '점수 1,000,000 넘기기!'],
  ])('점수 %i → %s', (target, text) => {
    expect(missionLine({ type: 'score', target }).text).toBe(text);
  });
});

describe('missionCardLines', () => {
  it('제목은 스테이지 번호, 마지막 줄은 이동 수', () => {
    const lines = missionCardLines(stage([{ type: 'score', target: 2000 }], 1, 25), 2);
    expect(lines.title).toBe('스테이지 1');
    expect(lines.movesText).toBe('이동 25번');
    expect(lines.goals).toEqual([{ color: null, text: '점수 2,000 넘기기!' }]);
  });

  it('수집 + 수집: 두 줄, 스테이지 순서 그대로', () => {
    const lines = missionCardLines(
      stage([
        { type: 'collect', color: 4, count: 10 },
        { type: 'collect', color: 5, count: 10 },
      ]),
      2,
    );
    expect(lines.goals).toEqual([
      { color: 4, text: '10개 모으기!' },
      { color: 5, text: '10개 모으기!' },
    ]);
  });

  it('점수 + 수집: 두 줄', () => {
    const lines = missionCardLines(
      stage([
        { type: 'score', target: 1300 },
        { type: 'collect', color: 2, count: 15 },
      ]),
      2,
    );
    expect(lines.goals).toEqual([
      { color: null, text: '점수 1,300 넘기기!' },
      { color: 2, text: '15개 모으기!' },
    ]);
  });

  it('미션이 maxLines보다 많으면 앞에서부터 자른다', () => {
    const goals: Goal[] = [
      { type: 'collect', color: 0, count: 5 },
      { type: 'collect', color: 1, count: 6 },
      { type: 'collect', color: 2, count: 7 },
    ];
    expect(missionCardLines(stage(goals), 2).goals.map((g) => g.color)).toEqual([0, 1]);
  });
});

describe('장애물 미션 아이콘', () => {
  it('clearJelly는 젤리, clearObstacle은 그 종류', () => {
    expect(missionLine({ type: 'clearJelly' }).obstacle).toBe('jelly');
    expect(missionLine({ type: 'clearObstacle', obstacle: 'lock', count: 3 }).obstacle).toBe(
      'lock',
    );
    expect(missionLine({ type: 'score', target: 10 }).obstacle).toBeUndefined();
  });
});
