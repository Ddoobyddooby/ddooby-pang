// 주간 랭킹 조회 (PLAN2 6.5). DB 함수 weekly_ranking을 한 번 부른다.
// 게임을 막지 않는다: 어떤 실패도 throw하지 않고 {kind:'offline'}·{kind:'error'}로 돌려준다
import type { Account } from './account';
import { isValidTag } from './nicknameRules';
import { within } from './runs';

/** 랭킹 응답을 기다리는 최대 시간. 넘으면 error */
export const RANKING_TIMEOUT_MS = 5000;

/** top·around 한 줄. seq는 나열 순번(1부터, 중복 제거·⋯ 판단용), rank는 표시 순위(공동 순위) */
export interface RankingRow {
  seq: number;
  rank: number;
  nickname: string;
  tag: number;
  score: number;
  isMe: boolean;
}

/** 내 상태. rank null = 기록은 있으나 닉네임이 없어 목록에 안 보인다 */
export interface RankingMe {
  rank: number | null;
  score: number;
}

/**
 * - ok: top은 나열 1~50번째, around는 내 나열 순번 ±5(나 포함, top과 겹칠 수 있다), me는 기록 없음·비로그인이면 null
 * - offline: 키 없음·오프라인·계정 없음 (요청하지 않았다)
 * - error: 시간 초과·서버 오류·네트워크·응답 형식 오류
 */
export type RankingResult =
  | { kind: 'ok'; weekKey: string; top: RankingRow[]; around: RankingRow[]; me: RankingMe | null }
  | { kind: 'offline' }
  | { kind: 'error' };

export interface RankingDeps {
  isOnline(): boolean;
  timeoutMs?: number;
}

export interface Ranking {
  /** week가 없으면 서버 시각의 이번 주 */
  fetchRanking(week?: string): Promise<RankingResult>;
}

const isCount = (v: unknown, min: number): v is number =>
  Number.isInteger(v) && (v as number) >= min;

/**
 * 응답 행 → 결과. 형식이 어긋나면 null (error로 처리).
 * 주 키는 항상 'week' 메타 행에서 받는다 (빈 주에도 있다). 기기 시계로 대신하지 않는다
 */
function parseRows(data: unknown): RankingResult | null {
  if (!Array.isArray(data)) return null;
  const top: RankingRow[] = [];
  const around: RankingRow[] = [];
  let me: RankingMe | null = null;
  let weekKey: string | null = null;
  const weeks = new Set<string>();
  for (const raw of data as unknown[]) {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.week_key !== 'string' || r.week_key === '') return null;
    weeks.add(r.week_key);
    if (r.section === 'week') {
      if (weekKey !== null) return null;
      weekKey = r.week_key;
      continue;
    }
    if (r.section === 'me') {
      const rank = r.rank === null ? null : isCount(r.rank, 1) ? r.rank : undefined;
      if (me !== null || rank === undefined || !isCount(r.best_score, 0)) return null;
      me = { rank, score: r.best_score };
      continue;
    }
    if (r.section !== 'top' && r.section !== 'around') return null;
    if (
      !isCount(r.seq, 1) ||
      !isCount(r.rank, 1) ||
      typeof r.nickname !== 'string' ||
      !isValidTag(r.tag) ||
      !isCount(r.best_score, 0) ||
      typeof r.is_me !== 'boolean'
    )
      return null;
    const row: RankingRow = {
      seq: r.seq,
      rank: r.rank,
      nickname: r.nickname,
      tag: r.tag,
      score: r.best_score,
      isMe: r.is_me,
    };
    (r.section === 'top' ? top : around).push(row);
  }
  // week 행이 없거나 다른 주의 행이 섞였다
  if (weekKey === null || weeks.size !== 1) return null;
  const bySeq = (a: RankingRow, b: RankingRow) => a.seq - b.seq;
  return {
    kind: 'ok',
    weekKey,
    top: top.sort(bySeq),
    around: around.sort(bySeq),
    me,
  };
}

export function createRanking(account: Account, deps: RankingDeps): Ranking {
  const timeoutMs = deps.timeoutMs ?? RANKING_TIMEOUT_MS;
  const offline: RankingResult = { kind: 'offline' };
  const error: RankingResult = { kind: 'error' };

  return {
    async fetchRanking(week) {
      if (account.status() === 'disabled' || !deps.isOnline()) return offline;
      return within<RankingResult>(timeoutMs, error, async () => {
        // 계정이 아직이면(부팅 직후 등) 익명 로그인을 한 번 시도한다. 그래도 없으면 요청하지 않는다
        await account.ensure();
        const backend = account.backend();
        if (!backend) return offline;
        const res = await backend.callRpc(
          'weekly_ranking',
          week === undefined ? {} : { p_week: week },
        );
        if (res === 'error') return error;
        return parseRows(res.data) ?? error;
      });
    },
  };
}
