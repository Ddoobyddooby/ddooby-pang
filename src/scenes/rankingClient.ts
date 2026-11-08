// 주간 랭킹 화면의 데이터 연결 (V2-W3-04, PLAN2 6.5). RankingScene은 이 모양만 알고, 실제 구현은 main.ts가 setRankingClient로 꽂는다
// (src/online의 fetchRanking·setNickname). 꽂기 전(테스트 등)에는 "연결 불가"를 돌려주는 클라이언트라 화면이 안내만 보인다 (runClient.ts와 같은 방식).

import type { RankingResult as OnlineRankingResult } from '../online';
import type { NicknameResult } from '../view/nicknamePromptState';
import type { RankingResult } from '../view/rankingRows';

export type { RankingResult } from '../view/rankingRows';

// view는 online을 import하지 않는다(의존 방향). 그래서 rankingRows가 입력 타입을 갖고, 여기서 src/online의 타입과
// 서로 대입 가능한지 컴파일 때 확인한다. 한쪽 모양이 바뀌면 타입 검사(npm run build)가 여기서 실패한다
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export const RANKING_TYPES_MATCH: Same<RankingResult, OnlineRankingResult> = true;

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
