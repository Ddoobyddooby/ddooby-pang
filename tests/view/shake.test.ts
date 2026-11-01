import { describe, expect, it } from 'vitest';
import { pickShake, type ShakeState } from '../../src/view/fx/shake';

const weak = { duration: 120, intensity: 0.004 };
const strong = { duration: 200, intensity: 0.008 };

describe('pickShake', () => {
  it.each<
    [string, ShakeState | null, { duration: number; intensity: number }, number, ShakeState | null]
  >([
    ['흔들림 없음 → 새 것', null, weak, 1000, { intensity: 0.004, endAt: 1120 }],
    [
      '약한 것 중 센 것 → 센 것(force)',
      { intensity: 0.004, endAt: 1120 },
      strong,
      1050,
      { intensity: 0.008, endAt: 1250 },
    ],
    ['센 것 중 약한 것 → 무시', { intensity: 0.008, endAt: 1200 }, weak, 1050, null],
    ['같은 세기 중 → 무시', { intensity: 0.004, endAt: 1120 }, weak, 1050, null],
    [
      '센 것이 끝난 뒤 약한 것 → 새 것',
      { intensity: 0.008, endAt: 1200 },
      weak,
      1200,
      { intensity: 0.004, endAt: 1320 },
    ],
    [
      '끝난 지 오래 → 새 것',
      { intensity: 0.01, endAt: 500 },
      weak,
      5000,
      { intensity: 0.004, endAt: 5120 },
    ],
  ])('%s', (_name, current, next, now, expected) => {
    expect(pickShake(current, next, now)).toEqual(expected);
  });
});
