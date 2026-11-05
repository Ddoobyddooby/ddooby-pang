// 스토리 (PLAN 5절): 정해진 이동 안에 스테이지 미션을 모두 달성하면 클리어.
// 판정은 onResolve 뒤에만 한다. 한 턴의 연쇄는 core가 끝까지 계산해서 오므로 마지막 이동에서 달성해도 클리어.

import type { ObstacleKind, ResolveResult } from '../core/types';
import type { Goal, StageDef } from '../data/stageSchema';
import type { GameMode, ModeResult } from './GameMode';
import { movesLeftBonus, starsFor } from './storyScore';

export interface GoalProgress {
  goal: Goal;
  /** 목표를 넘어도 그대로 센다 */
  current: number;
  /** 달성 기준 (clearJelly는 처음 젤리 칸 수) */
  target: number;
  done: boolean;
}

export class StoryMode implements GameMode {
  readonly kind = 'story';
  private moves: number;
  private total = 0;
  /** 색별 제거 수 (특수 효과로 제거된 블록 포함) */
  private readonly collected = [0, 0, 0, 0, 0, 0];
  /** 완전히 없앤 장애물 수 누적 (ResolveResult.clearedObstacles, PLAN2 5.3) */
  private readonly cleared: Record<ObstacleKind, number> = { lock: 0, frost: 0, jelly: 0 };
  /** 처음 젤리 칸 수 (clearJelly 목표). 젤리는 새로 생기지 않는다 */
  private readonly jellyCells: number;
  private state: 'playing' | 'cleared' | 'failed' = 'playing';

  constructor(private readonly stage: StageDef) {
    this.moves = stage.moves;
    this.jellyCells = stage.layers?.filter((l) => l?.jelly !== undefined).length ?? 0;
  }

  onResolve(result: ResolveResult): void {
    // 무효 스왑은 이동을 깎지 않는다. 끝난 뒤에는 입력이 막히므로 들어와도 무시한다
    if (!result.valid || this.isOver()) return;
    this.moves--;
    this.total += result.scoreDelta;
    result.removedByColor.forEach((n, color) => (this.collected[color]! += n));
    for (const kind of Object.keys(this.cleared) as ObstacleKind[])
      this.cleared[kind] += result.clearedObstacles[kind];

    if (this.goalProgress().every((g) => g.done)) this.state = 'cleared';
    else if (this.moves === 0) this.state = 'failed';
  }

  /** 스토리는 시간 제한이 없다 (dtMs를 받지 않아도 GameMode.tick을 만족한다) */
  tick(): void {}

  /** 누적 점수. 클리어하면 남은 이동 보너스가 더해진다 */
  score(): number {
    return this.total + this.bonus();
  }

  /** 클리어했을 때만 남은 이동 × movesLeftBonus. 진행 중·실패는 0 */
  bonus(): number {
    return this.state === 'cleared' ? movesLeftBonus(this.moves) : 0;
  }

  movesLeft(): number {
    return this.moves;
  }

  goalProgress(): GoalProgress[] {
    return this.stage.goals.map((goal) => {
      const [current, target] = this.goalCount(goal);
      return { goal, current, target, done: current >= target };
    });
  }

  /**
   * [지금, 목표]. clearJelly: 지운 젤리 칸 / 처음 젤리 칸 (다 지우면 보드의 젤리 0).
   * clearObstacle: 그 장애물을 완전히 없앤 수 누적 (잠금 해제, 얼음벽 0겹, 젤리 0겹. PLAN2 5.4)
   */
  private goalCount(goal: Goal): [current: number, target: number] {
    switch (goal.type) {
      case 'score':
        return [this.total, goal.target];
      case 'collect':
        return [this.collected[goal.color]!, goal.count];
      case 'clearJelly':
        return [this.cleared.jelly, this.jellyCells];
      case 'clearObstacle':
        return [this.cleared[goal.obstacle], goal.count];
    }
  }

  canInput(): boolean {
    return !this.isOver();
  }

  isOver(): boolean {
    return this.state !== 'playing';
  }

  result(): ModeResult {
    const cleared = this.state === 'cleared';
    const score = this.score();
    return {
      kind: 'story',
      stageId: this.stage.id,
      cleared,
      score,
      bonus: this.bonus(),
      stars: starsFor(score, this.stage.stars, cleared),
    };
  }
}
