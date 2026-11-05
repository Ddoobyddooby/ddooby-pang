// V2-W2-08 PoC: 리플레이 비교용 랜덤 로그. src/core/rng.ts의 seed RNG만 써서 같은 seed면 같은 로그가 나온다.
// 힌트 스왑(점수가 나는 수)과 무작위 인접 스왑(대부분 무효)을 섞고, t는 0~60000 사이 오름차순이다.

import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint } from '../../src/core/moves';
import { createRng, nextInt, type RngState } from '../../src/core/rng';
import type { Pos } from '../../src/core/types';
import { TIMEATTACK_BOARD, type ReplayMove } from './replay';

const DIRS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/** 한 판의 로그. 보드 seed와 로그를 만드는 RNG seed를 따로 받는다 (같은 보드에 다른 입력도 시험할 수 있게) */
export function randomLog(boardSeed: number, logSeed: number = boardSeed): ReplayMove[] {
  const { rows, cols, colors, timeLimitMs } = TIMEATTACK_BOARD;
  let state = createInitialState({ rows, cols, colors, seed: boardSeed });
  let rng: RngState = createRng(logSeed ^ 0x5eed);
  const roll = (n: number) => {
    const [v, s] = nextInt(rng, n);
    rng = s;
    return v;
  };

  const moves: ReplayMove[] = [];
  let t = roll(1500);
  while (t < timeLimitMs) {
    let from: Pos;
    let to: Pos;
    const hint = roll(10) < 7 ? findHint(state.board) : null;
    if (hint) {
      [from, to] = roll(2) === 0 ? [hint.a, hint.b] : [hint.b, hint.a];
    } else {
      // 무작위 인접 스왑: 보드 밖으로 나가는 방향이면 반대쪽으로
      from = { r: roll(rows), c: roll(cols) };
      const d = DIRS[roll(DIRS.length)]!;
      const r = from.r + d.r;
      const c = from.c + d.c;
      to =
        r >= 0 && r < rows && c >= 0 && c < cols ? { r, c } : { r: from.r - d.r, c: from.c - d.c };
    }
    moves.push({ from, to, t });
    state = resolveSwap(state, from, to).state;
    // 다음 입력까지 80ms~2.5s. 유효 스왑 뒤에는 연출 시간만큼 더 걸리지만 여기서는 간격만 다양하게
    t += 80 + roll(2420);
  }
  return moves;
}
