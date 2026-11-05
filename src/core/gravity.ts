// 낙하 + 리필 (PLAN 4.6)
// 리필 블록은 매치를 피하지 않는다 (연쇄의 재미). 매치 회피는 초기 생성과 셔플만 한다.
// 고정 칸(얼음벽 칸·잠긴 블록, PLAN2 5.1)은 그 자리에 있다: 블록이 통과하지 않고 리필도 채우지 않는다.
// 한 열은 고정 칸으로 나뉜 구간들이고, 구간 맨 위가 생성 지점이다 (spawnTop, PLAN2 5.2).

import { nextInt, type RngState } from './rng';
import type { Block, Board, Color, GameEvent, Pos } from './types';

type FallEvent = Extract<GameEvent, { type: 'fall' }>;
type RefillEvent = Extract<GameEvent, { type: 'refill' }>;

/** 고정 칸: 얼음벽 칸 또는 잠긴 블록 칸 */
const isFixedAt = (board: Board, i: number) => {
  const layer = board.layers?.[i];
  return (layer?.frost ?? 0) > 0 || layer?.lock === true;
};

/** 구간마다 블록을 아래로 모은다 (고정 칸 위에서 멈춘다). 구간 위쪽에 빈칸이 남는다 */
export function applyGravity(board: Board): { board: Board; event: FallEvent } {
  const { rows, cols } = board;
  const cells = board.cells.slice();
  const moves: { id: number; from: Pos; to: Pos }[] = [];

  for (let c = 0; c < cols; c++) {
    let write = rows - 1; // 다음 블록이 내려앉을 행
    for (let r = rows - 1; r >= 0; r--) {
      if (isFixedAt(board, r * cols + c)) {
        write = r - 1;
        continue;
      }
      const block = cells[r * cols + c];
      if (!block) continue;
      if (r !== write) {
        cells[write * cols + c] = block;
        cells[r * cols + c] = null;
        moves.push({ id: block.id, from: { r, c }, to: { r: write, c } });
      }
      write--;
    }
  }

  return { board: { ...board, cells }, event: { type: 'fall', moves } };
}

/**
 * 빈칸을 새 블록으로 채운다. 한 열의 빈칸이 k개면 새 블록은 모두 k칸 위에서 떨어진다
 * (맨 위 빈칸의 dropFrom = k, 맨 아래 빈칸 = 1). 고정 칸은 건너뛰고, 고정 칸으로 나뉜 구간마다 센다.
 * spawnTop = 구간 맨 위 행 (0이면 보드 위에서, 아니면 고정 칸 바로 아래에서 생긴다).
 * applyGravity 다음에 호출한다.
 */
export function refill(
  board: Board,
  colors: number,
  rng: RngState,
): { board: Board; event: RefillEvent; rng: RngState } {
  const { rows, cols } = board;
  const cells = board.cells.slice();
  const blocks: { block: Block; at: Pos; dropFrom: number; spawnTop: number }[] = [];
  let nextId = board.nextId;

  for (let c = 0; c < cols; c++) {
    // 구간 = 고정 칸 사이(또는 보드 끝)의 연속한 행 [top, bottom)
    for (let top = 0; top < rows;) {
      if (isFixedAt(board, top * cols + c)) {
        top++;
        continue;
      }
      let bottom = top;
      while (bottom < rows && !isFixedAt(board, bottom * cols + c)) bottom++;

      let empty = 0;
      for (let r = top; r < bottom; r++) if (!cells[r * cols + c]) empty++;
      for (let r = top, rank = 0; r < bottom; r++) {
        if (cells[r * cols + c]) continue;
        let color: number;
        [color, rng] = nextInt(rng, colors);
        const block: Block = { id: nextId++, color: color as Color };
        cells[r * cols + c] = block;
        blocks.push({ block, at: { r, c }, dropFrom: empty - rank, spawnTop: top });
        rank++;
      }
      top = bottom;
    }
  }

  return { board: { ...board, cells, nextId }, event: { type: 'refill', blocks }, rng };
}
