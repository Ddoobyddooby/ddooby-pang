// HUD 글자 형식. Phaser 없는 순수 함수라 테스트할 수 있다.

/** 1234 → "1,234" */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-US');
}

/** 37400ms → "0:37" (남은 시간은 올림: 0.1초 남아도 0:01) */
export function formatTime(ms: number): string {
  const sec = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
