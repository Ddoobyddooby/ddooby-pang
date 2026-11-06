import { describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_ORIGINS,
  handleSetNickname,
  type SaveResult,
  type SetNicknameDeps,
} from '../../supabase/functions/set-nickname/handler';
import { TAG_MAX_ATTEMPTS } from '../../src/online/nicknameRules';

const ORIGIN = 'https://ddoobyddooby.github.io';
const URL = 'https://example.supabase.co/functions/v1/set-nickname';

/** 가짜 DB: profiles를 Map으로 두고 (nickname, tag) unique를 흉내 낸다 */
function fakeDeps(opts: { tags?: number[]; users?: Record<string, string> } = {}) {
  const profiles = new Map<string, { nickname: string | null; tag: number | null }>();
  const tags = [...(opts.tags ?? [427])];
  const deps = {
    allowHeaders: 'authorization, x-client-info, apikey, content-type',
    getUserId: vi.fn(
      async (token: string) => (opts.users ?? { 'good-token': 'user-a' })[token] ?? null,
    ),
    getNickname: vi.fn(async (userId: string) => profiles.get(userId)?.nickname ?? null),
    saveNickname: vi.fn(
      async (userId: string, nickname: string, tag: number): Promise<SaveResult> => {
        const row = profiles.get(userId);
        if (row?.nickname) return 'already-set';
        for (const [id, p] of profiles) {
          if (id !== userId && p.nickname === nickname && p.tag === tag) return 'tag-taken';
        }
        profiles.set(userId, { nickname, tag });
        return 'ok';
      },
    ),
    randomTag: vi.fn(() => tags.shift() ?? 0),
  } satisfies SetNicknameDeps;
  return { deps, profiles };
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

async function read(res: Response) {
  return {
    status: res.status,
    body: res.status === 204 || res.status === 403 ? null : await res.json(),
  };
}

describe('handleSetNickname', () => {
  it('성공 → 200 {nickname, tag}, 정규화된 이름으로 저장, 허용 출처 CORS 헤더', async () => {
    const { deps, profiles } = fakeDeps();
    const res = await handleSetNickname(deps, post({ nickname: ' 이안 ' }));
    expect(await read(res)).toEqual({ status: 200, body: { nickname: '이안', tag: 427 } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(profiles.get('user-a')).toEqual({ nickname: '이안', tag: 427 });
  });

  it.each([
    ['짧음', '가', 'too-short'],
    ['김', '가나다라마바사아자차카', 'too-long'],
    ['기호', '이안!', 'bad-chars'],
    ['금칙어', '운영자', 'banned'],
  ])('규칙 위반(%s) → 400, 저장 안 함', async (_label, nickname, code) => {
    const { deps } = fakeDeps();
    expect(await read(await handleSetNickname(deps, post({ nickname })))).toEqual({
      status: 400,
      body: { code },
    });
    expect(deps.saveNickname).not.toHaveBeenCalled();
  });

  it.each([
    ['JSON 아님', '{nick'],
    ['nickname 없음', { name: '이안' }],
    ['문자열 아님', { nickname: 12 }],
    ['null', 'null'],
  ])('본문 형식 오류(%s) → 400 bad-request', async (_label, body) => {
    const { deps } = fakeDeps();
    expect(await read(await handleSetNickname(deps, post(body)))).toEqual({
      status: 400,
      body: { code: 'bad-request' },
    });
  });

  it.each([
    ['헤더 없음', {}],
    ['Bearer 아님', { Authorization: 'good-token' }],
    ['무효 토큰', { Authorization: 'Bearer bad-token' }],
  ])('토큰 %s → 401, 본문을 읽기 전에 거부', async (_label, headers) => {
    const { deps } = fakeDeps();
    const req = post({ nickname: '이안' }, headers);
    if (!('Authorization' in headers)) req.headers.delete('Authorization');
    expect(await read(await handleSetNickname(deps, req))).toEqual({
      status: 401,
      body: { code: 'unauthorized' },
    });
    expect(deps.getNickname).not.toHaveBeenCalled();
  });

  it('이미 닉네임 있음 → 409 already-set (두 번째 설정)', async () => {
    const { deps } = fakeDeps({ tags: [1, 2] });
    await handleSetNickname(deps, post({ nickname: '이안' }));
    expect(await read(await handleSetNickname(deps, post({ nickname: '보라' })))).toEqual({
      status: 409,
      body: { code: 'already-set' },
    });
  });

  it('조회 뒤 저장 사이에 다른 요청이 먼저 정함 → 409', async () => {
    const { deps } = fakeDeps();
    deps.saveNickname.mockResolvedValueOnce('already-set');
    expect((await handleSetNickname(deps, post({ nickname: '이안' }))).status).toBe(409);
  });

  it('태그 충돌 → 다시 뽑아 겹치지 않는 태그로 저장', async () => {
    const { deps, profiles } = fakeDeps({ tags: [7, 7, 7, 8], users: { ta: 'a', tb: 'b' } });
    await handleSetNickname(deps, post({ nickname: '이안' }, { Authorization: 'Bearer ta' }));
    const res = await handleSetNickname(
      deps,
      post({ nickname: '이안' }, { Authorization: 'Bearer tb' }),
    );
    expect(await read(res)).toEqual({ status: 200, body: { nickname: '이안', tag: 8 } });
    expect(profiles.get('a')?.tag).toBe(7);
    expect(deps.randomTag).toHaveBeenCalledTimes(4);
  });

  it(`태그가 ${TAG_MAX_ATTEMPTS}번 모두 겹치면 500 server`, async () => {
    const { deps } = fakeDeps();
    deps.saveNickname.mockResolvedValue('tag-taken');
    expect(await read(await handleSetNickname(deps, post({ nickname: '이안' })))).toEqual({
      status: 500,
      body: { code: 'server' },
    });
    expect(deps.saveNickname).toHaveBeenCalledTimes(TAG_MAX_ATTEMPTS);
  });

  it('DB·인증 오류 → 500 server', async () => {
    const { deps } = fakeDeps();
    deps.getNickname.mockRejectedValueOnce(new Error('db down'));
    expect(await read(await handleSetNickname(deps, post({ nickname: '이안' })))).toEqual({
      status: 500,
      body: { code: 'server' },
    });
    deps.getUserId.mockRejectedValueOnce(new Error('auth down'));
    expect((await handleSetNickname(deps, post({ nickname: '이안' }))).status).toBe(500);
  });

  it('POST·OPTIONS 말고는 405', async () => {
    const { deps } = fakeDeps();
    const res = await handleSetNickname(
      deps,
      new Request(URL, { method: 'GET', headers: { Origin: ORIGIN } }),
    );
    expect(res.status).toBe(405);
  });
});

describe('CORS', () => {
  const preflight = (origin?: string) =>
    new Request(URL, {
      method: 'OPTIONS',
      headers: {
        ...(origin ? { Origin: origin } : {}),
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type',
      },
    });

  it.each(ALLOWED_ORIGINS)('허용 출처 %s preflight → 204 + 허용 헤더', async (origin) => {
    const { deps } = fakeDeps();
    const res = await handleSetNickname(deps, preflight(origin));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe(deps.allowHeaders);
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(deps.getUserId).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example',
    'http://localhost:3000',
    'https://ddoobyddooby.github.io.evil.example',
  ])('허용 안 된 출처 %s preflight → 허용 헤더 없음', async (origin) => {
    const { deps } = fakeDeps();
    const res = await handleSetNickname(deps, preflight(origin));
    expect(res.status).toBe(403);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Headers')).toBeNull();
  });

  it('출처 없는 preflight → 허용 헤더 없음', async () => {
    const res = await handleSetNickname(fakeDeps().deps, preflight());
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('허용 안 된 출처의 POST도 토큰 검사는 그대로, 응답에 허용 헤더 없음', async () => {
    const { deps } = fakeDeps();
    const res = await handleSetNickname(
      deps,
      post({ nickname: '이안' }, { Origin: 'https://evil.example' }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const noToken = post({ nickname: '이안' }, { Origin: 'https://evil.example' });
    noToken.headers.delete('Authorization');
    expect((await handleSetNickname(deps, noToken)).status).toBe(401);
  });
});
