// 스테이지 지도의 노드 위치·상태와 스크롤 계산 (스토리 화면 설계 3절, PLAN 6.12). Phaser 없는 순수 함수라 테스트한다.
//
// 좌표는 "세계 좌표": 길 전체를 위(0)에서 아래(worldHeight)로 잰다. 화면보다 길면 위로 스크롤한다.
// 스크롤 양 scroll은 0 = 맨 아래(1번 쪽)가 보임, maxScroll = 맨 위가 보임.
// 화면에 그릴 때 세계 y → 화면 y = y + contentY(scroll) (contentY는 내용 묶음을 옮기는 값).

import { MAP } from '../config';

export type NodeState = 'done' | 'current' | 'locked';

export interface MapLayout {
  /** 1번(맨 아래)부터 count번(맨 위)까지 노드 중심. 폭 720 기준 */
  nodes: { x: number; y: number }[];
  /** 세계 높이. 화면에 다 들어가면 화면 높이와 같다 */
  worldHeight: number;
}

/**
 * 노드 사이 간격은 화면에 다 들어가면 화면을 고르게 나누고(10개 이하는 지금처럼 한 화면),
 * 넘치면 MAP.gap으로 고정해 길이 위로 늘어난다. x는 MAP.xs의 구불구불한 길을 따른다
 */
export function mapNodes(count: number, screenHeight: number): MapLayout {
  const fit = count > 1 ? (screenHeight - MAP.bottomPad - MAP.top) / (count - 1) : 0;
  const gap = Math.max(MAP.gap, fit);
  const worldHeight = Math.max(screenHeight, MAP.top + (count - 1) * gap + MAP.bottomPad);
  const bottom = worldHeight - MAP.bottomPad;
  return {
    nodes: Array.from({ length: count }, (_, i) => ({
      x: MAP.xs[i % MAP.xs.length]!,
      y: bottom - i * gap,
    })),
    worldHeight,
  };
}

/** unlocked = 저장 데이터의 열린 번호. 열린 것 중 가장 높은 번호가 지금 할 곳 (전부 클리어면 없음) */
export function nodeStates(unlocked: number, count: number): NodeState[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    if (id < unlocked) return 'done';
    return id === unlocked ? 'current' : 'locked';
  });
}

/** 스크롤할 수 있는 최대 양 (화면보다 짧으면 0 = 스크롤 없음) */
export function maxScroll(worldHeight: number, screenHeight: number): number {
  return Math.max(0, worldHeight - screenHeight);
}

/** 위·아래 끝에서 더 못 넘어가게 */
export function clampScroll(scroll: number, worldHeight: number, screenHeight: number): number {
  return Math.min(Math.max(0, scroll), maxScroll(worldHeight, screenHeight));
}

/** 내용 묶음의 화면 y 위치: scroll 0이면 세계의 맨 아래가 화면 맨 아래에 붙는다 */
export function contentY(scroll: number, worldHeight: number, screenHeight: number): number {
  return screenHeight - worldHeight + scroll;
}

/** 세계 y가 화면 가운데에 오는 scroll (끝을 넘으면 끝에서 멈춘다) */
export function scrollToCenter(worldY: number, worldHeight: number, screenHeight: number): number {
  return clampScroll(worldHeight - worldY - screenHeight / 2, worldHeight, screenHeight);
}

/** 누른 곳에서 문턱보다 멀리 움직였으면 끌기 (아니면 누르기로 본다) */
export function isDrag(dx: number, dy: number, threshold: number): boolean {
  return Math.hypot(dx, dy) > threshold;
}

/**
 * 지도에 들어왔을 때 가운데 둘 노드(0부터). 지금 할 곳, 다 깼으면 마지막.
 * 방금 열린 스테이지(fresh)가 있으면 from(직전에 할 곳)에서 시작해 to(새로 열린 곳)로 옮겨 간 뒤 튀어나온다.
 * seen = 이 세션에서 지도를 마지막으로 봤을 때의 unlocked (처음이면 undefined)
 */
export function mapFocus(
  unlocked: number,
  seen: number | undefined,
  count: number,
): { from: number; to: number; fresh: boolean } {
  const at = (n: number) => Math.min(Math.max(1, n), count) - 1;
  const to = at(unlocked);
  const fresh = seen !== undefined && unlocked > seen && unlocked <= count;
  return { from: fresh ? at(seen) : to, to, fresh };
}
