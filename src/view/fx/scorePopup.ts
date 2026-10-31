// 점수 팝업 글자·색·크기와 가로 위치. Phaser 없는 순수 함수.
import { FX, THEME } from '../../config';
import { formatScore } from '../format';

export interface ScorePopupStyle {
  text: string;
  color: string;
  scale: number;
}

type PraiseColorKey = keyof typeof THEME.praiseColors;

/** 단계 1은 제목 분홍, 2 이상은 칭찬 문구와 같은 색. 단계가 오를수록 커지고 마지막 배율에서 멈춘다 */
export function scorePopupStyle(delta: number, level: number): ScorePopupStyle {
  const scales = FX.scorePopup.scaleByLevel;
  const lv = Math.max(1, Math.round(level));
  const key = Math.min(lv, FX.maxLevel) as PraiseColorKey;
  return {
    text: `+${formatScore(delta)}`,
    color: key in THEME.praiseColors ? THEME.praiseColors[key] : THEME.title.fill,
    scale: scales[Math.min(lv, scales.length) - 1] ?? 1,
  };
}

/** 글자(가운데 정렬, 반폭 halfWidth)가 [min, max] 밖으로 나가지 않는 x. 글자가 구간보다 넓으면 가운데 */
export function clampCenterX(x: number, halfWidth: number, min: number, max: number): number {
  if (halfWidth * 2 >= max - min) return (min + max) / 2;
  return Math.min(max - halfWidth, Math.max(min + halfWidth, x));
}
