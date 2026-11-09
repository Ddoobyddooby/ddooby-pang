// 스토리 플레이 로그 stage_attempts (SPEC v0.2 6.1, PLAN2 6.7). 끝까지 한 판마다 행 하나를 INSERT한다.
// 참고 자료라 게임은 기다리지 않는다: 오프라인·실패한 기록은 버리고(나중에 보내지 않는다) 어떤 실패도 throw하지 않는다
import type { Account } from './account';
import { within } from './runs';

/** INSERT를 기다리는 최대 시간. 넘으면 버린다 */
export const ATTEMPT_TIMEOUT_MS = 5000;

/** 한 판의 기록. user_id·id·created_at은 서버 기본값이라 보내지 않는다 */
export interface StageAttempt {
  stageId: number;
  result: 'clear' | 'fail';
  /** 끝난 순간 남은 이동 수 (보너스로 바꾸기 전) */
  movesLeft: number;
  /** 보너스 포함 최종 점수 */
  score: number;
  stars: 0 | 1 | 2 | 3;
  /** 이 기기에서 그 스테이지를 끝까지 한 횟수 (이번 판 포함, 1부터) */
  attemptNo: number;
}

export interface AttemptsDeps {
  isOnline(): boolean;
  timeoutMs?: number;
}

export interface Attempts {
  logStageAttempt(attempt: StageAttempt): Promise<void>;
}

export function createAttempts(account: Account, deps: AttemptsDeps): Attempts {
  const timeoutMs = deps.timeoutMs ?? ATTEMPT_TIMEOUT_MS;

  return {
    async logStageAttempt(attempt) {
      if (account.status() === 'disabled' || !deps.isOnline()) return;
      await within<void>(timeoutMs, undefined, async () => {
        // 계정이 아직이면 익명 로그인을 한 번 시도한다. 그래도 없으면 보내지 않는다
        await account.ensure();
        const backend = account.backend();
        if (!backend) return;
        await backend.insertRow('stage_attempts', {
          stage_id: attempt.stageId,
          result: attempt.result,
          moves_left: attempt.movesLeft,
          score: attempt.score,
          stars: attempt.stars,
          attempt_no: attempt.attemptNo,
        });
      });
    },
  };
}
