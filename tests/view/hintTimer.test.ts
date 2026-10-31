import { describe, expect, it } from 'vitest';
import { HintTimer } from '../../src/view/hintTimer';

describe('HintTimer', () => {
  it('입력할 수 있는 상태로 idleMs가 지나야 보인다', () => {
    const t = new HintTimer(5000);
    expect(t.tick(4999, true)).toBe(false);
    expect(t.tick(1, true)).toBe(true);
    expect(t.shouldShow).toBe(true);
  });

  it('reset(터치·선택)하면 처음부터 다시 잰다', () => {
    const t = new HintTimer(5000);
    t.tick(6000, true);
    t.reset();
    expect(t.shouldShow).toBe(false);
    expect(t.tick(4000, true)).toBe(false);
    expect(t.tick(1000, true)).toBe(true);
  });

  it('ready가 아니면(재생 중·게임 끝·자동 플레이) 잰 시간을 버리고, 다시 ready가 된 때부터 잰다', () => {
    const t = new HintTimer(5000);
    t.tick(4000, true);
    expect(t.tick(16, false)).toBe(false);
    expect(t.tick(4000, true)).toBe(false);
    expect(t.tick(1000, true)).toBe(true);
  });

  it('보이는 중에 ready가 아니게 되면 바로 꺼진다', () => {
    const t = new HintTimer(1000);
    expect(t.tick(1200, true)).toBe(true);
    expect(t.tick(16, false)).toBe(false);
  });

  it('ready가 아닌 동안에는 아무리 오래 지나도 보이지 않는다', () => {
    const t = new HintTimer(1000);
    expect(t.tick(60_000, false)).toBe(false);
  });
});
