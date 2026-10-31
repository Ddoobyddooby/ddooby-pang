// 무입력 힌트 타이머 (W4-03). Phaser 없는 순수 상태 기계.
// 입력할 수 있는 상태(ready)로 idleMs가 이어지면 shouldShow. ready가 아니거나 reset되면 처음부터 다시 잰다.

export class HintTimer {
  private idle = 0;

  constructor(private readonly idleMs: number) {}

  /** 터치·선택 등 입력이 있으면 부른다 */
  reset(): void {
    this.idle = 0;
  }

  /** 매 프레임. ready가 아니면(재생 중·게임 끝·자동 플레이) 잰 시간을 버린다 */
  tick(dtMs: number, ready: boolean): boolean {
    this.idle = ready ? this.idle + dtMs : 0;
    return this.shouldShow;
  }

  get shouldShow(): boolean {
    return this.idle >= this.idleMs;
  }
}
