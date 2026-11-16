// DEV ?fakeranking=<list|empty|error|slow|offline|nonick|norecord>: 서버 없이 랭킹 화면(주간 점수·스토리 별 두 탭)을 확인하는 가짜 클라이언트.
// 데이터는 탭마다 60명 (내가 57위, 2·3위와 55·56위는 같은 점수 = 공동 순위, 10자 닉네임·6자리 점수 포함).
// list=목록, empty=빈 주, error·offline=첫 요청만 실패하고 [다시 시도]하면 목록, slow=2초 뒤 목록,
// nonick=닉네임 없음 (이름 정하면 목록에 내가 나온다), norecord=내 기록 없음.
// 배포 빌드에서는 main.ts의 분기째 빠진다.

import { checkNickname } from '../online/nicknameRules';
import { weekKey } from '../replay/weekKey';
import { setRankingClient } from '../scenes/rankingClient';
import type { RankingResult, RankingRow, StoryRankingResult } from '../view/rankingRows';

const SLOW_MS = 2000;
const ME_SEQ = 57;
const TOTAL = 60;
/** 스토리 탭 점수 = 별 합계: 1위 90에서 한 명마다 1씩 내려간다 (2·3위, 55·56위는 같은 별 = 공동 순위) */
const STORY_TOP_STARS = 90;
const ME_NAME = '두비';
const NAMES = [
  '가나다라마바사아자차', // 10자
  '이안',
  '하늘',
  'Mina',
  '초코우유',
  '별사탕',
  '토리',
  '말랑이',
  'Dobby99',
  '구름빵',
];

/** 점수 내림차순 60명. 2·3위, 55·56위는 같은 점수 */
function buildRows(kind: 'weekly' | 'story'): RankingRow[] {
  const scores = Array.from({ length: TOTAL }, (_, i) =>
    kind === 'story' ? STORY_TOP_STARS - i : 987_654 - i * 15_321,
  );
  scores[2] = scores[1]!;
  scores[55] = scores[54]!;
  const rows: RankingRow[] = [];
  let rank = 0;
  for (let i = 0; i < TOTAL; i++) {
    const seq = i + 1;
    if (i === 0 || scores[i] !== scores[i - 1]) rank = seq;
    const isMe = seq === ME_SEQ;
    rows.push({
      seq,
      rank,
      nickname: isMe ? ME_NAME : NAMES[i % NAMES.length]!,
      tag: isMe ? 42 : (i * 137) % 10_000,
      score: scores[i]!,
      isMe,
    });
  }
  return rows;
}

export function installFakeRanking(mode: string): void {
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const weeklyRows = buildRows('weekly');
  const storyRows = buildRows('story');
  const key = weekKey(Date.now());
  // 탭마다 따로 센다: [다시 시도]가 그 탭의 두 번째 요청이 되게
  const calls = { weekly: 0, story: 0 };
  let named = mode !== 'nonick';

  const parts = (rows: RankingRow[], withMe: boolean) => {
    const shown = rows.map((r) => ({ ...r, isMe: withMe && r.isMe }));
    const me = rows[ME_SEQ - 1]!;
    return {
      top: shown.slice(0, 50),
      around: withMe ? shown.slice(ME_SEQ - 6, ME_SEQ + 5) : [],
      me: mode === 'norecord' ? null : { rank: withMe ? me.rank : null, score: me.score },
    };
  };
  const list = (withMe: boolean): RankingResult => ({
    kind: 'ok',
    weekKey: key,
    ...parts(weeklyRows, withMe),
  });
  const storyList = (withMe: boolean): StoryRankingResult => ({
    kind: 'ok',
    ...parts(storyRows, withMe),
  });

  /** 7가지 모드의 응답 순서를 한 곳에서: ok = 탭의 정상 응답, fail = 첫 요청만 실패 */
  async function respond<T>(
    n: number,
    ok: (withMe: boolean) => T,
    empty: T,
    error: T,
    offline: T,
  ): Promise<T> {
    switch (mode) {
      case 'empty':
        return empty;
      case 'error':
        return n === 1 ? error : ok(true);
      case 'offline':
        return n === 1 ? offline : ok(true);
      case 'slow':
        await sleep(SLOW_MS);
        return ok(true);
      case 'nonick':
        return ok(named);
      case 'norecord':
        return ok(false);
      default:
        return ok(true);
    }
  }

  setRankingClient({
    fetchRanking() {
      return respond<RankingResult>(
        ++calls.weekly,
        list,
        { kind: 'ok', weekKey: key, top: [], around: [], me: null },
        { kind: 'error' },
        { kind: 'offline' },
      );
    },
    fetchStoryRanking() {
      return respond<StoryRankingResult>(
        ++calls.story,
        storyList,
        { kind: 'ok', top: [], around: [], me: null },
        { kind: 'error' },
        { kind: 'offline' },
      );
    },
    async setNickname(name) {
      await sleep(600);
      const check = checkNickname(name);
      if (!check.ok) return { ok: false, code: check.code };
      named = true;
      return { ok: true, nickname: check.nickname, tag: '0042' };
    },
  });
}
