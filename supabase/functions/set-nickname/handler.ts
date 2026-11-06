// set-nickname 처리 로직 (PLAN2 6.3). Deno·Supabase에 의존하지 않는 순수 핸들러라 Vitest에서 가짜 deps로 시험한다.
// 실제 연결(사용자 확인·DB·난수)은 index.ts가 넣어 준다.
// 이 파일은 Deno(deno check)와 tsc(Vitest 경유) 둘 다 읽으므로 상대 import에 .ts 확장자를 쓰지 않는다
import { checkNickname, TAG_MAX_ATTEMPTS } from '../_shared/nicknameRules.js';

/** CORS 허용 출처: GitHub Pages, Capacitor 앱, 개발 서버 (SPEC 8절) */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://ddoobyddooby.github.io',
  'https://localhost',
  'http://localhost:5173',
];

export type SaveResult = 'ok' | 'tag-taken' | 'already-set';

export interface SetNicknameDeps {
  /** 브라우저가 보내는 요청 헤더 허용 목록 (supabase-js의 corsHeaders 값) */
  allowHeaders: string;
  /** 토큰이 유효하면 사용자 ID, 아니면 null */
  getUserId(token: string): Promise<string | null>;
  /** 이미 정한 닉네임. 없거나 profiles 행이 없으면 null */
  getNickname(userId: string): Promise<string | null>;
  /** 닉네임이 아직 없을 때만 저장. (nickname, tag) unique 위반이면 'tag-taken' */
  saveNickname(userId: string, nickname: string, tag: number): Promise<SaveResult>;
  /** 0~9999 정수 */
  randomTag(): number;
}

function corsHeaders(deps: SetNicknameDeps, origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': deps.allowHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

export async function handleSetNickname(deps: SetNicknameDeps, req: Request): Promise<Response> {
  const origin = req.headers.get('Origin');
  const cors = corsHeaders(deps, origin);

  if (req.method === 'OPTIONS') {
    // 허용 안 된 출처의 preflight에는 허용 헤더를 주지 않는다 → 브라우저가 본 요청을 막는다
    return new Response(null, {
      status: origin && ALLOWED_ORIGINS.includes(origin) ? 204 : 403,
      headers: cors,
    });
  }
  if (req.method !== 'POST') return json(405, { code: 'method' }, cors);

  try {
    // CORS와 별개로 토큰을 검사한다 (SPEC 8절)
    const token = bearerToken(req);
    const userId = token ? await deps.getUserId(token) : null;
    if (!userId) return json(401, { code: 'unauthorized' }, cors);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { code: 'bad-request' }, cors);
    }
    const name = (body as { nickname?: unknown } | null)?.nickname;
    if (typeof name !== 'string') return json(400, { code: 'bad-request' }, cors);

    const check = checkNickname(name);
    if (!check.ok) return json(400, { code: check.code }, cors);

    if ((await deps.getNickname(userId)) !== null) return json(409, { code: 'already-set' }, cors);

    for (let i = 0; i < TAG_MAX_ATTEMPTS; i++) {
      const tag = deps.randomTag();
      const saved = await deps.saveNickname(userId, check.nickname, tag);
      if (saved === 'ok') return json(200, { nickname: check.nickname, tag }, cors);
      if (saved === 'already-set') return json(409, { code: 'already-set' }, cors);
      // tag-taken: 다시 뽑는다
    }
    return json(500, { code: 'server' }, cors);
  } catch {
    return json(500, { code: 'server' }, cors);
  }
}
