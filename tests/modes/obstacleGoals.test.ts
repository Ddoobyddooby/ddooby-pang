// V2-W2-01: 장애물 미션은 타입·문구만. 진행 판정은 V2-W2-04
import { describe, expect, it } from 'vitest';
import { obstacleStage } from '../../src/dev/obstacleStage';
import { StoryMode } from '../../src/modes/StoryMode';
import { missionLine } from '../../src/view/missionCardLines';
import { goalLine } from '../../src/view/storyLines';

describe('장애물 미션 (V2-W2-01 자리 잡기)', () => {
  it('clearJelly는 아직 진행되지 않는다 (done 거짓)', () => {
    const mode = new StoryMode(obstacleStage());
    expect(mode.goalProgress()).toEqual([
      { goal: { type: 'clearJelly' }, current: 0, done: false },
    ]);
  });

  it('미션 카드·패널 문구', () => {
    expect(missionLine({ type: 'clearJelly' })).toEqual({ color: null, text: '젤리 모두 없애기!' });
    expect(missionLine({ type: 'clearObstacle', obstacle: 'frost', count: 4 })).toEqual({
      color: null,
      text: '얼음 4개 없애기!',
    });
    const goal = { type: 'clearObstacle', obstacle: 'lock', count: 3 } as const;
    expect(goalLine({ goal, current: 5, done: true })).toEqual({
      color: null,
      text: '자물쇠 3 / 3',
      done: true,
    });
  });
});
