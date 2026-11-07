// start-run 처리 로직 (PLAN2 6.4): 가짜 deps로 토큰·버전·seed 발급·runs 저장·CORS를 본다
import { describe, expect, it, vi } from 'vitest';
import {
  handleStartRun,
  SEED_LIMIT,
  type NewRun,
  type StartRunDeps,
} from '../../supabase/functions/start-run/handler';
import { ALLOWED_ORIGINS } from '../../supabase/functions/_lib/http';
import { weekKey } from '../../src/replay/weekKey';

const ORIGIN = 'https://ddoobyddooby.github.io';
const URL = 'https://example.supabase.co/functions/v1/start-run';
const VERSION = 'abc123def456';
const NOW = Date.UTC(2026, 10, 8, 14, 59, 59); // KST 일요일 23:59:59

function fakeDeps() {
  const runs: NewRun[] = [];
  const deps = {
    allowHeaders: 'authorization, x-client-info, apikey, content-type',
    version: VERSION,
    now: vi.fn(() => NOW),
    getUserId: vi.fn(async (token: string) => (token === 'good-token' ? 'user-a' : null)),
    randomSeed: vi.fn(() => 424242),
    insertRun: vi.fn(async (run: NewRun) => {
      runs.push(run);
      return `run-${runs.length}`;
    }),
  } satisfies StartRunDeps;
  return { deps, runs };
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer good-token',
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const read = async (res: Response) => ({ status: res.status, body: await res.json() });

describe('handleStartRun', () => {
  it('정상 → 200 {runId, seed}, runs에 사용자·seed·version·발급 주·발급 시각 저장', async () => {
    const { deps, runs } = fakeDeps();
    const res = await handleStartRun(deps, post({ version: VERSION }));
    expect(await read(res)).toEqual({ status: 200, body: { runId: 'run-1', seed: 424242 } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(runs).toEqual([
      { userId: 'user-a', seed: 424242, version: VERSION, weekKey: '2026-W45', createdAtMs: NOW },
    ]);
    expect(weekKey(NOW)).toBe('2026-W45');
  });

  it('버전이 서버와 다르면 409 version-mismatch, run을 만들지 않는다', async () => {
    const { deps } = fakeDeps();
    expect(await read(await handleStartRun(deps, post({ version: 'old000000000' })))).toEqual({
      status: 409,
      body: { code: 'version-mismatch' },
    });
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON 아님', '{v'],
    ['version 없음', {}],
    ['version 숫자', { version: 1 }],
    ['version 빈 문자열', { version: '' }],
    ['null', 'null'],
  ])('본문 형식 오류(%s) → 400 bad-request', async (_label, body) => {
    const { deps } = fakeDeps();
    expect(await read(await handleStartRun(deps, post(body)))).toEqual({
      status: 400,
      body: { code: 'bad-request' },
    });
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it.each([
    ['헤더 없음', null],
    ['무효 토큰', 'Bearer bad-token'],
  ])('토큰 %s → 401', async (_label, auth) => {
    const { deps } = fakeDeps();
    const req = post({ version: VERSION });
    if (auth === null) req.headers.delete('Authorization');
    else req.headers.set('Authorization', auth);
    expect((await handleStartRun(deps, req)).status).toBe(401);
    expect(deps.insertRun).not.toHaveBeenCalled();
  });

  it('DB·인증 오류 → 500 server', async () => {
    const { deps } = fakeDeps();
    deps.insertRun.mockRejectedValueOnce(new Error('db down'));
    expect(await read(await handleStartRun(deps, post({ version: VERSION })))).toEqual({
      status: 500,
      body: { code: 'server' },
    });
    deps.getUserId.mockRejectedValueOnce(new Error('auth down'));
    expect((await handleStartRun(deps, post({ version: VERSION }))).status).toBe(500);
  });

  it('CORS: 허용 출처 preflight 204, 허용 안 된 출처 403·허용 헤더 없음, GET 405', async () => {
    const { deps } = fakeDeps();
    const preflight = (origin: string) =>
      new Request(URL, { method: 'OPTIONS', headers: { Origin: origin } });
    for (const origin of ALLOWED_ORIGINS) {
      const res = await handleStartRun(deps, preflight(origin));
      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    }
    const evil = await handleStartRun(deps, preflight('https://evil.example'));
    expect(evil.status).toBe(403);
    expect(evil.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect((await handleStartRun(deps, new Request(URL, { method: 'GET' }))).status).toBe(405);
    expect(deps.getUserId).not.toHaveBeenCalled();
  });

  it('seed 범위는 0 이상 1,000,000 미만', () => {
    expect(SEED_LIMIT).toBe(1_000_000);
  });
});
