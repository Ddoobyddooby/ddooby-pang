// 경쟁 결과·시작 화면의 랭킹 등록 문구 (V2-W3-03, PLAN2 6.4). 화면 글자를 한곳에 모은다.

export const RANKING_TEXT = {
  /** 경쟁을 누른 뒤 서버 run을 받는 동안 */
  preparing: '준비 중…',
  submitting: '랭킹에 올리는 중…',
  /** n = 천 단위 쉼표를 넣은 점수 */
  best: (n: string) => `이번 주 최고 ${n}점`,
  failed: '랭킹에 올리지 못했어요 (점수는 저장됐어요)',
  outdated: '새 버전이 있어요. 새로고침해 주세요',
  /** run 없이 시작한 판 (시간 초과·서버 오류) */
  unranked: '이번 판은 랭킹에 안 올라가요',
} as const;
