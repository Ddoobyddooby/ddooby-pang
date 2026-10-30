// 보드 좌표(행·열) ↔ 화면 좌표(px) 변환. Phaser 없는 순수 함수라 테스트할 수 있다.

import { DECOR, VIEW } from '../config';
import type { Pos } from '../core/types';

export interface Layout {
  readonly rows: number;
  readonly cols: number;
  /** 한 칸의 크기 (px) */
  readonly cell: number;
  /** 보드 영역 왼쪽 위 */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenLayout {
  titleY: number;
  board: { x: number; y: number; size: number };
  /** 정보 패널 (보드 판과 같은 폭) */
  panel: { x: number; y: number; w: number; h: number };
  /** 바닥 장식 위쪽 y (장식은 화면 맨 아래까지) */
  decorY: number;
}

/**
 * 화면 높이에 맞춘 구역 배치. 기준 높이(1280)보다 긴 만큼(extra)의 30%는 타이틀~보드 사이,
 * 70%는 패널~장식 사이에 준다. 기준보다 짧으면 1280과 같다 (FIT로 줄어든다)
 */
export function screenLayout(height: number): ScreenLayout {
  const s = VIEW.screen;
  const extra = Math.max(0, height - s.baseHeight);
  const top = extra * s.topShare;
  const pad = DECOR.frame.pad;
  return {
    titleY: s.titleY,
    board: { x: s.boardX, y: s.boardY + top, size: s.boardSize },
    panel: { x: s.boardX - pad, y: s.panelY + top, w: s.boardSize + pad * 2, h: s.panelH },
    decorY: Math.max(height, s.baseHeight) - s.decorH,
  };
}

/** 보드 영역 안에 rows x cols 칸을 정사각형으로 가운데 정렬해 배치한다 */
export function createLayout(
  rows: number,
  cols: number,
  area: { x: number; y: number; size: number },
): Layout {
  const cell = Math.floor(area.size / Math.max(rows, cols));
  const width = cell * cols;
  const height = cell * rows;
  return {
    rows,
    cols,
    cell,
    x: area.x + (area.size - width) / 2,
    y: area.y + (area.size - height) / 2,
    width,
    height,
  };
}

/** 칸의 중심 좌표. r이 음수면 보드 위쪽 (리필 블록 시작 위치) */
export function cellCenter(layout: Layout, { r, c }: Pos): { x: number; y: number } {
  return { x: layout.x + (c + 0.5) * layout.cell, y: layout.y + (r + 0.5) * layout.cell };
}

/** 화면 좌표가 가리키는 칸. 보드 밖이면 null */
export function cellAt(layout: Layout, x: number, y: number): Pos | null {
  const c = Math.floor((x - layout.x) / layout.cell);
  const r = Math.floor((y - layout.y) / layout.cell);
  if (r < 0 || r >= layout.rows || c < 0 || c >= layout.cols) return null;
  return { r, c };
}
