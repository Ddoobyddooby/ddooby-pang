// 메뉴 버튼 안의 진행 상황 문구 (스토리 화면 설계 2절). 순수 함수라 테스트한다.
// Jua에 가운뎃점(·)이 없어서 띄어쓰기로 구분한다.

import type { SaveData } from '../storage/progress';
import { formatScore } from './resultText';

export interface StoryProgress {
  /** 열린 스테이지 수 (10번 클리어 후 unlocked 11이어도 전체 수를 넘지 않는다) */
  opened: number;
  total: number;
  /** 스테이지별 최고 별의 합 */
  stars: number;
}

export function storyProgress(save: SaveData, stageCount: number): StoryProgress {
  const stars = Object.values(save.story.bestStars).reduce<number>((sum, s) => sum + s, 0);
  return { opened: Math.min(save.story.unlocked, stageCount), total: stageCount, stars };
}

/** "스테이지 3 / 10 ★ 5" */
export function storyLabel({ opened, total, stars }: StoryProgress): string {
  return `스테이지 ${opened} / ${total} ★ ${stars}`;
}

/** "최고 12,450점", 기록이 없으면 "처음 도전!" */
export function timeAttackLabel(bestScore: number): string {
  return bestScore > 0 ? `최고 ${formatScore(bestScore)}점` : '처음 도전!';
}
