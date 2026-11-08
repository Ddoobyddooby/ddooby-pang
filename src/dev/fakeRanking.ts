// DEV ?fakeranking=<list|empty|error|slow|offline|nonick|norecord>: 서버 없이 주간 랭킹 화면을 확인하는 가짜 클라이언트.
// 데이터는 60명 (내가 57위, 2·3위와 55·56위는 같은 점수 = 공동 순위, 10자 닉네임·6자리 점수 포함).
// list=목록, empty=빈 주, error·offline=첫 요청만 실패하고 [다시 시도]하면 목록, slow=2초 뒤 목록,
// nonick=닉네임 없음 (이름 정하면 목록에 내가 나온다), norecord=내 기록 없음.
// 배포 빌드에서는 main.ts의 분기째 빠진다.

import { checkNickname } from '../online/nicknameRules';
import { weekKey } from '../replay/weekKey';
import { setRankingClient } from '../scenes/rankingClient';
import type { RankingResult, RankingRow } from '../view/rankingRows';

const SLOW_MS = 2000;
const ME_SEQ = 57;
const TOTAL = 60;
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
function buildRows(): RankingRow[] {
  const scores = Array.from({ length: TOTAL }, (_, i) => 987_654 - i * 15_321);
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
  const rows = buildRows();
  const key = weekKey(Date.now());
  let calls = 0;
  let named = mode !== 'nonick';

  const list = (withMe: boolean): RankingResult => {
    const shown = rows.map((r) => ({ ...r, isMe: withMe && r.isMe }));
    const me = rows[ME_SEQ - 1]!;
    return {
      kind: 'ok',
      weekKey: key,
      top: shown.slice(0, 50),
      around: withMe ? shown.slice(ME_SEQ - 6, ME_SEQ + 5) : [],
      me: mode === 'norecord' ? null : { rank: withMe ? me.rank : null, score: me.score },
    };
  };

  setRankingClient({
    async fetchRanking() {
      calls++;
      switch (mode) {
        case 'empty':
          return { kind: 'ok', weekKey: key, top: [], around: [], me: null };
        case 'error':
          return calls === 1 ? { kind: 'error' } : list(true);
        case 'offline':
          return calls === 1 ? { kind: 'offline' } : list(true);
        case 'slow':
          await sleep(SLOW_MS);
          return list(true);
        case 'nonick':
          return list(named);
        case 'norecord':
          return list(false);
        default:
          return list(true);
      }
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
