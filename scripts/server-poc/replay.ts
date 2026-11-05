// V2-W2-08 PoC: 경쟁(타임어택) 모드 리플레이 (SPEC 5.3). 서버(Deno Edge Function)가 이 흐름으로 점수를 다시 계산한다.
// GameScene.trySwap·playFinale와 TimeAttackMode를 그대로 따른다:
// createInitialState → move마다 resolveSwap(무효면 상태·점수 그대로) → 시간이 끝나면 resolveFinale → 점수 합.
// src/core·src/modes·src/config만 import한다 (phaser·view·scenes·DOM 없음). 서버로 옮길 때도 이 조건을 지킨다.

import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
import type { Pos } from '../../src/core/types';
import { TimeAttackMode } from '../../src/modes/TimeAttackMode';

/** public/stages/timeattack.json과 같은 값 (tests/poc/replay.test.ts가 대조한다) */
export const TIMEATTACK_BOARD = { rows: 8, cols: 8, colors: 5, timeLimitMs: 60000 } as const;

/** t: 게임 시작부터 그 스왑을 입력한 순간까지의 게임 시간(ms, 일시정지 제외). 오름차순 */
export interface ReplayMove {
  from: Pos;
  to: Pos;
  t: number;
}

export interface ReplayResult {
  /** 최종 점수 (스왑 점수 + 마지막 팡) */
  score: number;
  validMoves: number;
  invalidMoves: number;
  /** 시간이 끝난 뒤(t ≥ 제한 시간)라 게임이 받지 않았을 move 수. 점수에 들어가지 않는다 */
  lateMoves: number;
  /** 마지막 팡 점수 (score에 이미 들어 있다) */
  finaleScore: number;
}

export function replayTimeAttack(
  seed: number,
  moves: readonly ReplayMove[],
  timeLimitMs: number = TIMEATTACK_BOARD.timeLimitMs,
): ReplayResult {
  const { rows, cols, colors } = TIMEATTACK_BOARD;
  let state = createInitialState({ rows, cols, colors, seed });
  const mode = new TimeAttackMode({ timeLimitMs });
  let validMoves = 0;
  let invalidMoves = 0;
  let lateMoves = 0;
  let clock = 0;

  for (const move of moves) {
    // 게임은 매 프레임 tick한다. 리플레이는 move 사이의 경과 시간을 한 번에 넣는다 (거꾸로 가는 t는 tick이 무시)
    mode.tick(move.t - clock);
    clock = Math.max(clock, move.t);
    if (!mode.canInput()) {
      lateMoves++;
      continue;
    }
    const result = resolveSwap(state, move.from, move.to);
    state = result.state;
    if (result.valid) {
      validMoves++;
      mode.onResolve(result);
    } else {
      invalidMoves++;
    }
  }

  // 게임은 시간이 0이 되면 마지막 팡을 한 번 돌린다 (재생 중이던 스왑은 위에서 이미 끝까지 더했다)
  const finale = resolveFinale(state);
  if (finale.valid) mode.onResolve(finale);
  return {
    score: mode.score(),
    validMoves,
    invalidMoves,
    lateMoves,
    finaleScore: finale.valid ? finale.scoreDelta : 0,
  };
}
