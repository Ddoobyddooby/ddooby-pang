// DEV ?fakerun=<ok|rejected|outdated|failed|null|slow>: 서버 없이 경쟁 랭킹 등록 흐름을 확인하는 가짜 run 클라이언트.
// ok 계열은 run seed 4242를 주고, 제출은 1.5초 뒤 결과를 돌려준다. null은 run 발급 실패, slow는 2.5초 안에 못 받는다.
// 배포 빌드에서는 main.ts의 분기째 빠진다.

import { setRunClient, type SubmitOutcome } from '../scenes/runClient';

const SUBMIT_DELAY_MS = 1500;

export function installFakeRun(mode: string): void {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  setRunClient({
    canRank: () => navigator.onLine,
    async startRun() {
      if (mode === 'null') return null;
      if (mode === 'slow') await sleep(4000);
      return { runId: 'fake-run', seed: 4242 };
    },
    async submitScore(_runId, payload) {
      await sleep(SUBMIT_DELAY_MS);
      const outcomes: Record<string, SubmitOutcome> = {
        rejected: { kind: 'rejected', code: 'score-mismatch' },
        outdated: { kind: 'outdated' },
        failed: { kind: 'failed' },
      };
      (window as unknown as { __fakeRunSubmit?: unknown }).__fakeRunSubmit = payload;
      return outcomes[mode] ?? { kind: 'ok', best: payload.clientScore, isNewBest: true };
    },
  });
}
