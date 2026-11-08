// 주간 랭킹 화면의 데이터 연결 (V2-W3-04, PLAN2 6.5). RankingScene은 이 모양만 알고, 실제 구현은 main.ts가 setRankingClient로 꽂는다
// (src/online의 fetchRanking·setNickname). 꽂기 전에는 "연결 불가"를 돌려주는 클라이언트라 화면이 안내만 보인다 (runClient.ts와 같은 방식).

import type { NicknameResult } from '../view/nicknamePromptState';
import type { RankingResult } from '../view/rankingRows';

export type { RankingResult } from '../view/rankingRows';

export interface RankingClient {
  /** 이번 주 랭킹. 절대 throw하지 않는다 (키 없음·오프라인이면 요청 없이 offline) */
  fetchRanking(): Promise<RankingResult>;
  /** 닉네임 입력 창이 쓰는 저장 함수 (결과 화면과 같은 규칙) */
  setNickname(name: string): Promise<NicknameResult>;
}

const NO_RANKING: RankingClient = {
  fetchRanking: () => Promise.resolve({ kind: 'offline' }),
  setNickname: () => Promise.resolve({ ok: false, code: 'network' }),
};

let client: RankingClient = NO_RANKING;

export function setRankingClient(next: RankingClient): void {
  client = next;
}

export function getRankingClient(): RankingClient {
  return client;
}
