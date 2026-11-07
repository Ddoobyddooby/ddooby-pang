// start-run·submit-score 공통 HTTP 처리 (PLAN2 6.4): CORS 허용 출처, JSON 응답, Bearer 토큰.
// set-nickname(V2-W3-02)과 같은 규칙이다. Deno·Supabase에 의존하지 않아 Vitest에서도 읽는다

/** CORS 허용 출처: GitHub Pages, Capacitor 앱, 개발 서버 (SPEC 8절) */
export const ALLOWED_ORIGINS: readonly string[] = [
  'https://ddoobyddooby.github.io',
  'https://localhost',
  'http://localhost:5173',
];

export type Cors = Record<string, string>;

export function corsHeaders(allowHeaders: string, origin: string | null): Cors {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(status: number, body: unknown, cors: Cors): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
}

/**
 * POST가 아니면 바로 줄 응답 (preflight 204/403, 그 밖 405). POST면 null.
 * 허용 안 된 출처의 preflight에는 허용 헤더를 주지 않는다 → 브라우저가 본 요청을 막는다
 */
export function nonPostResponse(req: Request, cors: Cors): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin');
    return new Response(null, {
      status: origin && ALLOWED_ORIGINS.includes(origin) ? 204 : 403,
      headers: cors,
    });
  }
  if (req.method !== 'POST') return json(405, { code: 'method' }, cors);
  return null;
}

/** 본문 JSON. 읽을 수 없으면 undefined */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
