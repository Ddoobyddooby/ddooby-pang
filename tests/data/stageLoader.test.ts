import { describe, expect, it } from 'vitest';
import { loadStages, type FetchFn } from '../../src/data/stageLoader';

const story = [
  {
    id: 1,
    rows: 8,
    cols: 8,
    colors: 4,
    moves: 25,
    goals: [{ type: 'score', target: 2000 }],
    stars: [2000, 6000, 9000],
  },
];
const timeattack = { rows: 8, cols: 8, colors: 5, timeLimit: 60 };

/** url 끝 파일 이름 → 응답. 값이 함수면 호출해서 던질 수 있다 */
type Reply = { status?: number; body?: unknown; badJson?: boolean; throws?: Error };
const fakeFetch =
  (replies: Record<string, Reply>, urls: string[] = []): FetchFn =>
  (url) => {
    urls.push(url);
    const r = replies[url.split('/').pop()!] ?? { status: 404 };
    if (r.throws) return Promise.reject(r.throws);
    const status = r.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () =>
        r.badJson ? Promise.reject(new SyntaxError('Unexpected token')) : Promise.resolve(r.body),
    });
  };

const good = { 'story.json': { body: story }, 'timeattack.json': { body: timeattack } };

describe('loadStages', () => {
  it('정상: 두 파일을 base 기준 상대 경로로 받아 검증한 값을 돌려준다', async () => {
    const urls: string[] = [];
    const data = await loadStages(fakeFetch(good, urls), './');
    expect(data.story).toHaveLength(1);
    expect(data.story[0]!.goals).toEqual([{ type: 'score', target: 2000 }]);
    expect(data.timeattack.timeLimit).toBe(60);
    expect(urls.sort()).toEqual(['./stages/story.json', './stages/timeattack.json']);
  });

  it('404: 파일 이름과 HTTP 상태가 메시지에 있다', async () => {
    const f = fakeFetch({ ...good, 'story.json': { status: 404 } });
    await expect(loadStages(f, './')).rejects.toThrow(/stages\/story\.json.*HTTP 404/);
  });

  it('깨진 JSON: 파일 이름과 JSON 형식 문제를 말한다', async () => {
    const f = fakeFetch({ ...good, 'timeattack.json': { badJson: true } });
    await expect(loadStages(f, './')).rejects.toThrow(/stages\/timeattack\.json.*JSON 형식/);
  });

  it('검증 실패: 파일 이름과 위치가 메시지에 있다', async () => {
    const broken = [{ ...story[0], goals: [{ type: 'score', target: 0 }] }];
    const f = fakeFetch({ ...good, 'story.json': { body: broken } });
    await expect(loadStages(f, './')).rejects.toThrow(
      /stages\/story\.json: story\[0\]\.goals\[0\]\.target/,
    );
  });

  it('네트워크 오류(throw): 파일 이름과 원인이 메시지에 있다', async () => {
    const f = fakeFetch({ ...good, 'story.json': { throws: new TypeError('Failed to fetch') } });
    await expect(loadStages(f, './')).rejects.toThrow(/stages\/story\.json.*Failed to fetch/);
  });
});
