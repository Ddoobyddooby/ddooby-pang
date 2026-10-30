// 스토리 (PLAN 5절): 정해진 이동 안에 스테이지 미션을 모두 달성하면 클리어.
// 판정은 onResolve 뒤에만 한다. 한 턴의 연쇄는 core가 끝까지 계산해서 오므로 마지막 이동에서 달성해도 클리어.

import type { ResolveResult } from '../core/types';
import type { Goal, StageDef } from '../data/stageSchema';
import type { GameMode, ModeResult } from './GameMode';

export interface GoalProgress {
  goal: Goal;
  /** 목표를 넘어도 그대로 센다 */
  current: number;
  done: boolean;
}

export class StoryMode implements GameMode {
  readonly kind = 'story';
  private moves: number;
  private total = 0;
  /** 색별 제거 수 (특수 효과로 제거된 블록 포함) */
  private readonly collected = [0, 0, 0, 0, 0, 0];
  private state: 'playing' | 'cleared' | 'failed' = 'playing';

  constructor(private readonly stage: StageDef) {
    this.moves = stage.moves;
  }

  onResolve(result: ResolveResult): void {
    // 무효 스왑은 이동을 깎지 않는다. 끝난 뒤에는 입력이 막히므로 들어와도 무시한다
    if (!result.valid || this.isOver()) return;
    this.moves--;
    this.total += result.scoreDelta;
    result.removedByColor.forEach((n, color) => (this.collected[color]! += n));

    if (this.goalProgress().every((g) => g.done)) this.state = 'cleared';
    else if (this.moves === 0) this.state = 'failed';
  }

  /** 스토리는 시간 제한이 없다 (dtMs를 받지 않아도 GameMode.tick을 만족한다) */
  tick(): void {}

  score(): number {
    return this.total;
  }

  movesLeft(): number {
    return this.moves;
  }

  goalProgress(): GoalProgress[] {
    return this.stage.goals.map((goal) => {
      const current = goal.type === 'score' ? this.total : this.collected[goal.color]!;
      const target = goal.type === 'score' ? goal.target : goal.count;
      return { goal, current, done: current >= target };
    });
  }

  canInput(): boolean {
    return !this.isOver();
  }

  isOver(): boolean {
    return this.state !== 'playing';
  }

  result(): ModeResult {
    return {
      kind: 'story',
      stageId: this.stage.id,
      cleared: this.state === 'cleared',
      score: this.total,
      stars: 0, // W3-06: 남은 이동 보너스 + 별 계산
    };
  }
}
