import { describe, expect, it } from 'vitest';
import { canPause, pauseButtons } from '../../src/scenes/pauseRules';

describe('canPause', () => {
  it('게임 중이면 된다 (재생 중이어도)', () => {
    expect(canPause({ finished: false, paused: false })).toBe(true);
  });

  it('이미 멈췄거나 게임이 끝났으면 안 된다', () => {
    expect(canPause({ finished: false, paused: true })).toBe(false);
    expect(canPause({ finished: true, paused: false })).toBe(false);
    expect(canPause({ finished: true, paused: true })).toBe(false);
  });
});

describe('pauseButtons', () => {
  it('스토리: 계속 / 다시하기 / 지도', () => {
    expect(pauseButtons({ mode: 'story', stageId: 3 })).toEqual(['resume', 'retry', 'map']);
  });

  it('경쟁: 계속 / 다시하기 / 메뉴', () => {
    expect(pauseButtons({ mode: 'timeattack' })).toEqual(['resume', 'retry', 'menu']);
  });
});
