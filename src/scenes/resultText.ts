// 결과 화면의 순수한 부분 (Phaser 없음, 테스트용으로 분리): 숫자 형식, 개발 미리보기, 화면 구성 결정.

import { RESULT } from '../config';
import type { ModeResult } from '../modes/GameMode';
import type { SfxName } from '../view/Sfx';

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

/**
 * 결과 화면에 들어갈 때 같이 시작하는 소리 (PLAN 6.15). 스토리는 클리어/실패,
 * 경쟁은 최고 기록이면 축하 곡 + 박수, 못 깨면 아쉬움 곡
 */
export function resultSounds(result: ModeResult): SfxName[] {
  if (result.kind === 'story') return [result.cleared ? 'clear' : 'fail'];
  return result.newBest ? ['newbest', 'applause'] : ['nobest'];
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
  /** 경쟁의 랭킹 등록 상태 줄 처음 글자 (없으면 null: 줄 없음) */
  rankLine: string | null;
  /** 마지막 스테이지 클리어: [다음 스테이지] 대신 "모든 스테이지 클리어!" */
  allClear: boolean;
  /** 위에서부터 놓을 버튼 */
  buttons: ResultButton[];
}

/** unlocked = 저장된 열린 번호 (결과 화면 전에 저장이 반영된다) */
export function resultView(
  result: ModeResult,
  {
    stageCount,
    unlocked,
    rankLine = null,
  }: { stageCount: number; unlocked: number; rankLine?: string | null },
): ResultView {
  const t = RESULT.text;
  if (result.kind === 'timeattack') {
    return {
      title: t.timeattack,
      stars: null,
      best: `${t.best} ${formatScore(Math.max(result.bestScore, result.score))}`,
      newBest: result.newBest,
      bonus: null,
      rankLine,
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
    rankLine: null,
    allClear: result.cleared && result.stageId >= stageCount,
    buttons: hasNext ? ['next', 'retry', 'map'] : ['retry', 'map'],
  };
}

export type ResultRow =
  'title' | 'stars' | 'scoreLabel' | 'score' | 'line' | 'badge' | 'rank' | 'allClear';

export interface ResultLayout {
  /** 있는 줄의 가운데 y (화면 가운데 기준) */
  rows: Partial<Record<ResultRow, number>>;
  /** 버튼 가운데 y, 위에서부터 */
  buttons: number[];
  /** 묶음의 맨 위·맨 아래 (판을 그릴 때) */
  top: number;
  bottom: number;
}

/**
 * 결과 화면 줄 배치 (W4-14). 있는 줄만 RESULT.layout 간격으로 쌓고, 묶음 전체를 화면 가운데(0)에 맞춘다.
 * 그래서 경쟁(별 없음)·스토리 클리어·실패 어느 쪽도 한쪽만 비어 보이지 않는다
 */
export function resultLayout(view: ResultView): ResultLayout {
  const { gap, scoreGap, beforeButtons, h } = RESULT.layout;
  const b = RESULT.button;
  const present: ResultRow[] = ['title'];
  if (view.stars !== null) present.push('stars');
  present.push('scoreLabel', 'score');
  if (view.best ?? view.bonus) present.push('line');
  if (view.newBest) present.push('badge');
  if (view.rankLine) present.push('rank');
  if (view.allClear) present.push('allClear');

  // 위(0)에서부터 쌓아 가운데 y를 적고, 나중에 전체 높이의 절반만큼 올린다
  const rows: Partial<Record<ResultRow, number>> = {};
  let y = 0;
  present.forEach((row, i) => {
    if (i > 0) y += row === 'score' ? scoreGap : gap;
    rows[row] = y + h[row] / 2;
    y += h[row];
  });
  y += beforeButtons;
  const buttons = view.buttons.map((_, i) => y + b.height / 2 + i * b.step);
  const total = y + (view.buttons.length - 1) * b.step + b.height;

  const shift = -total / 2;
  for (const row of present) rows[row] = rows[row]! + shift;
  return { rows, buttons: buttons.map((v) => v + shift), top: shift, bottom: shift + total };
}
