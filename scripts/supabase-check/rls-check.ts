// V2-W3-01 권한(RLS·GRANT) 시험: 원격 개발 프로젝트에 익명 사용자 A·B와 비로그인 anon으로 접속해
// PLAN2 6.2 시험 ①~④와 anon 쓰기 차단을 확인한다. publishable key만 쓴다 (npm test에 넣지 않음).
//
//   npm run supabase:check [-- <env 파일 경로>] [--nickname] [--scores] [--ranking]   (기본값 .env.local)
//
// --nickname: Edge Function set-nickname 시험을 더한다 (V2-W3-02, 함수 배포 뒤에만).
// --scores: start-run·submit-score 시험 ①~⑪을 더한다 (V2-W3-03, 마이그레이션·함수 배포 뒤에만. 약 70초).
// --ranking: DB 함수 weekly_ranking 시험을 더한다 (V2-W3-04, 마이그레이션 뒤에만. 기록을 --scores 경로로
//   만들려고 약 60초 기다린다). 닉네임 있는 시험 사용자(`시험R` 접두어)의 기록은 이번 주 랭킹에 보인다.
// 시험이 만든 익명 계정, stage_attempts 행(stage_id 999), `시험` 접두어 닉네임, 이번 주 runs·weekly_scores 행
// (닉네임 없는 시험 계정이라 랭킹에는 보이지 않는다)은 개발 프로젝트에 남는다.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseEnv } from 'node:util';
import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  type SupabaseClient,
} from '@supabase/supabase-js';
// 앱과 같은 백엔드 어댑터. stage_attempts INSERT를 앱이 보내는 요청 그대로 시험한다 (V2-W4-02)
import { backendFromClient } from '../../src/online/client.ts';
// 함수와 같은 규칙 묶음 (npm run server:shared). 시험 이름이 현재 규칙에서 기대대로 판정되는지 먼저 본다
import { checkNickname } from '../../supabase/functions/_shared/nicknameRules.js';
// 클라이언트·start-run과 같은 주 계산. 서버 now()의 주가 이 값과 같은지 본다
import { weekKey } from '../../src/replay/weekKey.ts';
// 함수와 같은 리플레이 번들. 제출할 점수를 서버와 같은 코드로 계산하고 같은 CORE_VERSION을 보낸다
import {
  CORE_VERSION,
  JUDGE,
  replayTimeAttack,
  type ReplayMove,
} from '../../supabase/functions/_shared/replay.js';

const TEST_STAGE_ID = 999;
const TEST_WEEK_KEY = '2099-W01';
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const ALLOWED_ORIGIN = 'https://ddoobyddooby.github.io';
const DISALLOWED_ORIGIN = 'https://evil.example';

interface Outcome {
  pass: boolean;
  detail: string;
}

interface Row {
  id: string;
  label: string;
  expect: string;
  outcome: Outcome;
}

interface Res {
  data: unknown;
  error: { code?: string; message: string } | null;
}

function loadEnv(path: string): { url: string; key: string } {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`env 파일을 읽을 수 없다: ${path}`);
  }
  const env = parseEnv(text);
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(`${path}에 VITE_SUPABASE_URL·VITE_SUPABASE_PUBLISHABLE_KEY가 모두 있어야 한다`);
  }
  return { url, key };
}

async function tokenOf(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('세션 없음');
  return data.session.access_token;
}

interface FnResult {
  status: number;
  body: Record<string, unknown>;
}

/** Edge Function 호출. 상태 코드·본문을 보려고 supabase-js 대신 fetch로 부른다 */
async function callFn(
  url: string,
  key: string,
  name: string,
  body: unknown,
  token: string,
): Promise<FnResult> {
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      Origin: ALLOWED_ORIGIN,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // 게이트웨이 응답은 JSON이 아닐 수 있다
  }
  const obj = typeof parsed === 'object' && parsed !== null ? parsed : {};
  return { status: res.status, body: obj as Record<string, unknown> };
}

/** 실제 브라우저 기록 한 판의 move (판정 기준을 지키는 시각·간격). 서버 seed에 그대로 둔다 */
function fixtureMoves(): ReplayMove[] {
  const fixture = JSON.parse(
    readFileSync(join(import.meta.dirname, '../server-poc/fixtures/browser-runs.json'), 'utf8'),
  ) as { runs: { moves: ReplayMove[] }[] };
  return fixture.runs[0]!.moves;
}

function newClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function rowsOf(res: Res): unknown[] {
  return Array.isArray(res.data) ? res.data : [];
}

function errText(res: Res): string {
  return `${res.error?.code ?? '?'} ${res.error?.message ?? ''}`.trim();
}

// 쓰기 차단: 오류(권한·RLS)가 나거나, 반영된 행이 0개면 통과
function denied(res: Res): Outcome {
  if (res.error) return { pass: true, detail: errText(res) };
  const n = rowsOf(res).length;
  return { pass: n === 0, detail: n === 0 ? '오류 없음, 반영 0행' : `반영 ${n}행` };
}

// 읽기 허용: 오류가 없어야 통과
function readable(res: Res): Outcome {
  if (res.error) return { pass: false, detail: errText(res) };
  return { pass: true, detail: `${rowsOf(res).length}행` };
}

// 오류 없이 0행이어야 통과 (남의 데이터가 안 보임)
function emptyRead(res: Res): Outcome {
  if (res.error) return { pass: false, detail: errText(res) };
  const n = rowsOf(res).length;
  return { pass: n === 0, detail: `${n}행` };
}

function failed(e: unknown): Outcome {
  return { pass: false, detail: `예외: ${e instanceof Error ? e.message : String(e)}` };
}

async function signIn(client: SupabaseClient, name: string): Promise<string> {
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `${name} 익명 로그인 실패 (${error?.message ?? 'user 없음'}). 대시보드에서 Anonymous Sign-ins를 켰는지 확인`,
    );
  }
  return data.user.id;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const envPath = args.find((arg) => !arg.startsWith('--')) ?? '.env.local';
  const withNickname = args.includes('--nickname');
  const withScores = args.includes('--scores');
  const withRanking = args.includes('--ranking');
  const { url, key } = loadEnv(envPath);

  const anon = newClient(url, key);
  const a = newClient(url, key);
  const b = newClient(url, key);
  const idA = await signIn(a, 'A');
  const idB = await signIn(b, 'B');

  const rows: Row[] = [];
  const check = async (id: string, label: string, expect: string, run: () => Promise<Outcome>) => {
    let outcome: Outcome;
    try {
      outcome = await run();
    } catch (e) {
      outcome = failed(e);
    }
    rows.push({ id, label, expect, outcome });
  };

  // ① weekly_scores: 클라이언트 쓰기 불가, 읽기 가능
  const weeklyRow = { user_id: idA, week_key: TEST_WEEK_KEY, best_score: 1, run_id: NIL_UUID };
  await check('①', 'A weekly_scores INSERT', '실패', async () =>
    denied(await a.from('weekly_scores').insert(weeklyRow).select()),
  );
  await check('①', 'A weekly_scores UPDATE', '실패', async () =>
    denied(
      await a.from('weekly_scores').update({ best_score: 999999 }).eq('user_id', idA).select(),
    ),
  );
  await check('①', 'A weekly_scores DELETE', '실패', async () =>
    denied(await a.from('weekly_scores').delete().eq('user_id', idA).select()),
  );
  await check('①', 'A weekly_scores SELECT', '성공', async () =>
    readable(await a.from('weekly_scores').select('*').limit(5)),
  );

  // ② profiles: 클라이언트 쓰기 불가(set-nickname만), 읽기 가능
  await check('②', 'A profiles UPDATE', '실패', async () =>
    denied(await a.from('profiles').update({ nickname: '시험' }).eq('id', idA).select()),
  );
  await check('②', 'A profiles INSERT', '실패', async () =>
    denied(await a.from('profiles').insert({ id: idA, nickname: '시험', tag: 1 }).select()),
  );
  await check('②', 'A profiles SELECT', '성공', async () =>
    readable(await a.from('profiles').select('*').limit(5)),
  );

  // ③ runs: 본인 것만 읽기. 시험용 run을 만들 수단이 없어(start-run은 V2-W3-03)
  // 지금은 "오류 없이 0행"만 보고, 교차 시험은 V2-W3-03에서 추가한다
  await check('③', 'A 본인 runs SELECT', '오류 없음·0행', async () =>
    emptyRead(await a.from('runs').select('*')),
  );
  await check('③', 'B가 A의 runs SELECT', '오류 없음·0행', async () =>
    emptyRead(await b.from('runs').select('*').eq('user_id', idA)),
  );
  await check('③', 'A runs INSERT', '실패', async () =>
    denied(
      await a
        .from('runs')
        .insert({
          user_id: idA,
          seed: 1,
          mode: 'timeattack',
          version: 'rls-check',
          week_key: TEST_WEEK_KEY,
        })
        .select(),
    ),
  );

  // ④ stage_attempts: 본인 INSERT·SELECT만
  const attempt = {
    stage_id: TEST_STAGE_ID,
    result: 'clear',
    moves_left: 0,
    score: 0,
    stars: 0,
    attempt_no: 1,
  };
  let insertedId: number | null = null;
  await check('④', 'A 본인 stage_attempts INSERT', '성공, user_id = A', async () => {
    const res = await a.from('stage_attempts').insert(attempt).select('id, user_id').single();
    if (res.error) return { pass: false, detail: errText(res) };
    insertedId = res.data.id as number;
    const own = res.data.user_id === idA;
    return {
      pass: own,
      detail: own ? `id ${insertedId}, user_id 기본값 = A` : 'user_id가 A가 아님',
    };
  });
  await check('④', 'A가 B의 user_id로 INSERT', '실패', async () =>
    denied(
      await a
        .from('stage_attempts')
        .insert({ ...attempt, user_id: idB })
        .select(),
    ),
  );
  await check('④', 'A가 id 직접 지정 INSERT', '실패', async () =>
    denied(
      await a
        .from('stage_attempts')
        .insert({ ...attempt, id: 2_000_000_000 })
        .select(),
    ),
  );
  await check('④', 'A 본인 stage_attempts SELECT', '방금 넣은 행 보임', async () => {
    if (insertedId === null) return { pass: false, detail: '앞 INSERT 실패' };
    const res = await a.from('stage_attempts').select('id').eq('id', insertedId);
    if (res.error) return { pass: false, detail: errText(res) };
    return { pass: res.data.length === 1, detail: `${res.data.length}행` };
  });
  // 앱 플레이 로그(V2-W4-02)와 같은 요청: 6개 열만, 응답 행 없이(return=minimal). user_id는 서버 기본값
  await check('④', '앱 logStageAttempt와 같은 INSERT', '성공, user_id = A', async () => {
    const marker = Date.now() % 1_000_000_000;
    const res = await backendFromClient(a, { FunctionsHttpError, FunctionsFetchError }).insertRow(
      'stage_attempts',
      {
        stage_id: TEST_STAGE_ID,
        result: 'fail',
        moves_left: 3,
        score: marker,
        stars: 1,
        attempt_no: 2,
      },
    );
    if (res !== 'ok') return { pass: false, detail: 'insertRow error' };
    const read = await a
      .from('stage_attempts')
      .select('user_id, stage_id, result, moves_left, score, stars, attempt_no, created_at')
      .eq('stage_id', TEST_STAGE_ID)
      .eq('score', marker);
    if (read.error) return { pass: false, detail: errText(read) };
    const row = read.data[0];
    const pass =
      read.data.length === 1 &&
      row?.user_id === idA &&
      row.result === 'fail' &&
      row.moves_left === 3 &&
      row.stars === 1 &&
      row.attempt_no === 2 &&
      typeof row.created_at === 'string';
    return {
      pass,
      detail: pass ? '6개 값 일치, user_id 기본값 = A, created_at 있음' : JSON.stringify(read.data),
    };
  });
  await check('④', 'B가 A의 stage_attempts SELECT', '오류 없음·0행', async () =>
    emptyRead(await b.from('stage_attempts').select('*').eq('user_id', idA)),
  );
  await check('④', 'A stage_attempts UPDATE', '실패', async () =>
    denied(await a.from('stage_attempts').update({ score: 999 }).eq('user_id', idA).select()),
  );
  await check('④', 'A stage_attempts DELETE', '실패', async () =>
    denied(await a.from('stage_attempts').delete().eq('user_id', idA).select()),
  );

  // 비로그인 anon: 쓰기 전부 실패. 공개 테이블만 읽힌다
  const anonWrites: [string, () => PromiseLike<Res>][] = [
    [
      'profiles INSERT',
      () => anon.from('profiles').insert({ id: idA, nickname: '시험', tag: 1 }).select(),
    ],
    [
      'profiles UPDATE',
      () => anon.from('profiles').update({ nickname: '시험' }).eq('id', idA).select(),
    ],
    ['profiles DELETE', () => anon.from('profiles').delete().eq('id', idA).select()],
    [
      'runs INSERT',
      () =>
        anon
          .from('runs')
          .insert({
            user_id: idA,
            seed: 1,
            mode: 'timeattack',
            version: 'rls-check',
            week_key: TEST_WEEK_KEY,
          })
          .select(),
    ],
    ['runs UPDATE', () => anon.from('runs').update({ seed: 2 }).eq('user_id', idA).select()],
    ['runs DELETE', () => anon.from('runs').delete().eq('user_id', idA).select()],
    ['weekly_scores INSERT', () => anon.from('weekly_scores').insert(weeklyRow).select()],
    [
      'weekly_scores UPDATE',
      () => anon.from('weekly_scores').update({ best_score: 1 }).eq('user_id', idA).select(),
    ],
    ['weekly_scores DELETE', () => anon.from('weekly_scores').delete().eq('user_id', idA).select()],
    [
      'stage_attempts INSERT',
      () =>
        anon
          .from('stage_attempts')
          .insert({ ...attempt, user_id: idA })
          .select(),
    ],
    [
      'stage_attempts UPDATE',
      () => anon.from('stage_attempts').update({ score: 1 }).eq('user_id', idA).select(),
    ],
    [
      'stage_attempts DELETE',
      () => anon.from('stage_attempts').delete().eq('user_id', idA).select(),
    ],
  ];
  for (const [label, run] of anonWrites) {
    await check('anon', `anon ${label}`, '실패', async () => denied(await run()));
  }
  await check('anon', 'anon profiles SELECT', '성공', async () =>
    readable(await anon.from('profiles').select('*').limit(5)),
  );
  await check('anon', 'anon weekly_scores SELECT', '성공', async () =>
    readable(await anon.from('weekly_scores').select('*').limit(5)),
  );
  await check('anon', 'anon runs SELECT', '실패', async () =>
    denied(await anon.from('runs').select('*').limit(5)),
  );
  await check('anon', 'anon stage_attempts SELECT', '실패', async () =>
    denied(await anon.from('stage_attempts').select('*').limit(5)),
  );

  if (withNickname) await nicknameChecks({ url, key, a, b, idA, check });
  if (withScores) await scoreChecks({ url, key, a, b, idA, check, anon });
  if (withRanking) await rankingChecks({ url, key, anon, check });

  console.log('| # | 항목 | 기대 | 결과 | 상세 |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) {
    console.log(
      `| ${r.id} | ${r.label} | ${r.expect} | ${r.outcome.pass ? 'PASS' : 'FAIL'} | ${r.outcome.detail} |`,
    );
  }
  const failCount = rows.filter((r) => !r.outcome.pass).length;
  console.log(`\n${rows.length}개 중 PASS ${rows.length - failCount}, FAIL ${failCount}`);
  return failCount === 0 ? 0 : 1;
}

interface NicknameContext {
  url: string;
  key: string;
  a: SupabaseClient;
  b: SupabaseClient;
  idA: string;
  check: (id: string, label: string, expect: string, run: () => Promise<Outcome>) => Promise<void>;
}

/** set-nickname 시험 (PLAN2 6.3). 상태 코드·CORS 헤더를 보려고 supabase-js 대신 fetch로 부른다 */
async function nicknameChecks({ url, key, a, b, idA, check }: NicknameContext): Promise<void> {
  const endpoint = `${url}/functions/v1/set-nickname`;
  const tokenA = await tokenOf(a);
  const tokenB = await tokenOf(b);
  // 같은 이름·태그 시험은 앞 항목 결과(B에 닉네임이 생겼는지)에 기대지 않게 닉네임 없는 새 사용자 C로 한다
  const c = newClient(url, key);
  await signIn(c, 'C');
  const tokenC = await tokenOf(c);
  const call = (nickname: string, token: string | null, origin = ALLOWED_ORIGIN) =>
    fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: key,
        'Content-Type': 'application/json',
        Origin: origin,
        ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ nickname }),
    });
  const expectStatus = async (res: Response, status: number, code?: string): Promise<Outcome> => {
    const text = await res.text();
    let body: { code?: unknown } = {};
    try {
      body = JSON.parse(text) as { code?: unknown };
    } catch {
      // 게이트웨이 응답은 JSON이 아닐 수 있다
    }
    const pass = res.status === status && (code === undefined || body.code === code);
    return {
      pass,
      detail: `${res.status} ${typeof body.code === 'string' ? body.code : ''}`.trim(),
    };
  };

  // 실행마다 새 익명 계정이라 닉네임이 겹쳐도 되지만, 태그 시험을 위해 A·C가 같은 이름을 쓴다
  const name = `시험A${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
  let tagA: number | null = null;

  await check('닉', `A 정상 설정 (${name})`, '200, profiles에 저장', async () => {
    const res = await call(name, tokenA);
    if (res.status !== 200) return expectStatus(res, 200);
    const body = (await res.json()) as { nickname?: unknown; tag?: unknown };
    const { data, error } = await a.from('profiles').select('nickname, tag').eq('id', idA).single();
    if (error)
      return { pass: false, detail: `profiles 조회: ${error.code ?? ''} ${error.message}` };
    tagA = typeof body.tag === 'number' ? body.tag : null;
    const pass =
      body.nickname === name && tagA !== null && data.nickname === name && data.tag === tagA;
    return { pass, detail: `200 tag ${String(body.tag)}, profiles ${data.nickname}#${data.tag}` };
  });
  // 규칙 위반 시험: 이름이 현재 규칙에서 그 코드로 거부되는지 로컬에서 먼저 확인한다 (규칙이 바뀌면 FAIL로 알림)
  const ruleCheck = async (label: string, nickname: string, code: string) =>
    check('닉', `B ${label} (${nickname})`, `400 ${code}`, async () => {
      const local = checkNickname(nickname);
      if (local.ok || local.code !== code) {
        return {
          pass: false,
          detail: `시험 이름이 현재 규칙에서 ${local.ok ? '통과' : local.code}`,
        };
      }
      return expectStatus(await call(nickname, tokenB), 400, code);
    });
  await ruleCheck('금칙어', '관리자시험', 'banned');
  await ruleCheck('금칙어 접미 변형', '시험시발놈', 'banned');
  await ruleCheck('짧음', '시', 'too-short');
  await check('닉', 'C가 A와 같은 이름', '200, A와 다른 태그', async () => {
    const res = await call(name, tokenC);
    if (res.status !== 200) return expectStatus(res, 200);
    const body = (await res.json()) as { tag?: unknown };
    const pass = typeof body.tag === 'number' && body.tag !== tagA;
    return { pass, detail: `200 tag ${String(body.tag)} (A ${String(tagA)})` };
  });
  await check('닉', 'A 두 번째 설정', '409 already-set', async () =>
    expectStatus(await call('시험A다시', tokenA), 409, 'already-set'),
  );
  await check('닉', '토큰 없음', '401', async () =>
    expectStatus(await call('시험무토큰', null), 401),
  );
  await check('닉', '무효 토큰', '401', async () =>
    expectStatus(await call('시험가짜', 'not-a-jwt'), 401),
  );

  const preflight = (origin: string) =>
    fetch(endpoint, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, apikey, content-type, x-client-info',
      },
    });
  await check('닉', '허용 출처 preflight', 'Allow-Origin = 출처', async () => {
    const res = await preflight(ALLOWED_ORIGIN);
    const allow = res.headers.get('access-control-allow-origin');
    return {
      pass: allow === ALLOWED_ORIGIN,
      detail: `${res.status}, Allow-Origin ${allow ?? '없음'}`,
    };
  });
  await check('닉', '허용 안 된 출처 preflight', 'Allow-Origin 없음', async () => {
    const res = await preflight(DISALLOWED_ORIGIN);
    const allow = res.headers.get('access-control-allow-origin');
    const pass = allow !== DISALLOWED_ORIGIN && allow !== '*';
    return { pass, detail: `${res.status}, Allow-Origin ${allow ?? '없음'}` };
  });
  await check('닉', 'A profiles 직접 UPDATE', '실패', async () =>
    denied(await a.from('profiles').update({ nickname: '시험직접' }).eq('id', idA).select()),
  );
}

interface ScoreContext extends Omit<NicknameContext, 'key'> {
  key: string;
  anon: SupabaseClient;
}

/**
 * start-run·submit-score 시험 (PLAN2 6.4 ①~⑪). A의 run 넷(정상·점수 조작·낮은 점수·버전 다름)을 먼저 발급받고
 * 서버 시각 하한(58초)이 지나도록 60초 기다린 뒤 한꺼번에 제출한다. 만료(30분)는 단위 테스트로만 본다
 */
async function scoreChecks({ url, key, a, b, idA, check, anon }: ScoreContext): Promise<void> {
  const tokenA = await tokenOf(a);
  const tokenB = await tokenOf(b);
  const call = (name: string, body: unknown, token: string) => callFn(url, key, name, body, token);
  const show = (r: FnResult) => `${r.status} ${JSON.stringify(r.body)}`;
  const expectCode = (r: FnResult, status: number, code: string): Outcome => ({
    pass: r.status === status && r.body.code === code,
    detail: show(r),
  });

  const moves = fixtureMoves();

  interface Started {
    runId: string;
    seed: number;
  }
  const runs: Record<'main' | 'tamper' | 'low' | 'old', Started | null> = {
    main: null,
    tamper: null,
    low: null,
    old: null,
  };
  await check('점①', 'A start-run 4번', '200 {runId, seed} ×4', async () => {
    const details: string[] = [];
    let pass = true;
    for (const name of Object.keys(runs) as (keyof typeof runs)[]) {
      const r = await call('start-run', { version: CORE_VERSION }, tokenA);
      const { runId, seed } = r.body;
      const ok = r.status === 200 && typeof runId === 'string' && Number.isInteger(seed);
      if (ok) runs[name] = { runId: runId as string, seed: seed as number };
      pass &&= ok;
      details.push(ok ? `${name} seed ${String(seed)}` : `${name} ${show(r)}`);
    }
    return { pass, detail: details.join(', ') };
  });
  const startedAt = Date.now();
  const need = (run: Started | null): Started => {
    if (!run) throw new Error('start-run 실패로 시험 불가');
    return run;
  };
  const payload = (run: Started, over: Record<string, unknown> = {}) => ({
    runId: run.runId,
    moves,
    clientScore: replayTimeAttack(run.seed, moves).score,
    version: CORE_VERSION,
    ...over,
  });

  await check('점③', 'A 본인 run SELECT·B는 0행', 'A 1행, B 0행', async () => {
    const run = need(runs.main);
    const own = await a.from('runs').select('id').eq('id', run.runId);
    const other = await b.from('runs').select('id').eq('id', run.runId);
    const pass = !own.error && own.data.length === 1 && !other.error && other.data.length === 0;
    return { pass, detail: `A ${rowsOf(own).length}행, B ${rowsOf(other).length}행` };
  });
  await check('점⑦', 'start-run 버전 다름', '409 version-mismatch', async () =>
    expectCode(
      await call('start-run', { version: 'old000000000' }, tokenA),
      409,
      'version-mismatch',
    ),
  );
  await check('점②', '발급 직후 제출', '400 too-fast (저장 안 함)', async () =>
    expectCode(await call('submit-score', payload(need(runs.main)), tokenA), 400, 'too-fast'),
  );

  const waitMs = JUDGE.minServerElapsedMs + 2_000 - (Date.now() - startedAt);
  if (waitMs > 0) {
    console.error(`서버 시각 하한을 넘기려고 ${Math.ceil(waitMs / 1000)}초 기다린다…`);
    await sleep(waitMs);
  }

  let first: FnResult | null = null;
  await check('점③', '60초 뒤 정상 제출', '200, weekly_scores 반영', async () => {
    const run = need(runs.main);
    const expected = replayTimeAttack(run.seed, moves).score;
    const r = await call('submit-score', payload(run), tokenA);
    first = r;
    if (r.status !== 200 || r.body.score !== expected) return { pass: false, detail: show(r) };
    const row = await a
      .from('weekly_scores')
      .select('best_score, run_id')
      .eq('user_id', idA)
      .eq('week_key', r.body.weekKey as string)
      .single();
    if (row.error) return { pass: false, detail: `${show(r)} / weekly_scores ${errText(row)}` };
    const pass = row.data.best_score === r.body.best && r.body.best === expected;
    return { pass, detail: `${show(r)} / weekly_scores ${row.data.best_score}` };
  });
  await check('점④', '같은 내용 재제출', '같은 200', async () => {
    const r = await call('submit-score', payload(need(runs.main)), tokenA);
    const pass =
      first !== null &&
      r.status === 200 &&
      JSON.stringify(r.body) === JSON.stringify((first as FnResult).body);
    return { pass, detail: show(r) };
  });
  await check('점⑤', '다른 내용 재제출', '409 resubmit-conflict', async () =>
    expectCode(
      await call('submit-score', payload(need(runs.main), { moves: moves.slice(0, -1) }), tokenA),
      409,
      'resubmit-conflict',
    ),
  );
  await check('점⑥', '점수 +10 조작 (새 run)', '400 score-mismatch', async () => {
    const run = need(runs.tamper);
    const score = replayTimeAttack(run.seed, moves).score + 10;
    return expectCode(
      await call('submit-score', payload(run, { clientScore: score }), tokenA),
      400,
      'score-mismatch',
    );
  });
  await check('점⑦', '제출 버전 다름', '409 version-mismatch', async () =>
    expectCode(
      await call('submit-score', payload(need(runs.old), { version: 'old000000000' }), tokenA),
      409,
      'version-mismatch',
    ),
  );
  await check('점⑧', 'B가 A의 runId로 제출', '404', async () => {
    const r = await call('submit-score', payload(need(runs.low)), tokenB);
    return { pass: r.status === 404, detail: show(r) };
  });
  await check('점⑨', '낮은 점수 새 run', '200, best 그대로·isNewBest false', async () => {
    const run = need(runs.low);
    const low = replayTimeAttack(run.seed, []).score;
    const best = (first as FnResult | null)?.body.best;
    if (typeof best !== 'number' || low >= best) {
      return { pass: false, detail: `시험 불가: 낮은 점수 ${low}, 기존 best ${String(best)}` };
    }
    const r = await call('submit-score', payload(run, { moves: [], clientScore: low }), tokenA);
    const pass = r.status === 200 && r.body.best === best && r.body.isNewBest === false;
    return { pass, detail: show(r) };
  });

  const week = (first as FnResult | null)?.body.weekKey;
  const mainRun = runs.main?.runId ?? NIL_UUID;
  await check('점⑩', 'A weekly_scores 직접 INSERT', '실패', async () =>
    denied(
      await a
        .from('weekly_scores')
        .insert({ user_id: idA, week_key: TEST_WEEK_KEY, best_score: 999999, run_id: mainRun })
        .select(),
    ),
  );
  await check('점⑩', 'A weekly_scores 직접 UPDATE', '실패', async () =>
    denied(
      await a
        .from('weekly_scores')
        .update({ best_score: 999999 })
        .eq('user_id', idA)
        .eq('week_key', typeof week === 'string' ? week : TEST_WEEK_KEY)
        .select(),
    ),
  );
  const rpcArgs = { p_user: idA, p_week: TEST_WEEK_KEY, p_score: 999999, p_run: mainRun };
  await check('점⑪', 'A record_weekly_best RPC', '실패', async () => {
    const res = await a.rpc('record_weekly_best', rpcArgs);
    return { pass: res.error !== null, detail: res.error ? errText(res) : '호출됨' };
  });
  await check('점⑪', 'anon record_weekly_best RPC', '실패', async () => {
    const res = await anon.rpc('record_weekly_best', rpcArgs);
    return { pass: res.error !== null, detail: res.error ? errText(res) : '호출됨' };
  });
}

interface RankingContext {
  url: string;
  key: string;
  anon: SupabaseClient;
  check: NicknameContext['check'];
}

interface RankingRpcRow {
  week_key: string;
  section: string;
  seq: number | null;
  rank: number | null;
  best_score: number | null;
  is_me: boolean;
}

/**
 * weekly_ranking 시험 (PLAN2 6.5). 닉네임 있는 R과 닉네임 없는 N이 --scores와 같은 경로(start-run → 60초 →
 * submit-score)로 이번 주 기록을 만든 뒤 R·N·anon으로 부른다
 */
async function rankingChecks({ url, key, anon, check }: RankingContext): Promise<void> {
  const r = newClient(url, key);
  const n = newClient(url, key);
  const idR = await signIn(r, 'R');
  await signIn(n, 'N');
  const tokenR = await tokenOf(r);
  const tokenN = await tokenOf(n);
  const moves = fixtureMoves();
  const show = (res: FnResult) => `${res.status} ${JSON.stringify(res.body)}`;

  const nameR = `시험R${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
  await check('랭', `R 닉네임 설정 (${nameR})`, '200', async () => {
    const res = await callFn(url, key, 'set-nickname', { nickname: nameR }, tokenR);
    return { pass: res.status === 200, detail: show(res) };
  });

  // 기록 만들기: run 발급 → 서버 시각 하한을 넘기고 제출
  const started: Record<'R' | 'N', { runId: string; seed: number } | null> = { R: null, N: null };
  for (const [who, token] of [
    ['R', tokenR],
    ['N', tokenN],
  ] as const) {
    const res = await callFn(url, key, 'start-run', { version: CORE_VERSION }, token);
    const { runId, seed } = res.body;
    if (res.status === 200 && typeof runId === 'string' && Number.isInteger(seed)) {
      started[who] = { runId, seed: seed as number };
    }
  }
  const waitMs = JUDGE.minServerElapsedMs + 2_000;
  console.error(`기록을 만들려고 ${Math.ceil(waitMs / 1000)}초 기다린다…`);
  await sleep(waitMs);
  const best: Record<'R' | 'N', number | null> = { R: null, N: null };
  for (const [who, token] of [
    ['R', tokenR],
    ['N', tokenN],
  ] as const) {
    await check('랭', `${who} 기록 만들기 (start-run → submit-score)`, '200', async () => {
      const run = started[who];
      if (!run) return { pass: false, detail: 'start-run 실패' };
      const clientScore = replayTimeAttack(run.seed, moves).score;
      const res = await callFn(
        url,
        key,
        'submit-score',
        { runId: run.runId, moves, clientScore, version: CORE_VERSION },
        token,
      );
      if (res.status === 200 && typeof res.body.best === 'number') best[who] = res.body.best;
      return { pass: best[who] !== null, detail: show(res) };
    });
  }

  const rpc = async (client: SupabaseClient, week?: string) => {
    const res = await client.rpc('weekly_ranking', week === undefined ? {} : { p_week: week });
    if (res.error) throw new Error(errText(res));
    return res.data as RankingRpcRow[];
  };
  const listed = (rows: RankingRpcRow[]) =>
    rows.filter((x) => x.section === 'top' || x.section === 'around');
  const weekRows = (rows: RankingRpcRow[]) => rows.filter((x) => x.section === 'week');
  const meOf = (rows: RankingRpcRow[]) => rows.filter((x) => x.section === 'me');
  const summary = (rows: RankingRpcRow[]) =>
    `${rows.length}행 (top ${rows.filter((x) => x.section === 'top').length}, ` +
    `around ${rows.filter((x) => x.section === 'around').length}, me ${JSON.stringify(meOf(rows))})`;

  await check('랭', 'anon 호출', '성공, week 1행 + top만, is_me 모두 false', async () => {
    const rows = await rpc(anon);
    const pass =
      rows[0]?.section === 'week' &&
      weekRows(rows).length === 1 &&
      rows.slice(1).every((x) => x.section === 'top' && x.is_me === false);
    return { pass, detail: summary(rows) };
  });
  await check(
    '랭',
    '이번 주 week 행',
    '맨 앞 1개, week_key = 서버 주 = weekKey(지금)',
    async () => {
      const rows = await rpc(r);
      const w = weekRows(rows);
      const local = weekKey(Date.now());
      const pass =
        rows[0]?.section === 'week' &&
        w.length === 1 &&
        w[0]!.week_key === local &&
        rows.every((x) => x.week_key === local);
      return { pass, detail: `서버 ${w.map((x) => x.week_key).join(',')}, 로컬 ${local}` };
    },
  );
  await check(
    '랭',
    'R(닉네임 있음) 호출',
    '목록에 is_me 행, me.rank 있음·점수 = best',
    async () => {
      const rows = await rpc(r);
      const me = meOf(rows);
      const mine = listed(rows).filter((x) => x.is_me);
      const pass =
        me.length === 1 &&
        Number.isInteger(me[0]!.rank) &&
        me[0]!.best_score === best.R &&
        mine.length >= 1 &&
        mine.every((x) => x.seq === me[0]!.seq && x.best_score === best.R);
      return { pass, detail: summary(rows) };
    },
  );
  await check('랭', 'N(닉네임 없음) 호출', '목록에 없음, me.rank null·점수 = best', async () => {
    const rows = await rpc(n);
    const me = meOf(rows);
    const pass =
      me.length === 1 &&
      me[0]!.rank === null &&
      me[0]!.best_score === best.N &&
      !listed(rows).some((x) => x.is_me) &&
      !rows.some((x) => x.section === 'around');
    return { pass, detail: summary(rows) };
  });
  await check('랭', '먼 과거 주 (2000-W01)', 'week 행 1개 + 나머지 0행', async () => {
    const rows = await rpc(r, '2000-W01');
    const pass =
      rows.length === 1 && rows[0]!.section === 'week' && rows[0]!.week_key === '2000-W01';
    return { pass, detail: JSON.stringify(rows) };
  });

  const week = (await rpc(r))[0]?.week_key ?? TEST_WEEK_KEY;
  await check('랭', 'R weekly_scores 직접 INSERT', '실패', async () =>
    denied(
      await r
        .from('weekly_scores')
        .insert({ user_id: idR, week_key: TEST_WEEK_KEY, best_score: 999999, run_id: NIL_UUID })
        .select(),
    ),
  );
  await check('랭', 'R weekly_scores 직접 UPDATE', '실패', async () =>
    denied(
      await r
        .from('weekly_scores')
        .update({ best_score: 999999 })
        .eq('user_id', idR)
        .eq('week_key', week)
        .select(),
    ),
  );
  await check('랭', 'R weekly_scores 직접 DELETE', '실패', async () =>
    denied(await r.from('weekly_scores').delete().eq('user_id', idR).select()),
  );
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  },
);
