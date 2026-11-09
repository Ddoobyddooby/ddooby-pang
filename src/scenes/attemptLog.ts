// 스토리 플레이 로그(stage_attempts)를 보낼 판인지와 보낼 값 (V2-W4-02, PLAN2 6.7). Phaser 없음, 테스트용으로 분리.

import type { StageAttempt } from '../online';
import type { ModeResult } from '../modes/GameMode';

/**
 * 보내지 않는 판: DEV 시험 스테이지(devStage), ?demo 자동 플레이, DEV 빌드(개발 중 플레이가 자료를 흐리지 않게).
 * DEV에서는 ?attemptlog가 있을 때만 보낸다
 */
export function shouldLogAttempt(options: {
  devStage: boolean;
  demo: boolean;
  dev: boolean;
  search: string;
}): boolean {
  if (options.devStage || options.demo) return false;
  return !options.dev || new URLSearchParams(options.search).has('attemptlog');
}

/** 스토리 결과 → 보낼 기록. attemptNo는 방금 저장한 그 스테이지의 판 수 */
export function stageAttemptOf(
  result: Extract<ModeResult, { kind: 'story' }>,
  movesLeft: number,
  attemptNo: number,
): StageAttempt {
  return {
    stageId: result.stageId,
    result: result.cleared ? 'clear' : 'fail',
    movesLeft,
    score: result.score,
    stars: result.stars,
    attemptNo,
  };
}
