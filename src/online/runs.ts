// 경쟁 모드 run 발급·점수 제출 (PLAN2 6.4). Edge Function start-run·submit-score를 부른다.
// 게임을 막지 않는다: 어떤 실패도 throw하지 않고 null·{kind:'failed'}로 돌려준다 (SPEC 5.2)
import type { Account } from './account';

/** 메뉴에서 경쟁을 누른 뒤 run을 기다리는 최대 시간. 넘으면 랭킹 없이 시작한다 */
export const START_RUN_TIMEOUT_MS = 2500;
/** 점수 제출을 기다리는 최대 시간. 넘으면 failed */
export const SUBMIT_TIMEOUT_MS = 10_000;

export interface StartedRun {
  runId: string;
  seed: number;
}

/** 서버 판정 move (PLAN2 5.8): t는 스왑 시작 때의 게임 시간(ms 정수) */
export interface RunMove {
  from: { r: number; c: number };
  to: { r: number; c: number };
  t: number;
}

export interface SubmitPayload {
  moves: RunMove[];
  clientScore: number;
  version: string;
}

/**
 * - ok: 등록됨. best는 이번 주 최고 점수
 * - rejected: 서버 판정 거부 (code는 서버의 RejectReason 또는 not-found)
 * - outdated: 코어 버전이 서버와 다르다 → 새로고침 안내
 * - failed: 키 없음·계정 없음·네트워크·5xx·시간 초과
 */
export type SubmitOutcome =
  | { kind: 'ok'; best: number; isNewBest: boolean }
  | { kind: 'rejected'; code: string }
  | { kind: 'outdated' }
  | { kind: 'failed' };

export interface RunsDeps {
  /** 클라이언트 코어 version (src/replay/coreVersion.ts) */
  version: string;
  isOnline(): boolean;
  startTimeoutMs?: number;
  submitTimeoutMs?: number;
}

export interface Runs {
  /** 키 없음·오프라인·계정 없음·오류·시간 초과면 null (그 판은 랭킹 대상이 아니다) */
  startRun(): Promise<StartedRun | null>;
  submitScore(runId: string, payload: SubmitPayload): Promise<SubmitOutcome>;
}

/** ms 안에 끝나지 않거나 throw하면 fallback (ranking.ts도 쓴다) */
export function within<T>(ms: number, fallback: T, work: () => Promise<T>): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

const objectOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

export function createRuns(account: Account, deps: RunsDeps): Runs {
  const startTimeoutMs = deps.startTimeoutMs ?? START_RUN_TIMEOUT_MS;
  const submitTimeoutMs = deps.submitTimeoutMs ?? SUBMIT_TIMEOUT_MS;

  return {
    async startRun() {
      if (account.status() === 'disabled' || !deps.isOnline()) return null;
      return within<StartedRun | null>(startTimeoutMs, null, async () => {
        // 계정이 아직이면(부팅 직후 등) 익명 로그인까지 이 시간 안에 끝내야 한다
        await account.ensure();
        const backend = account.backend();
        if (!backend) return null;
        const res = await backend.callFunction('start-run', { version: deps.version });
        if (res === 'network' || res.status !== 200) return null;
        const { runId, seed } = objectOf(res.body);
        if (typeof runId !== 'string' || runId === '' || !Number.isInteger(seed)) return null;
        return { runId, seed: seed as number };
      });
    },

    async submitScore(runId, payload) {
      const failed: SubmitOutcome = { kind: 'failed' };
      return within<SubmitOutcome>(submitTimeoutMs, failed, async () => {
        await account.ensure();
        const backend = account.backend();
        if (!backend) return failed;
        const res = await backend.callFunction('submit-score', {
          runId,
          moves: payload.moves,
          clientScore: payload.clientScore,
          version: payload.version,
        });
        if (res === 'network') return failed;
        const body = objectOf(res.body);
        const code = typeof body.code === 'string' ? body.code : null;
        switch (res.status) {
          case 200:
            return body.ok === true &&
              Number.isInteger(body.best) &&
              typeof body.isNewBest === 'boolean'
              ? { kind: 'ok', best: body.best as number, isNewBest: body.isNewBest }
              : failed;
          case 409:
            if (code === 'version-mismatch') return { kind: 'outdated' };
            return code ? { kind: 'rejected', code } : failed;
          case 400:
          case 404:
            return { kind: 'rejected', code: code ?? `http-${res.status}` };
          default:
            // 401(세션 문제)·5xx·게이트웨이 오류
            return failed;
        }
      });
    },
  };
}
