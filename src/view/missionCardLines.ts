// 스토리 시작 미션 카드 문구 (PLAN 6.10). Phaser 없는 순수 함수라 테스트할 수 있다.
// 색 이름은 쓰지 않는다: 수집 미션은 블록 그림(color)과 숫자만 (글자를 아직 못 읽어도 알게).

import type { Color } from '../core/types';
import type { Goal } from '../data/stageSchema';
import { formatScore } from './format';

/** 카드에 필요한 스테이지 값만 (StageDef의 일부) */
export interface MissionStageLike {
  id: number;
  moves: number;
  goals: readonly Goal[];
}

export interface MissionLine {
  /** 수집 미션이면 그 색 (블록 그림용), 점수 미션이면 null */
  color: Color | null;
  text: string;
}

export interface MissionCardLines {
  title: string;
  goals: MissionLine[];
  movesText: string;
}

export function missionLine(goal: Goal): MissionLine {
  if (goal.type === 'score')
    return { color: null, text: `점수 ${formatScore(goal.target)} 넘기기!` };
  return { color: goal.color, text: `${goal.count}개 모으기!` };
}

/** 제목 / 미션 줄(최대 maxLines, 스테이지 순서 그대로) / 이동 줄 */
export function missionCardLines(stage: MissionStageLike, maxLines: number): MissionCardLines {
  return {
    title: `스테이지 ${stage.id}`,
    goals: stage.goals.slice(0, maxLines).map(missionLine),
    movesText: `이동 ${stage.moves}번`,
  };
}
