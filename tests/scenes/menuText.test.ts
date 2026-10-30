import { describe, expect, it } from 'vitest';
import { storyLabel, storyProgress, timeAttackLabel } from '../../src/scenes/menuText';
import { defaultSave, type SaveData } from '../../src/storage/progress';

function saveWith(unlocked: number, bestStars: SaveData['story']['bestStars']): SaveData {
  const save = defaultSave();
  return { ...save, story: { ...save.story, unlocked, bestStars } };
}

describe('scenes/menuText (스토리 화면 설계 2절)', () => {
  it('storyProgress: 열린 수 = min(unlocked, 전체), 별 합계', () => {
    expect(storyProgress(saveWith(3, { 1: 3, 2: 2 }), 10)).toEqual({
      opened: 3,
      total: 10,
      stars: 5,
    });
    expect(storyProgress(defaultSave(), 10)).toEqual({ opened: 1, total: 10, stars: 0 });
    // 10번 클리어하면 unlocked가 11이 된다
    expect(storyProgress(saveWith(11, { 10: 1 }), 10)).toMatchObject({ opened: 10 });
  });

  it('storyLabel: "스테이지 3 / 10 ★ 5" (가운뎃점 없음)', () => {
    expect(storyLabel({ opened: 3, total: 10, stars: 5 })).toBe('스테이지 3 / 10 ★ 5');
    expect(storyLabel({ opened: 1, total: 10, stars: 0 })).toBe('스테이지 1 / 10 ★ 0');
  });

  it('timeAttackLabel: 최고 점수(콤마), 기록이 없으면 "처음 도전!"', () => {
    expect(timeAttackLabel(12450)).toBe('최고 12,450점');
    expect(timeAttackLabel(0)).toBe('처음 도전!');
  });
});
