// 스토리 시작 미션 카드 문구 (PLAN 6.10). Phaser 없는 순수 함수라 테스트할 수 있다.
// 색 이름은 쓰지 않는다: 수집 미션은 블록 그림(color)과 숫자만 (글자를 아직 못 읽어도 알게).

import type { Color } from '../core/types';
import type { Goal, ObstacleKind } from '../data/stageSchema';
import { OBSTACLE_NAMES } from './storyLines';
import { formatScore } from './format';
import { gameTitle } from './gameTitle';

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
  if (goal.type === 'collect') return { color: goal.color, text: `${goal.count}개 모으기!` };
  // 장애물 미션 아이콘·그림은 V2-W2-05
  if (goal.type === 'clearJelly') return { color: null, text: '젤리 모두 없애기!' };
  const name = OBSTACLE_NAMES[goal.obstacle];
  return { color: null, text: `${name} ${goal.count}${OBSTACLE_GOAL_VERBS[goal.obstacle]}` };
}

/** clearObstacle 카드 문구의 단위·동사: 자물쇠 3개 풀기! / 얼음 4개 깨기! / 젤리 6칸 지우기! */
const OBSTACLE_GOAL_VERBS: Record<ObstacleKind, string> = {
  lock: '개 풀기!',
  frost: '개 깨기!',
  jelly: '칸 지우기!',
};

/** 제목(게임 화면 제목과 같은 문구) / 미션 줄(최대 maxLines, 스테이지 순서 그대로) / 이동 줄 */
export function missionCardLines(stage: MissionStageLike, maxLines: number): MissionCardLines {
  return {
    title: gameTitle({ mode: 'story', stageId: stage.id }),
    goals: stage.goals.slice(0, maxLines).map(missionLine),
    movesText: `이동 ${stage.moves}번`,
  };
}
