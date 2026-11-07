// submit-score 처리 로직 (PLAN2 5.8·6.4): 토큰 확인 → 본인 run 조회 → judgeSubmission → 판정 저장 → 주간 최고 점수 기록.
// Deno·Supabase에 의존하지 않는 순수 핸들러라 Vitest에서 가짜 deps로 시험한다. 실제 연결은 index.ts가 넣어 준다.
// 이 파일은 Deno(deno check)와 tsc(Vitest 경유) 둘 다 읽는다
import {
  judgeSubmission,
  shouldStore,
  type RejectReason,
  type SubmissionResult,
} from '../_shared/replay.js';
import {
  bearerToken,
  corsHeaders,
  json,
  nonPostResponse,
  readJson,
  type Cors,
} from '../_lib/http.ts';

/** runs.result에 저장하는 값: 판정 결과 + 통과면 기록 뒤의 주간 최고 점수 */
export type StoredResult = SubmissionResult & { best?: number; isNewBest?: boolean };

export interface RunRow {
  id: string;
  seed: number;
  /** start-run 때의 CORE_VERSION */
  version: string;
  weekKey: string;
  /** start-run 발급 시각 (ms) */
  createdAtMs: number;
  submissionHash: string | null;
  result: StoredResult | null;
}

export interface WeeklyBest {
  best: number;
  isNewBest: boolean;
}

export interface SubmitScoreDeps {
  /** 브라우저가 보내는 요청 헤더 허용 목록 (supabase-js의 corsHeaders 값) */
  allowHeaders: string;
  /** 서버 번들의 CORE_VERSION */
  version: string;
  now(): number;
  /** 토큰이 유효하면 사용자 ID, 아니면 null */
  getUserId(token: string): Promise<string | null>;
  /** id와 user_id가 모두 맞는 run. 없거나 남의 run이면 null */
  getRun(runId: string, userId: string): Promise<RunRow | null>;
  /**
   * 새 제출의 해시·결과·제출 시각을 한 번만 쓴다 (`where submission_hash is null`).
   * 썼으면 true, 다른 요청이 먼저 썼으면 false
   */
  claimRun(
    runId: string,
    hash: string,
    result: StoredResult,
    submittedAtMs: number,
  ): Promise<boolean>;
  /** 이미 저장한 결과에 주간 최고 점수를 더해 다시 쓴다 */
  saveResult(runId: string, result: StoredResult): Promise<void>;
  /** record_weekly_best: 더 높은 점수일 때만 바꾸고 그 주 최고 점수를 돌려준다 */
  recordWeeklyBest(
    userId: string,
    weekKey: string,
    score: number,
    runId: string,
  ): Promise<WeeklyBest>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 판정 거부 → 응답. version-mismatch·resubmit-conflict는 409, 나머지는 400 */
function rejected(reason: RejectReason, cors: Cors): Response {
  const status = reason === 'version-mismatch' || reason === 'resubmit-conflict' ? 409 : 400;
  return json(status, { ok: false, code: reason }, cors);
}

export async function handleSubmitScore(deps: SubmitScoreDeps, req: Request): Promise<Response> {
  const cors = corsHeaders(deps.allowHeaders, req.headers.get('Origin'));
  const early = nonPostResponse(req, cors);
  if (early) return early;

  try {
    // CORS와 별개로 토큰을 검사한다 (SPEC 8절)
    const token = bearerToken(req);
    const userId = token ? await deps.getUserId(token) : null;
    if (!userId) return json(401, { code: 'unauthorized' }, cors);

    const body = await readJson(req);
    if (typeof body !== 'object' || body === null) return rejected('payload-invalid', cors);
    const runId = (body as { runId?: unknown }).runId;
    if (typeof runId !== 'string') return rejected('payload-invalid', cors);
    // uuid가 아닌 값은 DB에 묻지 않는다 (형식 오류가 500이 되지 않게)
    const run = UUID.test(runId) ? await deps.getRun(runId, userId) : null;
    if (!run) return json(404, { code: 'not-found' }, cors);

    // 발급 뒤 서버가 새 코어로 바뀌었으면 이 run의 seed·보드 기준이 다르다
    if (run.version !== deps.version) return rejected('version-mismatch', cors);

    const submittedAtMs = deps.now();
    const judged = await judgeSubmission(
      { seed: run.seed, storedHash: run.submissionHash, storedResult: run.result },
      body,
      { version: deps.version, issuedAtMs: run.createdAtMs, submittedAtMs },
    );

    let stored: StoredResult = judged.result;
    if (judged.decision === 'invalid') return rejected(reasonOf(judged.result), cors);
    if (judged.decision === 'conflict') return rejected('resubmit-conflict', cors);
    if (judged.decision === 'same' && run.result) stored = run.result;
    if (judged.decision === 'new') {
      if (!shouldStore(judged.result)) return rejected(reasonOf(judged.result), cors);
      const claimed = await deps.claimRun(run.id, judged.hash, judged.result, submittedAtMs);
      if (!claimed) {
        // 다른 요청이 먼저 저장했다: 다시 읽어 같은 내용이면 그 결과, 다르면 거부
        const latest = await deps.getRun(run.id, userId);
        if (!latest?.result || latest.submissionHash === null) {
          return json(500, { code: 'server' }, cors);
        }
        if (latest.submissionHash !== judged.hash) return rejected('resubmit-conflict', cors);
        stored = latest.result;
      }
    }

    if (!stored.ok) return rejected(stored.reason, cors);
    // 통과: 저장된 최고 점수가 있으면(같은 내용 재제출) 그대로, 없으면 기록하고 결과에 더해 둔다.
    // 기록은 같은 run·점수로 다시 불러도 안전하다 (더 높을 때만 바뀐다)
    let best: WeeklyBest;
    if (stored.best !== undefined && stored.isNewBest !== undefined) {
      best = { best: stored.best, isNewBest: stored.isNewBest };
    } else {
      best = await deps.recordWeeklyBest(userId, run.weekKey, stored.score, run.id);
      await deps.saveResult(run.id, { ...stored, ...best });
    }
    return json(
      200,
      {
        ok: true,
        score: stored.score,
        best: best.best,
        weekKey: run.weekKey,
        isNewBest: best.isNewBest,
      },
      cors,
    );
  } catch {
    return json(500, { code: 'server' }, cors);
  }
}

function reasonOf(result: SubmissionResult): RejectReason {
  return result.ok ? 'payload-invalid' : result.reason;
}
