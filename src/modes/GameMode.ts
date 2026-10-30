// 모드 규칙 (PLAN 5절). 씬이 매 프레임 tick, 스왑 전에 canInput, 재생이 끝난 뒤 isOver를 본다.
// core처럼 순수 TS다: Phaser, DOM, Math.random을 쓰지 않는다 (ESLint로 막는다).

import type { ResolveResult } from '../core/types';

export interface GameMode {
  readonly kind: 'story' | 'timeattack';
  /** 점수·미션·이동 갱신 */
  onResolve(result: ResolveResult): void;
  /** 타임어택 타이머 */
  tick(dtMs: number): void;
  /** 누적 점수 (HUD용) */
  score(): number;
  canInput(): boolean;
  isOver(): boolean;
  result(): ModeResult;
}

export type ModeResult =
  | { kind: 'timeattack'; score: number; bestScore: number; newBest: boolean }
  | {
      kind: 'story';
      stageId: number;
      cleared: boolean;
      /** 보너스 포함 최종 점수 */
      score: number;
      /** 남은 이동 보너스 (score에 이미 들어 있다. 결과 화면의 "남은 이동 보너스 +N"용) */
      bonus: number;
      stars: 0 | 1 | 2 | 3;
    };
