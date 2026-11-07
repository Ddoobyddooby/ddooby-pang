// 경쟁 결과 화면의 랭킹 등록 상태 (V2-W3-03, PLAN2 6.4). 순수 함수라 테스트한다.

import { RANKING_TEXT } from '../view/rankingText';
import { formatScore } from './resultText';
import type { SubmitOutcome } from './runClient';

/** 결과 화면이 받는 등록 상태. none이면 줄을 그리지 않는다 (오프라인·키 없음·DEV 옵션 판) */
export type RankInfo =
  | { kind: 'none' }
  /** run 없이 시작해서 랭킹 대상이 아닌 판 (서버에는 연결 가능했지만 run을 못 받았다) */
  | { kind: 'unranked' }
  | { kind: 'submitting'; outcome: Promise<SubmitOutcome> };

/** 등록 줄의 처음 글자 (줄이 없으면 null). 결과 줄 배치에 줄이 있는지 알려 준다 */
export function initialRankLine(rank: RankInfo | undefined): string | null {
  if (!rank || rank.kind === 'none') return null;
  return rank.kind === 'unranked' ? RANKING_TEXT.unranked : RANKING_TEXT.submitting;
}

/** 제출이 끝난 뒤 등록 줄 글자 */
export function rankLineFor(outcome: SubmitOutcome): string {
  switch (outcome.kind) {
    case 'ok':
      return RANKING_TEXT.best(formatScore(outcome.best));
    case 'outdated':
      return RANKING_TEXT.outdated;
    default:
      return RANKING_TEXT.failed; // rejected·failed
  }
}
