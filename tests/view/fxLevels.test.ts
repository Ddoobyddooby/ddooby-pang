import { describe, expect, it } from 'vitest';
import { FX } from '../../src/config';
import { cascadeToLevel, fxLevel, particleCount } from '../../src/view/fx/fxLevels';

describe('view/fx/fxLevels', () => {
  it('cascadeToLevel: 0→1, 1→2, 4→5, 상한 5', () => {
    expect(cascadeToLevel(0)).toBe(1);
    expect(cascadeToLevel(1)).toBe(2);
    expect(cascadeToLevel(4)).toBe(5);
    expect(cascadeToLevel(9)).toBe(5);
  });

  it('1단계 → 연출 없음', () => {
    const l = fxLevel(1);
    expect(l.praise).toBeNull();
    expect(l.shake).toBeNull();
    expect(l.happy).toBe(false);
    expect(l.stars).toBe(false);
  });

  it('2단계 → 이안팡! + 별, 흔들림 없음', () => {
    const l = fxLevel(2);
    expect(l.praise).toBe('이안팡!');
    expect(l.stars).toBe(true);
    expect(l.shake).toBeNull();
  });

  it('3단계 → 이서팡! + 흔들림 + 웃음', () => {
    const l = fxLevel(3);
    expect(l.praise).toBe('이서팡!');
    expect(l.shake).not.toBeNull();
    expect(l.happy).toBe(true);
  });

  it('4, 5단계 칭찬 문구', () => {
    expect(fxLevel(4).praise).toBe('보라팡!!');
    expect(fxLevel(5).praise).toBe('사랑해!!!');
  });

  it('범위 밖 단계는 1~maxLevel로 맞춘다', () => {
    expect(fxLevel(7)).toEqual(fxLevel(5));
    expect(fxLevel(7).level).toBe(5);
    expect(fxLevel(0)).toEqual(fxLevel(1));
  });

  it('particleCount: 단계가 올라도 줄지 않고 상한이 있다', () => {
    for (const removed of [1, 3, 10, 30]) {
      for (let lv = 1; lv < FX.maxLevel; lv++) {
        expect(particleCount(lv + 1, removed)).toBeGreaterThanOrEqual(particleCount(lv, removed));
      }
    }
    expect(particleCount(5, 100)).toBe(FX.maxParticles);
    expect(particleCount(1, 3)).toBe(3);
  });

  it('FX.praise에 2~5 키가 모두 있고 비어 있지 않다', () => {
    for (const k of [2, 3, 4, 5] as const) {
      expect(FX.praise[k].length).toBeGreaterThan(0);
    }
  });
});
