// 스테이지 지도의 노드 위치와 상태 (스토리 화면 설계 3절). Phaser 없는 순수 함수라 테스트한다.

import { MAP } from '../config';

export type NodeState = 'done' | 'current' | 'locked';

/**
 * 1번(맨 아래)부터 count번(맨 위)까지 노드 중심 좌표. 폭 720 기준.
 * y는 MAP.top ~ (height - MAP.bottomPad)를 고르게 나누고, x는 MAP.xs의 구불구불한 길을 따른다
 */
export function mapNodes(count: number, height: number): { x: number; y: number }[] {
  const bottom = height - MAP.bottomPad;
  const step = count > 1 ? (bottom - MAP.top) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: MAP.xs[i % MAP.xs.length]!,
    y: bottom - i * step,
  }));
}

/** unlocked = 저장 데이터의 열린 번호. 열린 것 중 가장 높은 번호가 지금 할 곳 (전부 클리어면 없음) */
export function nodeStates(unlocked: number, count: number): NodeState[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    if (id < unlocked) return 'done';
    return id === unlocked ? 'current' : 'locked';
  });
}
