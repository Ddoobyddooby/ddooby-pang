// 연쇄 단계 → 연출 세기. Phaser 없는 순수 함수.
import { FX, THEME } from '../../config';

export interface FxLevel {
  level: number;
  particlesPerBlock: number;
  stars: boolean;
  praise: string | null;
  praiseScale: number;
  praiseColor: string | null;
  shake: { duration: number; intensity: number } | null;
  happy: boolean;
}

type PraiseKey = keyof typeof FX.praise;
type ShakeKey = keyof typeof FX.shake;

const clampLevel = (level: number): number => Math.min(FX.maxLevel, Math.max(1, level));

/** core match 이벤트의 cascade(0부터) → 연쇄 단계(1~maxLevel) */
export function cascadeToLevel(cascade: number): number {
  return clampLevel(cascade + 1);
}

export function fxLevel(level: number): FxLevel {
  const lv = clampLevel(level);
  const praiseKey = lv as PraiseKey;
  const hasPraise = praiseKey in FX.praise;
  return {
    level: lv,
    particlesPerBlock: FX.particlesPerBlock[lv - 1] ?? 1,
    stars: lv >= FX.starsFromLevel,
    praise: hasPraise ? FX.praise[praiseKey] : null,
    praiseScale: hasPraise ? FX.praiseScale[praiseKey] : 1,
    praiseColor: hasPraise ? THEME.praiseColors[praiseKey] : null,
    shake: (lv as ShakeKey) in FX.shake ? FX.shake[lv as ShakeKey] : null,
    happy: lv >= FX.happyFromLevel,
  };
}

/** 한 번의 제거에서 뿌릴 파티클 수. 긴 연쇄에서도 maxParticles를 넘지 않는다 */
export function particleCount(level: number, removedBlocks: number): number {
  return Math.min(fxLevel(level).particlesPerBlock * removedBlocks, FX.maxParticles);
}
