// 경쟁 모드의 서버 run 연결 (V2-W3-03, PLAN2 6.4). scenes는 이 모양만 알고, 실제 구현(src/online/runs.ts)은
// main.ts가 setRunClient로 꽂는다 (src/online의 startRun·submitScore). 꽂기 전에는 "run을 못 받는" 클라이언트라 로컬 seed로만 논다.

import type { StartedRun, SubmitOutcome, SubmitPayload } from '../online';

export type { RunMove, SubmitOutcome, SubmitPayload } from '../online';

/** 서버가 발급한 run: 이 seed로 보드를 만든다 */
export type RunInfo = StartedRun;

export interface RunClient {
  /** 오류·오프라인·시간 초과면 null. 절대 throw하지 않는다 */
  startRun(): Promise<RunInfo | null>;
  submitScore(runId: string, payload: SubmitPayload): Promise<SubmitOutcome>;
  /** 지금 서버 run을 받아 볼 수 있는 상태인지 (키 있음 + 온라인). 아니면 기다리지 않고 바로 시작한다 */
  canRank(): boolean;
}

const NO_RUNS: RunClient = {
  startRun: () => Promise.resolve(null),
  submitScore: () => Promise.resolve({ kind: 'failed' }),
  canRank: () => false,
};

let client: RunClient = NO_RUNS;

export function setRunClient(next: RunClient): void {
  client = next;
}

export function getRunClient(): RunClient {
  return client;
}
