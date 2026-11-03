import { describe, expect, it } from 'vitest';
import { DECOR, HUD, VIEW } from '../../src/config';
import { screenLayout } from '../../src/view/layout';

// 패널 안쪽 크림 바탕은 테두리(DECOR.frame.pad)를 뺀 사각형이다. 글자 상자가 그 안에 들어가야 한다
const { pad } = DECOR.frame;
const h = VIEW.screen.panelH;
const p = HUD.panel;
const LINE = 1.3; // 글자 상자 높이 ≈ 글자 크기 x 1.3 (Jua)

describe('정보 패널 내용이 안쪽 바탕 안에 든다', () => {
  const inner = { top: pad, bottom: h - pad };

  it('경쟁 패널: 점수 라벨·점수·남은 시간·막대', () => {
    expect(p.label.y).toBeGreaterThanOrEqual(inner.top);
    expect(p.score.y + p.score.fontSize * LINE).toBeLessThanOrEqual(p.time.y);
    expect(p.bar.y + p.bar.height).toBeLessThanOrEqual(inner.bottom);
  });

  it('DEV seed 글자(오른쪽 아래 끝 기준)', () => {
    expect(p.seed.inset).toBeGreaterThanOrEqual(pad);
  });

  it('스토리 패널: 가장 위·아래 줄과 이동 배지', () => {
    const s = HUD.story;
    const half = ((s.maxGoalLines + 1 - 1) / 2) * s.lineGap + (s.goalFontSize * LINE) / 2;
    expect(s.centerY - half).toBeGreaterThanOrEqual(inner.top);
    expect(s.centerY + half).toBeLessThanOrEqual(inner.bottom);
    const r = s.badge.radius + s.badge.border / 2;
    expect(h / 2 - r).toBeGreaterThanOrEqual(inner.top);
    expect(h / 2 + r).toBeLessThanOrEqual(inner.bottom);
  });

  it('패널 가로: 왼쪽 여백이 테두리보다 크고 폭은 보드 판과 같다', () => {
    expect(p.padX).toBeGreaterThanOrEqual(pad);
    const l = screenLayout(1280);
    expect(l.panel.w).toBe(VIEW.screen.boardSize + pad * 2);
  });
});
