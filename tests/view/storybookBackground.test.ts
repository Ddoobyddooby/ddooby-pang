import { describe, expect, it } from 'vitest';
import { storybookSlices } from '../../src/view/theme/StorybookBackground';

const img = { w: 1000, h: 1400 };
const band = { top: 500, bottom: 800 };

describe('storybookSlices', () => {
  it('긴 화면: 폭에 맞추고 띠만 늘려 위 조각이 화면 맨 위에 닿는다', () => {
    const s = storybookSlices(500, 1000, img, band);
    expect(s.scale).toBe(0.5);
    expect(s.topY).toBe(0);
    expect(s.bandY).toBe(250);
    expect(s.bottomY).toBe(1000 - 300); // 아래 조각 600px * 0.5
    expect(s.bandH).toBe(450); // 원래 150보다 늘어남
  });

  it('짧은 화면: 띠를 줄이지 않고 바닥에 붙여 위쪽이 화면 밖으로 잘린다', () => {
    const s = storybookSlices(500, 500, img, band);
    expect(s.bandH).toBe(150);
    expect(s.bottomY).toBe(200);
    expect(s.topY).toBe(200 - 150 - 250);
  });
});
