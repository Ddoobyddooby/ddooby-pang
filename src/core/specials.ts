// 매치 그룹 → 특수 블록 결정 (PLAN 4.5)

import { SPECIAL } from '../config';
import type { MatchGroup, SpecialKind } from './types';

/** 그룹이 만드는 특수 블록. 없으면 undefined. 우선순위는 PLAN 4.5 테이블 위에서부터 */
export function decideSpecial(
  group: MatchGroup,
  lineDirection = SPECIAL.lineDirection,
): SpecialKind | undefined {
  const size = group.cells.length;
  if (size >= 6) return 'super';
  if (group.maxRunH >= 5 || group.maxRunV >= 5) return 'color';
  if (size === 5 && group.hasIntersection) return 'bomb';
  const perpendicular = lineDirection === 'perpendicular';
  if (group.maxRunH === 4) return perpendicular ? 'lineV' : 'lineH';
  if (group.maxRunV === 4) return perpendicular ? 'lineH' : 'lineV';
  return undefined;
}
