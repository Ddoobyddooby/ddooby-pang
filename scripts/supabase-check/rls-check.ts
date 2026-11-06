// V2-W3-01 권한(RLS·GRANT) 시험: 원격 개발 프로젝트에 익명 사용자 A·B와 비로그인 anon으로 접속해
// PLAN2 6.2 시험 ①~④와 anon 쓰기 차단을 확인한다. publishable key만 쓴다 (npm test에 넣지 않음).
//
//   npm run supabase:check [-- <env 파일 경로>] [--nickname]   (기본값 .env.local)
//
// --nickname: Edge Function set-nickname 시험을 더한다 (V2-W3-02, 함수 배포 뒤에만).
// 시험이 만든 익명 계정, stage_attempts 행(stage_id 999), `시험` 접두어 닉네임은 개발 프로젝트에 남는다.
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// 함수와 같은 규칙 묶음 (npm run server:shared). 시험 이름이 현재 규칙에서 기대대로 판정되는지 먼저 본다
import { checkNickname } from '../../supabase/functions/_shared/nicknameRules.js';

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
  const tokenOf = async (client: SupabaseClient) => {
    const { data } = await client.auth.getSession();
    if (!data.session) throw new Error('세션 없음');
    return data.session.access_token;
  };
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

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  },
);
