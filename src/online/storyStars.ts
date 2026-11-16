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
      if (!isCount(r.rank, 1) || !isCount(r.seq, 1)) return null;
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

  const send = async (picked: [number, number][]): Promise<StarsSyncResult> => {
    if (picked.length === 0) return { kind: 'ok', total: 0 };
    if (account.status() === 'disabled' || !deps.isOnline()) return offline;
    const content = JSON.stringify(picked);
    // 성공했을 때만 기억한다. 시간 초과 뒤 늦게 온 성공은 within이 버리므로 commit도 불리지 않는다
    type Done = { result: StarsSyncResult; commit?: () => void };
    const done = await within<Done>(timeoutMs, { result: error }, async () => {
      await account.ensure();
      const backend = account.backend();
      const uid = account.userId();
      if (!backend || !uid) return { result: offline };
      const cached = lastSent.get(uid);
      if (cached?.content === content) return { result: { kind: 'ok', total: cached.total } };
      const res = await backend.callRpc('sync_story_stars', {
        p_stars: Object.fromEntries(picked.map(([stage, stars]) => [String(stage), stars])),
      });
      if (res === 'error' || !isTotal(res.data)) return { result: error };
      const total = res.data;
      return {
        result: { kind: 'ok', total },
        // 응답이 오는 사이 계정이 바뀌었으면 이 성공은 원래 계정 것이라 새 계정의 기억이 되지 않는다
        commit: () => lastSent.set(uid, { content, total }),
      };
    });
    done.commit?.();
    return done.result;
  };

  return {
    syncStoryStars(bestStars) {
      // 부른 시점의 내용을 고정한다. 뒤 호출은 앞 호출이 끝난 뒤 자기 내용을 보낸다
      const picked = pickStoryStars(bestStars);
      const run = queue.then(() => send(picked)).catch(() => error);
      queue = run;
      return run;
    },

    async fetchStoryRanking() {
      if (account.status() === 'disabled' || !deps.isOnline()) return offline;
      return within<StoryRankingResult>(timeoutMs, error, async () => {
        await account.ensure();
        const backend = account.backend();
        if (!backend) return offline;
        const res = await backend.callRpc('story_ranking', {});
        if (res === 'error') return error;
        return parseStoryRows(res.data) ?? error;
      });
    },
  };
}
