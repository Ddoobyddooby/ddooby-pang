// 스토리 HUD 문구 계산. Phaser 없는 순수 함수라 테스트할 수 있다 (설계 5절).

import type { Color } from '../core/types';
import type { Goal } from '../data/stageSchema';
import { formatScore } from './format';

/** StoryMode.goalProgress()의 한 칸 (view가 modes에 의존하지 않게 필요한 모양만 적는다) */
export interface GoalProgressLike {
  goal: Goal;
  current: number;
  done: boolean;
}

export interface GoalLine {
  /** 수집 미션이면 그 색 (블록 그림용), 점수 미션이면 null */
  color: Color | null;
  text: string;
  done: boolean;
}

/** 목표를 넘어도 목표까지만 보여 준다 (30 / 25 대신 25 / 25) */
export function goalLine({ goal, current, done }: GoalProgressLike): GoalLine {
  if (goal.type === 'score') {
    const shown = formatScore(Math.min(current, goal.target));
    return { color: null, text: `점수 ${shown} / ${formatScore(goal.target)}`, done };
  }
  return { color: goal.color, text: `${Math.min(current, goal.count)} / ${goal.count}`, done };
}

/** 미션 줄(최대 maxLines). 점수 미션이 없으면 마지막에 `점수 N` 줄을 따로 둔다 */
export function storyLines(
  progress: readonly GoalProgressLike[],
  score: number,
  maxLines: number,
): { goals: GoalLine[]; scoreText: string | null } {
  const goals = progress.slice(0, maxLines).map(goalLine);
  const hasScoreGoal = progress.some((p) => p.goal.type === 'score');
  return { goals, scoreText: hasScoreGoal ? null : `점수 ${formatScore(score)}` };
}

/** 남은 이동이 경고 기준 이하인가 (0도 포함) */
export function isMovesLow(movesLeft: number, warnAt: number): boolean {
  return movesLeft <= warnAt;
}
