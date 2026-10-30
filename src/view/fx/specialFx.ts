// 특수 블록 종류 → 발동 연출 구성. Phaser 없는 순수 함수.
import { FX } from '../../config';
import type { Pos, SpecialKind } from '../../core/types';

export interface SpecialFxPlan {
  /** 발동 칸을 지나는 빛줄기 */
  beams: ('row' | 'col')[];
  /** 퍼지는 원의 반지름 (칸 단위). 0이면 없음 */
  ring: number;
  shake: boolean;
  /** 별이 터지는 칸 (무지개만) */
  sparkles: Pos[];
}

export function specialFxPlan(special: SpecialKind, cleared: readonly Pos[]): SpecialFxPlan {
  const plan: SpecialFxPlan = { beams: [], ring: 0, shake: false, sparkles: [] };
  switch (special) {
    case 'lineH':
      plan.beams = ['row'];
      break;
    case 'lineV':
      plan.beams = ['col'];
      break;
    case 'bomb':
      plan.ring = 1.5; // 3x3을 덮는다
      break;
    case 'super':
      plan.beams = ['row', 'col'];
      plan.ring = 2.5; // 5x5를 덮는다
      plan.shake = true;
      break;
    case 'color':
      plan.ring = 1; // 시작 칸 섬광
      plan.sparkles = cleared.slice(0, FX.special.maxSparkles);
      break;
  }
  return plan;
}
