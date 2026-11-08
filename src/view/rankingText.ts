// 랭킹 문구 (경쟁 결과·시작 화면의 등록 줄 V2-W3-03, 주간 랭킹 화면 V2-W3-04, PLAN2 6.4·6.5). 화면 글자를 한곳에 모은다.
// Jua에 가운뎃점(·)이 없어서 띄어쓰기로 구분한다.

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

  // ── 주간 랭킹 화면 (V2-W3-04) ──
  title: '주간 랭킹',
  loading: '불러오는 중…',
  offline: '인터넷에 연결되면 랭킹을 볼 수 있어요',
  error: '랭킹을 불러오지 못했어요',
  empty: '이번 주 첫 기록을 남겨 보세요!',
  retry: '다시 시도',
  refresh: '새로고침',
  back: '돌아가기',
  setName: '이름 정하기',
  noRecord: '이번 주 기록이 없어요',
  /** n = 순위 */
  myRank: (n: number) => `내 순위 ${n}위`,
  /** score = 천 단위 쉼표를 넣은 점수 */
  noNickname: (score: string) => `${score}점 이름을 정하면 랭킹에 보여요`,
} as const;
