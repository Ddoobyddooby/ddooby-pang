// 경쟁 모드 스왑 기록 (V2-W3-03, PLAN2 5.8 "클라이언트 기록"). Phaser 없는 순수 코드.
// GameScene.trySwap이 실제로 처리한 스왑(유효·무효)마다 한 줄 남긴다. 막힌 입력은 부르지 않는다.

import type { Pos } from '../core/types';

export interface MoveLogEntry {
  from: Pos;
  to: Pos;
  /** 스왑을 시작한 게임 시간(ms, 정수). 일시정지 시간은 빠진다 */
  t: number;
}

/** 제한 시간 − 남은 시간. 정수 ms, 0 이상 제한 시간 미만 */
export function moveTime(timeLimitMs: number, timeLeftMs: number): number {
  const t = Math.floor(timeLimitMs - timeLeftMs);
  return Math.min(Math.max(t, 0), Math.max(Math.floor(timeLimitMs) - 1, 0));
}

export class MoveLog {
  private readonly list: MoveLogEntry[] = [];

  record(from: Pos, to: Pos, timeLimitMs: number, timeLeftMs: number): void {
    this.list.push({
      from: { r: from.r, c: from.c },
      to: { r: to.r, c: to.c },
      t: moveTime(timeLimitMs, timeLeftMs),
    });
  }

  /** 지금까지의 기록 (복사본) */
  entries(): MoveLogEntry[] {
    return this.list.map((m) => ({ from: { ...m.from }, to: { ...m.to }, t: m.t }));
  }
}
