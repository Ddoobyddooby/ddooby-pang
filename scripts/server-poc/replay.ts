// V2-W2-08 PoC: 경쟁(타임어택) 모드 리플레이 (SPEC 5.3, PLAN2 5.8). 서버(Deno Edge Function)가 이 흐름으로 점수를 다시 계산한다.
// GameScene.trySwap·playFinale와 TimeAttackMode를 그대로 따른다:
// createInitialState → move마다 resolveSwap(무효면 상태·점수 그대로) → 끝에 resolveFinale 한 번 → 점수 합.
// 시각·간격·좌표 판정은 validate.ts(validateMoves)가 먼저 한다. 여기서는 t를 보지 않는다.
// src/core·src/modes·src/config만 import한다 (phaser·view·scenes·DOM 없음). 서버로 옮길 때도 이 조건을 지킨다.

import { createInitialState, resolveFinale, resolveSwap } from '../../src/core/engine';
import type { Pos } from '../../src/core/types';
import { TimeAttackMode } from '../../src/modes/TimeAttackMode';

/** public/stages/timeattack.json과 같은 값 (tests/poc/replay.test.ts가 대조한다) */
export const TIMEATTACK_BOARD = { rows: 8, cols: 8, colors: 5, timeLimitMs: 60000 } as const;

/** t: 게임 시작부터 그 스왑을 입력한 순간까지의 게임 시간(ms 정수, 일시정지 제외). 오름차순 */
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
  /** 마지막 팡 점수 (score에 이미 들어 있다) */
  finaleScore: number;
}

/** moves는 validateMoves를 통과했다고 본다 (모두 제한 시간 안이라 게임이 받은 스왑이다) */
export function replayTimeAttack(seed: number, moves: readonly ReplayMove[]): ReplayResult {
  const { rows, cols, colors } = TIMEATTACK_BOARD;
  let state = createInitialState({ rows, cols, colors, seed });
  const mode = new TimeAttackMode();
  let validMoves = 0;
  let invalidMoves = 0;

  for (const move of moves) {
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
    finaleScore: finale.valid ? finale.scoreDelta : 0,
  };
}
