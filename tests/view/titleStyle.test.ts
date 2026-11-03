import { describe, expect, it } from 'vitest';
import { DECOR, HUD } from '../../src/config';
import { titleStyle } from '../../src/view/titleStyle';

describe('titleStyle', () => {
  it('리본이 있으면 명판에 맞춘 작은 글자', () => {
    expect(titleStyle(true)).toEqual({
      fontSize: DECOR.ribbon.fontSize,
      strokeThickness: DECOR.ribbon.stroke,
    });
    expect(DECOR.ribbon.fontSize).toBeLessThan(HUD.title.fontSize);
  });

  it('리본을 못 읽었으면 예전 제목 크기', () => {
    expect(titleStyle(false)).toEqual({
      fontSize: HUD.title.fontSize,
      strokeThickness: HUD.title.strokeThickness,
    });
  });
});
