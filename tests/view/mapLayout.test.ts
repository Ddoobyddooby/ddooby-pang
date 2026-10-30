import { describe, expect, it } from 'vitest';
import { GAME, MAP } from '../../src/config';
import { mapNodes, nodeStates } from '../../src/view/mapLayout';

describe('view/mapLayout: mapNodes (스토리 화면 설계 3절)', () => {
  // 1280 = 기준 화면, 1558 = 390x844 휴대폰에서 EXPAND로 늘어난 높이
  it.each([1280, 1558])('height %i: 10개가 화면 안, 아래 → 위, 서로 겹치지 않는다', (height) => {
    const nodes = mapNodes(10, height);
    expect(nodes).toHaveLength(10);

    // 숨쉬기까지 커진 반지름 기준으로 본다
    const r = MAP.node.r * MAP.node.breatheScale;
    for (const { x, y } of nodes) {
      expect(x - r).toBeGreaterThanOrEqual(0);
      expect(x + r).toBeLessThanOrEqual(GAME.width);
      expect(y).toBeGreaterThanOrEqual(MAP.top);
      expect(y).toBeLessThanOrEqual(height - MAP.bottomPad);
    }
    // 1번이 맨 아래, 번호가 커질수록 위로
    for (let i = 1; i < nodes.length; i++) expect(nodes[i]!.y).toBeLessThan(nodes[i - 1]!.y);
    expect(nodes[0]!.y).toBe(height - MAP.bottomPad);
    expect(nodes[9]!.y).toBe(MAP.top);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
        expect(d, `${i + 1}번과 ${j + 1}번`).toBeGreaterThan(2 * r);
      }
    }
  });

  it('1개면 맨 아래 하나', () => {
    expect(mapNodes(1, 1280)).toEqual([{ x: MAP.xs[0], y: 1280 - MAP.bottomPad }]);
  });
});

describe('view/mapLayout: nodeStates', () => {
  it('열린 것 중 가장 높은 번호가 지금 할 곳, 그 아래는 완료, 위는 잠김', () => {
    expect(nodeStates(3, 10)).toEqual([
      'done',
      'done',
      'current',
      ...Array<string>(7).fill('locked'),
    ]);
  });

  it('처음(unlocked 1): 1번이 지금 할 곳', () => {
    expect(nodeStates(1, 10)[0]).toBe('current');
    expect(
      nodeStates(1, 10)
        .slice(1)
        .every((s) => s === 'locked'),
    ).toBe(true);
  });

  it('10번까지 클리어(unlocked 11): 전부 완료', () => {
    expect(nodeStates(11, 10).every((s) => s === 'done')).toBe(true);
  });
});
