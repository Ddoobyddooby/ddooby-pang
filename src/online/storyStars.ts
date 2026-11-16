// 스토리 별 랭킹 (SPEC v0.2 5.4, PLAN2 6.9·6.9.1). DB 함수 sync_story_stars·story_ranking을 부른다.
// 게임을 막지 않는다: 어떤 실패도 throw하지 않고 {kind:'offline'}·{kind:'error'}로 돌려준다.
// online은 storage를 모르므로 기기의 bestStars는 인자로 받는다
import type { Account } from './account';
import { isValidTag } from './nicknameRules';
import type { RankingMe, RankingRow } from './ranking';
import { within } from './runs';

/** 동기화·조회 응답을 기다리는 최대 시간. 넘으면 error */
export const STORY_STARS_TIMEOUT_MS = 5000;

/** 스토리 랭킹 대상 스테이지 수. 합계 상한은 이 값 × 3 */
const STAGE_COUNT = 30;
const MAX_TOTAL = STAGE_COUNT * 3;

/**
 * - ok: total은 서버 합계(0~90). 단, 보낼 별이 없어 요청하지 않았으면 0이다 (서버 합계가 아니다. D-05)
 * - offline: 키 없음·오프라인·계정 없음 (요청하지 않았다)
 * - error: 시간 초과·서버 오류·네트워크·응답 형식 오류
 */
export type StarsSyncResult =
  { kind: 'ok'; total: number } | { kind: 'offline' } | { kind: 'error' };

/**
 * - ok: top은 나열 1~50번째, around는 내 나열 순번 ±5(나 포함, top과 겹칠 수 있다), me는 기록 없음·비로그인이면 null.
 *   RankingRow·RankingMe의 score는 별 합계다
 * - offline·error: RankingResult와 같다
 */
export type StoryRankingResult =
  | { kind: 'ok'; top: RankingRow[]; around: RankingRow[]; me: RankingMe | null }
  | { kind: 'offline' }
  | { kind: 'error' };

export interface StoryStarsDeps {
  isOnline(): boolean;
  timeoutMs?: number;
}

export interface StoryStars {
  /** 기기의 스테이지별 최고 별 전체. 호출은 한 줄로 세워 앞 호출이 끝난 뒤 보낸다 */
  syncStoryStars(bestStars: Record<number, number>): Promise<StarsSyncResult>;
  fetchStoryRanking(): Promise<StoryRankingResult>;
}

const STAGE_KEY = /^([1-9]|[12][0-9]|30)$/;

/**
 * 보낼 항목만 스테이지 번호순으로 고른다: 키 1~30(정규 표기), 값은 정수 1~3.
 * 0·범위 밖·시험 스테이지 번호·숫자가 아닌 값은 버린다. 원본은 바꾸지 않는다
 */
export function pickStoryStars(bestStars: Record<number, number>): [number, number][] {
  const picked: [number, number][] = [];
  try {
    if (typeof bestStars !== 'object' || bestStars === null) return [];
    for (const [key, value] of Object.entries(bestStars)) {
      if (!STAGE_KEY.test(key)) continue;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3) continue;
      picked.push([Number(key), value]);
    }
  } catch {
    return [];
  }
  return picked.sort((a, b) => a[0] - b[0]);
}

const isCount = (v: unknown, min: number): v is number =>
  Number.isInteger(v) && (v as number) >= min;

const isTotal = (v: unknown): v is number => isCount(v, 0) && v <= MAX_TOTAL;

/**
 * story_ranking 응답 → 결과. 형식이 어긋나면 null (error로 처리). weekly의 parseRows와 같은 엄격함이되
 * week 메타 행은 없다 (섞여 오면 모르는 section이라 거부)
 */
function parseStoryRows(data: unknown): StoryRankingResult | null {
  if (!Array.isArray(data)) return null;
  const top: RankingRow[] = [];
  const around: RankingRow[] = [];
  let me: RankingMe | null = null;
  for (const raw of data as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (!isTotal(r.total_stars) || typeof r.is_me !== 'boolean') return null;
    if (r.section === 'me') {
      if (me !== null || r.is_me !== true) return null;
      // 닉네임 있음: rank·seq 모두 있다 / 닉네임 없음: rank·seq 모두 null
      if (r.rank === null && r.seq === null) {
        me = { rank: null, score: r.total_stars };
        continue;
      }
      if (!isCount(r.rank, 1) || !isCount(r.seq, 1) || r.rank > r.seq) return null;
      me = { rank: r.rank, score: r.total_stars };
      continue;
    }
    if (r.section !== 'top' && r.section !== 'around') return null;
    if (
      !isCount(r.seq, 1) ||
      !isCount(r.rank, 1) ||
      r.rank > r.seq ||
      typeof r.nickname !== 'string' ||
      !isValidTag(r.tag)
    )
      return null;
    if (r.section === 'top' && r.seq > 50) return null;
    const row: RankingRow = {
      seq: r.seq,
      rank: r.rank,
      nickname: r.nickname,
      tag: r.tag,
      score: r.total_stars,
      isMe: r.is_me,
    };
    (r.section === 'top' ? top : around).push(row);
  }
  const bySeq = (a: RankingRow, b: RankingRow) => a.seq - b.seq;
  return { kind: 'ok', top: top.sort(bySeq), around: around.sort(bySeq), me };
}

export function createStoryStars(account: Account, deps: StoryStarsDeps): StoryStars {
  const timeoutMs = deps.timeoutMs ?? STORY_STARS_TIMEOUT_MS;
  const offline = { kind: 'offline' } as const;
  const error = { kind: 'error' } as const;

  /** 계정(user id)별 마지막 성공 내용. 메모리에만 둔다 (D-01) */
  const lastSent = new Map<string, { content: string; total: number }>();
  /** 앞선 동기화가 끝나면 풀린다 (D-02). 결과와 무관하게 reject하지 않는다 */
  let queue: Promise<unknown> = Promise.resolve();

  /**
   * 요청 하나의 마감. 호출 시점부터 timeoutMs (큐 대기 포함, R1). 마감이 지난 작업은 새 RPC를 시작하지 않고(R2)
   * 늦게 온 응답도 기억하지 않는다
   */
  const deadlineFrom = () => {
    const at = Date.now() + timeoutMs;
    let expired = false;
    return {
      expire: () => (expired = true),
      expired: () => expired || Date.now() >= at,
    };
  };

  const send = async (
    picked: [number, number][],
    req: ReturnType<typeof deadlineFrom>,
  ): Promise<StarsSyncResult> => {
    if (picked.length === 0) return { kind: 'ok', total: 0 };
    if (account.status() === 'disabled' || !deps.isOnline()) return offline;
    const content = JSON.stringify(picked);
    await account.ensure();
    // 계정 준비를 기다리는 사이 마감이 지났으면 보내지 않는다 (이미 error로 끝났다)
    if (req.expired()) return error;
    const backend = account.backend();
    const uid = account.userId();
    if (!backend || !uid) return offline;
    const cached = lastSent.get(uid);
    if (cached?.content === content) return { kind: 'ok', total: cached.total };
    if (req.expired()) return error;
    const res = await backend.callRpc('sync_story_stars', {
      p_stars: Object.fromEntries(picked.map(([stage, stars]) => [String(stage), stars])),
    });
    if (res === 'error' || !isTotal(res.data)) return error;
    // 마감 뒤 늦게 온 성공은 기억하지 않는다. 응답 사이 계정이 바뀌어도 이 성공은 보낸 계정(uid) 것으로만 기억한다
    if (req.expired()) return error;
    lastSent.set(uid, { content, total: res.data });
    return { kind: 'ok', total: res.data };
  };

  return {
    syncStoryStars(bestStars) {
      // 부른 시점의 내용을 고정한다. 뒤 호출은 앞 호출이 끝난 뒤 자기 내용을 보낸다.
      // 대기 중 마감이 지나면 큐가 풀려도 보내지 않는다. 큐는 각 호출이 끝나거나 마감되면 풀린다
      const picked = pickStoryStars(bestStars);
      const req = deadlineFrom();
      const prev = queue;
      // 보낼 것이 없으면 요청 없이 ok 0. 큐 순서(앞 호출을 기다림)는 지키되 마감·실패 경로에서도 ok 0이다 (G1)
      const failed: StarsSyncResult = picked.length === 0 ? { kind: 'ok', total: 0 } : error;
      const run = new Promise<StarsSyncResult>((resolve) => {
        const timer = setTimeout(() => {
          req.expire();
          resolve(failed);
        }, timeoutMs);
        prev
          .then(() => (req.expired() ? failed : send(picked, req)))
          .then(
            (result) => {
              clearTimeout(timer);
              resolve(result);
            },
            () => {
              clearTimeout(timer);
              resolve(failed);
            },
          );
      });
      queue = run;
      return run;
    },

    async fetchStoryRanking() {
      if (account.status() === 'disabled' || !deps.isOnline()) return offline;
      let expired = false;
      const result = within<StoryRankingResult>(timeoutMs, error, async () => {
        await account.ensure();
        if (expired) return error;
        const backend = account.backend();
        // 요청 계정을 고정한다. 응답이 왔을 때 계정이 바뀌었으면(로그아웃 포함) 이전 계정의 me를 쓰지 않는다 (R3)
        const uid = account.userId();
        if (!backend || !uid) return offline;
        const res = await backend.callRpc('story_ranking', {});
        if (account.userId() !== uid) return error;
        if (res === 'error') return error;
        return parseStoryRows(res.data) ?? error;
      });
      void result.then(() => (expired = true));
      return result;
    },
  };
}
