// start-run 처리 로직 (PLAN2 6.4): 토큰 확인 → 코어 version 비교 → 서버 seed 발급 → runs 저장 → {runId, seed}.
// Deno·Supabase에 의존하지 않는 순수 핸들러라 Vitest에서 가짜 deps로 시험한다. 실제 연결은 index.ts가 넣어 준다.
// 이 파일은 Deno(deno check)와 tsc(Vitest 경유) 둘 다 읽는다
import { weekKey } from '../_shared/replay.js';
import { bearerToken, corsHeaders, json, nonPostResponse, readJson } from '../_lib/http.ts';

/** 서버 seed 범위: 0 이상 이 값 미만 */
export const SEED_LIMIT = 1_000_000;

export interface NewRun {
  userId: string;
  seed: number;
  version: string;
  /** 발급 시각의 주 (SPEC 5.2: run 발급 시각의 주에 넣는다) */
  weekKey: string;
  /** 발급 시각. submit-score의 서버 시각 판정이 같은 시계로 비교하도록 DB 기본값 대신 이 값을 쓴다 */
  createdAtMs: number;
}

export interface StartRunDeps {
  /** 브라우저가 보내는 요청 헤더 허용 목록 (supabase-js의 corsHeaders 값) */
  allowHeaders: string;
  /** 서버 번들의 CORE_VERSION */
  version: string;
  now(): number;
  /** 토큰이 유효하면 사용자 ID, 아니면 null */
  getUserId(token: string): Promise<string | null>;
  /** 0 ≤ seed < SEED_LIMIT 정수 (crypto.getRandomValues) */
  randomSeed(): number;
  /** runs에 넣고 새 run ID를 돌려준다 */
  insertRun(run: NewRun): Promise<string>;
}

export async function handleStartRun(deps: StartRunDeps, req: Request): Promise<Response> {
  const cors = corsHeaders(deps.allowHeaders, req.headers.get('Origin'));
  const early = nonPostResponse(req, cors);
  if (early) return early;

  try {
    // CORS와 별개로 토큰을 검사한다 (SPEC 8절)
    const token = bearerToken(req);
    const userId = token ? await deps.getUserId(token) : null;
    if (!userId) return json(401, { code: 'unauthorized' }, cors);

    const version = ((await readJson(req)) as { version?: unknown } | null | undefined)?.version;
    if (typeof version !== 'string' || version === '') {
      return json(400, { code: 'bad-request' }, cors);
    }
    // 코어가 다르면 리플레이 점수가 달라질 수 있다 → 새로고침 안내 (submit-score와 같은 코드)
    if (version !== deps.version) return json(409, { code: 'version-mismatch' }, cors);

    const now = deps.now();
    const seed = deps.randomSeed();
    const runId = await deps.insertRun({
      userId,
      seed,
      version,
      weekKey: weekKey(now),
      createdAtMs: now,
    });
    return json(200, { runId, seed }, cors);
  } catch {
    return json(500, { code: 'server' }, cors);
  }
}
