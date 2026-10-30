import { describe, expect, it } from 'vitest';
import { bootRoute, devUnlock } from '../../src/scenes/bootRoute';

describe('scenes/bootRoute (스토리 화면 설계 1절)', () => {
  it('기본은 메뉴', () => {
    expect(bootRoute('', true)).toEqual({ scene: 'Menu' });
    expect(bootRoute('', false)).toEqual({ scene: 'Menu' });
  });

  it('지금까지의 개발 주소는 타임어택 게임으로 바로 간다', () => {
    for (const q of ['?demo', '?seed=7', '?time=15', '?specials', '?demo&seed=7']) {
      expect(bootRoute(q, true)).toEqual({ scene: 'Game', data: { mode: 'timeattack' } });
    }
  });

  it('?demo, ?seed는 배포 빌드에서도 게임으로 (GameScene이 원래 읽던 옵션)', () => {
    expect(bootRoute('?seed=7', false)).toEqual({ scene: 'Game', data: { mode: 'timeattack' } });
  });

  it('DEV ?stage=N → 스토리 N번 게임. 배포 빌드에서는 무시', () => {
    expect(bootRoute('?stage=3', true)).toEqual({
      scene: 'Game',
      data: { mode: 'story', stageId: 3 },
    });
    expect(bootRoute('?stage=3', false)).toEqual({ scene: 'Menu' });
    expect(bootRoute('?stage=abc', true)).toEqual({ scene: 'Menu' });
    expect(bootRoute('?stage=0', true)).toEqual({ scene: 'Menu' });
  });

  it('DEV ?result → 결과 화면 미리보기. 배포 빌드에서는 무시', () => {
    expect(bootRoute('?result=12450&best=9000', true)).toEqual({
      scene: 'Result',
      data: { result: { kind: 'timeattack', score: 12450, bestScore: 9000, newBest: true } },
    });
    expect(bootRoute('?result=12450', false)).toEqual({ scene: 'Menu' });
  });
});

describe('scenes/bootRoute: devUnlock', () => {
  it('DEV ?unlock=N → N (1 이상 정수), 아니면 null', () => {
    expect(devUnlock('?unlock=5', true)).toBe(5);
    expect(devUnlock('?unlock=11', true)).toBe(11);
    expect(devUnlock('?unlock=0', true)).toBeNull();
    expect(devUnlock('?unlock=x', true)).toBeNull();
    expect(devUnlock('', true)).toBeNull();
    expect(devUnlock('?unlock=5', false)).toBeNull();
  });

  it('?unlock만 있으면 메뉴로 간다', () => {
    expect(bootRoute('?unlock=5', true)).toEqual({ scene: 'Menu' });
  });
});
