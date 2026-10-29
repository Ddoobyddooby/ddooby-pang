// match 이벤트에서 연출에 필요한 정보(제거되는 칸과 색)만 뽑는다. Phaser 없는 순수 함수.
import type { Color, MatchGroup, Pos } from '../../core/types';

export interface RemovedCell {
  at: Pos;
  color: Color | null;
}

/** 그룹 순서, 그룹 안의 칸 순서를 그대로 펼친다 */
export function removedFromMatch(groups: readonly MatchGroup[]): RemovedCell[] {
  return groups.flatMap((group) => group.cells.map((at) => ({ at, color: group.color })));
}
