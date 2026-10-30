// 결과 화면의 순수한 부분 (Phaser 없음, 테스트용으로 분리): 숫자 형식, 개발 미리보기, 화면 구성 결정.

import { RESULT } from '../config';
import type { ModeResult } from '../modes/GameMode';

/** 12450 → "12,450". 소수는 버리고 음수·NaN은 0으로 본다 */
export function formatScore(n: number): string {
  const value = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const intParam = (params: URLSearchParams, key: string): number =>
  Math.max(0, Math.floor(Number(params.get(key)) || 0));

/**
 * DEV 미리보기. result가 없으면 null.
 * `?result=N(&best=M)` → 경쟁, `?result=N&stage=S(&stars=0~3&bonus=B)` → 스토리 (stars=0이면 실패)
 */
export function previewResult(search: string): ModeResult | null {
  const params = new URLSearchParams(search);
  if (!params.has('result')) return null;
  const score = intParam(params, 'result');
  if (params.has('stage')) {
    const stars = Math.min(3, intParam(params, 'stars')) as 0 | 1 | 2 | 3;
    const cleared = stars > 0;
    return {
      kind: 'story',
      stageId: Math.max(1, intParam(params, 'stage')),
      cleared,
      score,
      bonus: cleared ? intParam(params, 'bonus') : 0,
      stars,
    };
  }
  const bestScore = intParam(params, 'best');
  return { kind: 'timeattack', score, bestScore, newBest: score > bestScore };
}

export type ResultButton = 'next' | 'retry' | 'map' | 'menu';

/** 결과 화면에 무엇을 보일지 (설계 4절 표) */
export interface ResultView {
  title: string;
  /** 스토리 별 칸에 채울 수. 경쟁은 null (별 칸 없음) */
  stars: number | null;
  /** 경쟁의 "최고 점수 N" 줄 */
  best: string | null;
  newBest: boolean;
  /** 스토리 클리어의 "남은 이동 보너스 +N" 줄 (보너스 0이면 null) */
  bonus: string | null;
  /** 마지막 스테이지 클리어: [다음 스테이지] 대신 "모든 스테이지 클리어!" */
  allClear: boolean;
  /** 위에서부터 놓을 버튼 */
  buttons: ResultButton[];
}

/** unlocked = 저장된 열린 번호 (결과 화면 전에 저장이 반영된다) */
export function resultView(
  result: ModeResult,
  { stageCount, unlocked }: { stageCount: number; unlocked: number },
): ResultView {
  const t = RESULT.text;
  if (result.kind === 'timeattack') {
    return {
      title: t.timeattack,
      stars: null,
      best: `${t.best} ${formatScore(Math.max(result.bestScore, result.score))}`,
      newBest: result.newBest,
      bonus: null,
      allClear: false,
      buttons: ['retry', 'menu'],
    };
  }

  const next = result.stageId + 1;
  const hasNext = result.cleared && next <= stageCount && unlocked >= next;
  return {
    title: result.cleared ? t.clear : t.fail,
    stars: result.stars,
    best: null,
    newBest: false,
    bonus: result.cleared && result.bonus > 0 ? `${t.bonus} +${formatScore(result.bonus)}` : null,
    allClear: result.cleared && result.stageId >= stageCount,
    buttons: hasNext ? ['next', 'retry', 'map'] : ['retry', 'map'],
  };
}
