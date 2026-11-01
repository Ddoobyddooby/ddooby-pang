import { describe, expect, it } from 'vitest';
import { MENU } from '../../src/config';
import { gameTitle } from '../../src/view/gameTitle';
import { missionCardLines } from '../../src/view/missionCardLines';

describe('gameTitle', () => {
  it.each([
    [1, '스테이지 1'],
    [9, '스테이지 9'],
    [10, '스테이지 10'],
  ])('스토리 %i → %s', (stageId, title) => {
    expect(gameTitle({ mode: 'story', stageId })).toBe(title);
  });

  it('경쟁은 메뉴 버튼과 같은 말', () => {
    expect(gameTitle({ mode: 'timeattack' })).toBe('경쟁 60초');
    expect(gameTitle({ mode: 'timeattack' })).toBe(MENU.timeattack.text);
  });

  it('미션 카드 첫 줄과 같다', () => {
    const stage = { id: 7, moves: 20, goals: [{ type: 'score', target: 1300 }] as const };
    expect(missionCardLines(stage, 2).title).toBe(gameTitle({ mode: 'story', stageId: 7 }));
  });
});
