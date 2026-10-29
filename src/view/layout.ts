// 보드 좌표(행·열) ↔ 화면 좌표(px) 변환. Phaser 없는 순수 함수라 테스트할 수 있다.

import { VIEW } from '../config';
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

/** 보드 영역(VIEW.board) 안에 rows x cols 칸을 정사각형으로 가운데 정렬해 배치한다 */
export function createLayout(
  rows: number,
  cols: number,
  area: { x: number; y: number; size: number } = VIEW.board,
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
