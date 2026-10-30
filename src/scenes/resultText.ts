// 결과 화면의 순수한 부분 (Phaser 없음, 테스트용으로 분리).

import type { ModeResult } from '../modes/GameMode';

/** 12450 → "12,450". 소수는 버리고 음수·NaN은 0으로 본다 */
export function formatScore(n: number): string {
  const value = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** DEV 미리보기: `?result=N(&best=M)`이면 가짜 타임어택 결과. result가 없으면 null */
export function previewResult(search: string): ModeResult | null {
  const params = new URLSearchParams(search);
  if (!params.has('result')) return null;
  const score = Math.max(0, Math.floor(Number(params.get('result')) || 0));
  const bestScore = Math.max(0, Math.floor(Number(params.get('best')) || 0));
  return { kind: 'timeattack', score, bestScore, newBest: score > bestScore };
}
