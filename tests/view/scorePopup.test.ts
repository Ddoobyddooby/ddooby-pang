import { describe, expect, it } from 'vitest';
import { FX, THEME } from '../../src/config';
import { clampCenterX, scorePopupStyle } from '../../src/view/fx/scorePopup';

describe('scorePopupStyle', () => {
  it('글자는 +와 천 단위 쉼표', () => {
    expect(scorePopupStyle(210, 1).text).toBe('+210');
    expect(scorePopupStyle(1350, 3).text).toBe('+1,350');
  });

  it('단계 1은 제목 분홍, 2 이상은 칭찬 문구 색', () => {
    expect(scorePopupStyle(30, 1).color).toBe(THEME.title.fill);
    expect(scorePopupStyle(45, 2).color).toBe(THEME.praiseColors[2]);
    expect(scorePopupStyle(60, 3).color).toBe(THEME.praiseColors[3]);
    expect(scorePopupStyle(90, 5).color).toBe(THEME.praiseColors[5]);
  });

  it('단계가 오를수록 커지고, 상한에서 멈춘다', () => {
    const scales = [1, 2, 3, 4, 5].map((lv) => scorePopupStyle(30, lv).scale);
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1]!);
    expect(scorePopupStyle(30, 9).scale).toBe(scales[4]);
    expect(scorePopupStyle(30, 9).color).toBe(THEME.praiseColors[5]);
  });

  it('가장 큰 팝업도 칭찬 문구 기본 크기보다 작다', () => {
    const biggest = FX.scorePopup.fontSize * scorePopupStyle(30, FX.maxLevel).scale;
    expect(biggest).toBeLessThan(FX.praiseStyle.fontSize);
  });
});

describe('clampCenterX', () => {
  it('안쪽이면 그대로', () => {
    expect(clampCenterX(300, 50, 0, 720)).toBe(300);
  });

  it('왼쪽·오른쪽 가장자리에서는 글자가 구간 안에 들어오게 민다', () => {
    expect(clampCenterX(20, 50, 0, 720)).toBe(50);
    expect(clampCenterX(710, 50, 0, 720)).toBe(670);
  });

  it('글자가 구간보다 넓으면 가운데', () => {
    expect(clampCenterX(20, 400, 0, 720)).toBe(360);
  });
});
