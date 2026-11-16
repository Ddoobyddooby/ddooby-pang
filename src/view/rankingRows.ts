// 주간 랭킹 화면의 순수한 부분 (V2-W3-04, PLAN2 6.5). Phaser 없음, 테스트한다.
// 서버 응답(top 1~50번째 + 내 위아래 5명 + 내 상태) → 화면 줄·하단 고정 줄·상태. 주 기간 문자열.
// 타입은 src/online/ranking.ts(fetchRanking)가 돌려주는 모양과 같다 (구조가 같아 그대로 넘긴다).

import { RANKING_TEXT } from './rankingText';

/** 서버가 준 한 줄. seq = 나열 순번(공동 순위와 무관), rank = 표시 순위(공동이면 같은 값) */
export interface RankingRow {
  seq: number;
  rank: number;
  nickname: string;
  tag: number;
  score: number;
  isMe: boolean;
}

/** 내 상태. rank null = 기록은 있는데 닉네임이 없어 순위에 안 들어간 것 */
export interface RankingMe {
  rank: number | null;
  score: number;
}

export type RankingResult =
  | { kind: 'ok'; weekKey: string; top: RankingRow[]; around: RankingRow[]; me: RankingMe | null }
  | { kind: 'offline' }
  | { kind: 'error' };

/** 스토리 별 랭킹 응답 (V2-W5-02): 주 정보가 없고 score = 별 합계 */
export type StoryRankingResult =
  | { kind: 'ok'; top: RankingRow[]; around: RankingRow[]; me: RankingMe | null }
  | { kind: 'offline' }
  | { kind: 'error' };

/** 랭킹 화면의 탭 종류: 주간 점수 / 스토리 별 */
export type RankingKind = 'weekly' | 'story';

/** 화면에 그릴 줄 하나. 글자는 모두 만들어 둔다 */
export interface RankingLine {
  kind: 'row';
  /** "12" (공동 순위는 같은 숫자가 두 번 나온다) */
  rank: string;
  nickname: string;
  /** "#0427" */
  tag: string;
  /** "15,320" */
  score: string;
  isMe: boolean;
  /** 1~3위면 그 숫자(금·은·동 색), 아니면 null */
  medal: 1 | 2 | 3 | null;
}

/** 순번이 끊기는 곳 */
export interface RankingGap {
  kind: 'gap';
}

export type RankingItem = RankingLine | RankingGap;

/** 하단 고정 줄 */
export type RankingFooter =
  | { kind: 'me'; rank: number; score: string }
  /** score = 스토리 탭의 "★ N"(기기 저장 합계, 0 포함). 주간 탭은 없다 */
  | { kind: 'noRecord'; score?: string }
  /** 기록은 있는데 닉네임이 없다: [이름 정하기]를 같이 보인다 */
  | { kind: 'noNickname'; score: string };

export type RankingView =
  | { state: 'offline' }
  | { state: 'error' }
  | { state: 'empty'; footer: RankingFooter | null }
  | { state: 'list'; items: RankingItem[]; footer: RankingFooter };

/** 15320 → "15,320" */
export function formatPoints(n: number): string {
  const value = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 4 → "#0004" */
export function formatTagText(tag: number): string {
  return `#${String(Math.max(0, Math.floor(tag))).padStart(4, '0')}`;
}

/** 탭에 맞는 점수 글자: 주간 "15,320", 스토리 "★ 57" */
export function formatScore(kind: RankingKind, n: number): string {
  return kind === 'story' ? RANKING_TEXT.stars(Math.max(0, Math.floor(n))) : formatPoints(n);
}

function toLine(row: RankingRow, kind: RankingKind): RankingLine {
  return {
    kind: 'row',
    rank: String(row.rank),
    nickname: row.nickname,
    tag: formatTagText(row.tag),
    score: formatScore(kind, row.score),
    isMe: row.isMe,
    medal: row.rank >= 1 && row.rank <= 3 ? (row.rank as 1 | 2 | 3) : null,
  };
}

/** top과 around를 seq로 합쳐 중복을 없애고, 순번이 끊기는 곳(앞 줄 seq + 1이 아닌 곳)에 gap을 끼운다 */
export function mergeRows(
  top: RankingRow[],
  around: RankingRow[],
  kind: RankingKind = 'weekly',
): RankingItem[] {
  const bySeq = new Map<number, RankingRow>();
  for (const row of [...top, ...around]) bySeq.set(row.seq, row);
  const rows = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  const items: RankingItem[] = [];
  let prev: number | null = null;
  for (const row of rows) {
    if (prev !== null && row.seq !== prev + 1) items.push({ kind: 'gap' });
    items.push(toLine(row, kind));
    prev = row.seq;
  }
  return items;
}

/**
 * localStars = 이 기기에 저장된 별 합계 (스토리 탭에서 서버 기록이 없을 때만 쓴다).
 * 내 별은 조회 결과(me)를 먼저 쓴다
 */
function footerFor(me: RankingMe | null, kind: RankingKind, localStars: number): RankingFooter {
  if (!me) {
    return kind === 'story'
      ? { kind: 'noRecord', score: formatScore(kind, localStars) }
      : { kind: 'noRecord' };
  }
  if (me.rank === null) return { kind: 'noNickname', score: formatScore(kind, me.score) };
  return { kind: 'me', rank: me.rank, score: formatScore(kind, me.score) };
}

/** 응답 → 화면 상태. kind = 어느 탭의 응답인지, localStars = 스토리 탭의 기기 별 합계 */
export function selectView(
  result: RankingResult | StoryRankingResult,
  kind: RankingKind = 'weekly',
  localStars = 0,
): RankingView {
  if (result.kind !== 'ok') return { state: result.kind };
  const footer = footerFor(result.me, kind, localStars);
  if (result.top.length === 0) {
    // 빈 주: 안내 문구가 이미 "기록이 없다"를 말하므로 주간 탭은 기록 없음 줄을 겹쳐 그리지 않는다.
    // 스토리 탭은 빈 목록에서도 내 별(0 포함)을 보인다
    const hide = kind === 'weekly' && footer.kind === 'noRecord';
    return { state: 'empty', footer: hide ? null : footer };
  }
  return { state: 'list', items: mergeRows(result.top, result.around, kind), footer };
}

/** 하단 고정 줄 글자 */
export function footerText(
  footer: RankingFooter,
  kind: RankingKind = 'weekly',
): { left: string; right: string } {
  const t = RANKING_TEXT;
  switch (footer.kind) {
    case 'me':
      return { left: t.myRank(footer.rank), right: footer.score };
    case 'noRecord':
      return {
        left: footer.score === undefined ? t.noRecord : t.storyNoRecord(footer.score),
        right: '',
      };
    case 'noNickname':
      return {
        left: kind === 'story' ? t.storyNoNickname(footer.score) : t.noNickname(footer.score),
        right: '',
      };
  }
}

/** 아래쪽 왼쪽 버튼 글자: 연결 불가·오류에서는 [다시 시도], 나머지는 [새로고침] */
export function refreshLabel(view: RankingView | null): string {
  return view && (view.state === 'offline' || view.state === 'error')
    ? RANKING_TEXT.retry
    : RANKING_TEXT.refresh;
}

/** 안내 문구가 가운데에 보이는 상태의 글자 (목록 상태는 null) */
export function messageFor(view: RankingView, kind: RankingKind = 'weekly'): string | null {
  const story = kind === 'story';
  switch (view.state) {
    case 'offline':
      return story ? RANKING_TEXT.storyOffline : RANKING_TEXT.offline;
    case 'error':
      return story ? RANKING_TEXT.storyError : RANKING_TEXT.error;
    case 'empty':
      return story ? RANKING_TEXT.storyEmpty : RANKING_TEXT.empty;
    case 'list':
      return null;
  }
}

/** "2026-W45" → { start, end } 월~일의 [월, 일]. 형식이 틀리면 null */
function weekDays(key: string): { start: [number, number]; end: [number, number] } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // ISO 1주차 = 1월 4일이 든 주. 그 주 월요일에서 (week-1)주 뒤가 이 주 월요일
  const jan4 = Date.UTC(year, 0, 4);
  const jan4Dow = new Date(jan4).getUTCDay() || 7; // 월 1 … 일 7
  const monday = jan4 - (jan4Dow - 1) * 86_400_000 + (week - 1) * 7 * 86_400_000;
  const mon = new Date(monday);
  const sun = new Date(monday + 6 * 86_400_000);
  return {
    start: [mon.getUTCMonth() + 1, mon.getUTCDate()],
    end: [sun.getUTCMonth() + 1, sun.getUTCDate()],
  };
}

/** "2026-W45" → "11월 2일(월) ~ 11월 8일(일)". 형식이 틀리면 빈 문자열 */
export function weekRangeText(key: string): string {
  const days = weekDays(key);
  if (!days) return '';
  const [m1, d1] = days.start;
  const [m2, d2] = days.end;
  return `${m1}월 ${d1}일(월) ~ ${m2}월 ${d2}일(일)`;
}

/** 이 기기에 저장된 별 합계: 대상 스테이지(범위)·별(범위) 안의 최고 별만 더한다 */
export function localStarTotal(
  bestStars: Record<number, number>,
  range: { stageMin: number; stageMax: number; starMin: number; starMax: number },
): number {
  let total = 0;
  for (const [key, stars] of Object.entries(bestStars)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id < range.stageMin || id > range.stageMax) continue;
    if (!Number.isInteger(stars) || stars < range.starMin || stars > range.starMax) continue;
    total += stars;
  }
  return total;
}
