import { describe, expect, it } from 'vitest';
import { FX } from '../../src/config';
import type { Pos } from '../../src/core/types';
import { specialFxPlan } from '../../src/view/fx/specialFx';

const row = (r: number, cols = 8): Pos[] => Array.from({ length: cols }, (_, c) => ({ r, c }));

describe('specialFxPlan', () => {
  it('lineH: 행 빛줄기만', () => {
    expect(specialFxPlan('lineH', row(3))).toEqual({
      beams: ['row'],
      ring: 0,
      shake: false,
      sparkles: [],
    });
  });

  it('lineV: 열 빛줄기만', () => {
    expect(specialFxPlan('lineV', row(3)).beams).toEqual(['col']);
  });

  it('bomb: 3x3을 덮는 원', () => {
    const plan = specialFxPlan('bomb', row(3));
    expect(plan.beams).toEqual([]);
    expect(plan.ring).toBe(1.5);
  });

  it('super: 십자 빛줄기 + 5x5 원 + 흔들림', () => {
    expect(specialFxPlan('super', row(3))).toMatchObject({
      beams: ['row', 'col'],
      ring: 2.5,
      shake: true,
    });
  });

  it('color: 시작 칸 섬광 + 지워지는 칸마다 반짝임, 상한 FX.special.maxSparkles', () => {
    const few = row(0, 5);
    expect(specialFxPlan('color', few)).toMatchObject({ ring: 1, sparkles: few });
    const many = Array.from({ length: 64 }, (_, i) => ({ r: Math.floor(i / 8), c: i % 8 }));
    expect(specialFxPlan('color', many).sparkles).toHaveLength(FX.special.maxSparkles);
  });
});
