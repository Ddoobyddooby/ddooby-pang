import { describe, expect, it } from 'vitest';
import { bumpCount, scallopOutline } from '../../src/view/theme/scallop';

const opt = { depth: 6, bump: 40, corner: 20, inset: 2 };

describe('bumpCount', () => {
  it('길이를 혹 폭으로 나눠 반올림하고 최소 1', () => {
    expect(bumpCount(400, 40)).toBe(10);
    expect(bumpCount(418, 40)).toBe(10);
    expect(bumpCount(5, 40)).toBe(1);
  });
});

describe('scallopOutline', () => {
  const cmds = scallopOutline(300, 200, opt);
  const pts = cmds.flatMap((c) =>
    c.op === 'M'
      ? [c]
      : [
          { x: c.x, y: c.y },
          { x: c.cx, y: c.cy },
        ],
  );

  it('시작점은 위쪽 변 왼쪽 모서리 끝이고 끝점으로 되돌아온다', () => {
    expect(cmds[0]).toEqual({ op: 'M', x: 28, y: 8 });
    expect(cmds.at(-1)).toMatchObject({ op: 'Q', x: 28, y: 8 });
  });

  it('위 변 혹 개수 = 직선 길이 / bump', () => {
    // 직선 길이 300 - 2*(8+20) = 244 → 6개, 아래 변도 같다
    const topRuns = cmds.filter((c) => c.op === 'Q' && c.y === 8 && c.cy < 8);
    expect(topRuns).toHaveLength(6);
  });

  it('혹 꼭대기(기준선과 제어점의 중간)가 inset에 닿고 캔버스 안에 머문다', () => {
    const minY = Math.min(...pts.map((p) => p.y));
    expect(minY).toBe(8 - 2 * 6); // 제어점 = 기준선 - 2*depth
    expect((8 + minY) / 2).toBe(opt.inset);
    expect(Math.max(...pts.map((p) => p.y))).toBe(200 - 8 + 2 * 6);
  });
});
