// 주간 랭킹의 주 (SPEC 5.2): KST(UTC+9, 서머타임 없음) 날짜의 ISO 8601 주차. 월요일 00:00 KST에 바뀐다.
// 서버(start-run)가 run 발급 시각으로 정하고, 랭킹 화면(V2-W3-04)도 같은 함수를 쓴다. import 없음

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ms(Unix 시각) → '2026-W45'. ISO 주차는 그 주 목요일이 속한 해를 쓴다 (연말·연초에 해가 바뀔 수 있다) */
export function weekKey(ms: number): string {
  // KST 벽시계 시각을 UTC 필드로 읽는다
  const kst = new Date(ms + KST_OFFSET_MS);
  const day = kst.getUTCDay() || 7; // 월 1 … 일 7
  const thursday = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 4 - day);
  const year = new Date(thursday).getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}
