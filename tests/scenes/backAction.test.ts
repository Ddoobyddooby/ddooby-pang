import { describe, expect, it } from 'vitest';
import { backAction } from '../../src/scenes/backAction';

describe('backAction', () => {
  it('게임 중 → 일시정지', () => {
    expect(backAction(['Game'])).toBe('pause');
  });

  it('일시정지 창(Game은 멈춰서 빠짐) → 계속', () => {
    expect(backAction(['Pause'])).toBe('resume');
    expect(backAction(['Game', 'Pause'])).toBe('resume');
  });

  it('지도 → 메뉴', () => {
    expect(backAction(['StageMap'])).toEqual({ go: 'Menu' });
  });

  it('결과: 스토리는 지도, 경쟁은 메뉴', () => {
    expect(backAction(['Result'], { resultKind: 'story' })).toEqual({ go: 'StageMap' });
    expect(backAction(['Result'], { resultKind: 'timeattack' })).toEqual({ go: 'Menu' });
  });

  it('메뉴 → 앱 종료', () => {
    expect(backAction(['Menu'])).toBe('exit');
  });

  it('불러오는 중(Boot)이나 빈 목록 → 아무것도 안 함', () => {
    expect(backAction(['Boot'])).toBe('none');
    expect(backAction([])).toBe('none');
  });
});
