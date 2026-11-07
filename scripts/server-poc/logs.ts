// V2-W2-08 PoC: 리플레이 비교용 랜덤 로그. src/core/rng.ts의 seed RNG만 써서 같은 seed면 같은 로그가 나온다.
// 기본: 힌트 스왑(점수가 나는 수)과 무작위 인접 스왑(대부분 무효)을 섞고, t는 0~60000 사이 오름차순이다.
// 옵션으로 실제 입력 간격(realistic), 시간 경계(boundary), 늦은 move(late), 셔플 재현용 수 고르기(pick)를 켠다.

import { createInitialState, resolveSwap } from '../../src/core/engine';
import { findHint, isValidSwap } from '../../src/core/moves';
import { createRng, nextInt, type RngState } from '../../src/core/rng';
import type { Board, Pos } from '../../src/core/types';
import { TIMEATTACK_BOARD, type ReplayMove } from '../../src/replay/replay';

const DIRS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

/**
 * 재생 중에는 입력이 막히므로 다음 스왑까지 최소 이만큼 걸린다 (RESULT.md D절 실측).
 * 유효: 재생 시간 최소 433ms / 무효: swap + swapBack = ANIM.swap 120ms × 2
 */
export const MIN_GAP_MS = { valid: 433, invalid: 240 } as const;

/** 셔플이 일어나는 보드 seed와 그 순번(0부터). pick: 'rngValid'로 두면 이 수에서 셔플이 난다 (core 탐색) */
export const SHUFFLE_SEEDS = { 4860: 28, 16824: 25 } as const;

export interface LogOptions {
  /** 유효 스왑 뒤 MIN_GAP_MS.valid, 무효 뒤 MIN_GAP_MS.invalid 이상 띄운다 (끄면 80ms~2.5s 무작위) */
  realistic?: boolean;
  /** 제한 시간을 처음 넘는 move를 t = 제한 시간 − 1(59999)로 당겨 넣는다 (직전 move의 간격 하한을 지킬 수 있을 때만) */
  boundary?: boolean;
  /** 제한 시간 뒤(t ≥ 60000. 첫 move는 60000, 직전 하한이 더 늦으면 그 시각)에 붙이는 move 수. 게임은 받지 않는다 */
  late?: number;
  /**
   * 'mixed': 힌트 70% + 무작위 인접 30% (기본).
   * 'rngValid': 가능한 유효 스왑 목록(행 우선, 칸마다 오른쪽 → 아래)에서 createRng(boardSeed * 7 + 1)로 고른다.
   * browser/drive.js의 같은 이름 전략과 같은 수열이다 (SHUFFLE_SEEDS 재현)
   */
  pick?: 'mixed' | 'rngValid';
}

function validSwaps(board: Board): [Pos, Pos][] {
  const list: [Pos, Pos][] = [];
  for (let r = 0; r < board.rows; r++) {
    for (let c = 0; c < board.cols; c++) {
      if (c + 1 < board.cols && isValidSwap(board, { r, c }, { r, c: c + 1 }))
        list.push([
          { r, c },
          { r, c: c + 1 },
        ]);
      if (r + 1 < board.rows && isValidSwap(board, { r, c }, { r: r + 1, c }))
        list.push([
          { r, c },
          { r: r + 1, c },
        ]);
    }
  }
  return list;
}

/** 한 판의 로그. 보드 seed와 로그를 만드는 RNG seed를 따로 받는다 (같은 보드에 다른 입력도 시험할 수 있게) */
export function randomLog(
  boardSeed: number,
  logSeed: number = boardSeed,
  options: LogOptions = {},
): ReplayMove[] {
  const { rows, cols, colors, timeLimitMs } = TIMEATTACK_BOARD;
  const { realistic = false, boundary = false, late = 0, pick = 'mixed' } = options;
  let state = createInitialState({ rows, cols, colors, seed: boardSeed });
  let rng: RngState = createRng(logSeed ^ 0x5eed);
  let pickRng: RngState = createRng(boardSeed * 7 + 1);
  const roll = (n: number) => {
    const [v, s] = nextInt(rng, n);
    rng = s;
    return v;
  };

  const choose = (): [Pos, Pos] => {
    if (pick === 'rngValid') {
      const list = validSwaps(state.board);
      const [i, s] = nextInt(pickRng, list.length);
      pickRng = s;
      return list[i]!;
    }
    const hint = roll(10) < 7 ? findHint(state.board) : null;
    if (hint) return roll(2) === 0 ? [hint.a, hint.b] : [hint.b, hint.a];
    // 무작위 인접 스왑: 보드 밖으로 나가는 방향이면 반대쪽으로
    const from = { r: roll(rows), c: roll(cols) };
    const d = DIRS[roll(DIRS.length)]!;
    const r = from.r + d.r;
    const c = from.c + d.c;
    const inside = r >= 0 && r < rows && c >= 0 && c < cols;
    return [from, inside ? { r, c } : { r: from.r - d.r, c: from.c - d.c }];
  };

  const moves: ReplayMove[] = [];
  let boundaryUsed = false;
  let t = roll(1500);
  /** 다음 move를 둘 수 있는 가장 이른 시각 (realistic이면 재생 시간 하한) */
  let earliest = 0;
  const play = () => {
    const [from, to] = choose();
    moves.push({ from, to, t });
    const result = resolveSwap(state, from, to);
    state = result.state;
    // 다음 입력까지: 재생 시간 하한 + 생각하는 시간, 또는 80ms~2.5s 무작위
    if (!realistic) {
      earliest = t;
      t += 80 + roll(2420);
    } else {
      earliest = t + (result.valid ? MIN_GAP_MS.valid : MIN_GAP_MS.invalid);
      t = earliest + roll(result.valid ? 900 : 600);
    }
  };

  for (;;) {
    if (t >= timeLimitMs) {
      // 경계: 직전 move의 간격 하한을 지킬 수 있을 때만 59999로 당긴다
      if (!boundary || boundaryUsed || earliest > timeLimitMs - 1) break;
      t = timeLimitMs - 1;
      boundaryUsed = true;
    }
    play();
  }
  if (late > 0) {
    t = Math.max(timeLimitMs, earliest);
    for (let i = 0; i < late; i++) play();
  }
  return moves;
}
