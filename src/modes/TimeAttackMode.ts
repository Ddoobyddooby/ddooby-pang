// 타임어택 (PLAN 5절): 제한 시간 안에 점수를 최대한 모은다.
// 시간은 애니메이션 중에도 흐르고, 0이 되면 입력만 막는다. 진행 중이던 연쇄 점수는 그 뒤에 들어와도 더한다.

import { TIMEATTACK } from '../config';
import type { ResolveResult } from '../core/types';
import type { GameMode, ModeResult } from './GameMode';

export class TimeAttackMode implements GameMode {
  readonly kind = 'timeattack';
  private readonly bestScore: number;
  private timeLeft: number;
  private total = 0;

  /** bestScore: 이전 최고 점수 (저장은 W3-07). 기본 0 */
  constructor(options: { bestScore?: number; timeLimitMs?: number } = {}) {
    this.bestScore = options.bestScore ?? 0;
    this.timeLeft = options.timeLimitMs ?? TIMEATTACK.timeLimitMs;
  }

  onResolve(result: ResolveResult): void {
    this.total += result.scoreDelta;
  }

  /** 0 이하이거나 유한수가 아닌 dtMs는 무시한다. 남은 시간은 0 아래로 내려가지 않는다 */
  tick(dtMs: number): void {
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    this.timeLeft = Math.max(0, this.timeLeft - dtMs);
  }

  timeLeftMs(): number {
    return this.timeLeft;
  }

  score(): number {
    return this.total;
  }

  canInput(): boolean {
    return this.timeLeft > 0;
  }

  isOver(): boolean {
    return this.timeLeft === 0;
  }

  result(): ModeResult {
    return {
      kind: 'timeattack',
      score: this.total,
      bestScore: this.bestScore,
      newBest: this.total > this.bestScore,
    };
  }
}
