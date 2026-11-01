import { describe, expect, it } from 'vitest';
import { GAME, MAP } from '../../src/config';
import {
  clampScroll,
  contentY,
  isDrag,
  mapFocus,
  mapNodes,
  maxScroll,
  nodeStates,
  scrollToCenter,
} from '../../src/view/mapLayout';

describe('view/mapLayout: mapNodes (스토리 화면 설계 3절)', () => {
  // 1280 = 기준 화면, 1558 = 390x844 휴대폰에서 EXPAND로 늘어난 높이
  it.each([1280, 1558])('height %i: 10개가 화면 안, 아래 → 위, 서로 겹치지 않는다', (height) => {
    const { nodes, worldHeight } = mapNodes(10, height);
    expect(nodes).toHaveLength(10);
    expect(worldHeight).toBe(height); // 스크롤 없음

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
    expect(mapNodes(1, 1280)).toEqual({
      nodes: [{ x: MAP.xs[0], y: 1280 - MAP.bottomPad }],
      worldHeight: 1280,
    });
  });

  it.each([
    [20, 1280],
    [20, 1558],
    [30, 1280],
  ])('%i개 (height %i): 화면을 넘으면 MAP.gap 고정 간격으로 길어진다', (count, height) => {
    const { nodes, worldHeight } = mapNodes(count, height);
    expect(worldHeight).toBe(MAP.top + (count - 1) * MAP.gap + MAP.bottomPad);
    expect(worldHeight).toBeGreaterThan(height);
    expect(nodes[0]!.y).toBe(worldHeight - MAP.bottomPad); // 1번이 맨 아래
    expect(nodes[count - 1]!.y).toBe(MAP.top); // 마지막이 맨 위
    for (let i = 1; i < count; i++) expect(nodes[i - 1]!.y - nodes[i]!.y).toBe(MAP.gap);
  });

  it('간격은 개수와 무관하다 (20개와 30개의 아래쪽 노드가 같은 간격)', () => {
    const a = mapNodes(20, 1280).nodes;
    const b = mapNodes(30, 1280).nodes;
    expect(a[0]!.y - a[1]!.y).toBe(b[0]!.y - b[1]!.y);
  });

  it('20개: 서로 겹치지 않는다 (11번부터 x가 반복돼도)', () => {
    const { nodes } = mapNodes(20, 1280);
    const r = MAP.node.r * MAP.node.breatheScale;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.hypot(nodes[i]!.x - nodes[j]!.x, nodes[i]!.y - nodes[j]!.y);
        expect(d, `${i + 1}번과 ${j + 1}번`).toBeGreaterThan(2 * r);
      }
    }
  });
});

describe('view/mapLayout: 스크롤', () => {
  const world = 2000;
  const screen = 1280;

  it('maxScroll: 화면보다 짧으면 0', () => {
    expect(maxScroll(1280, 1280)).toBe(0);
    expect(maxScroll(world, screen)).toBe(720);
  });

  it.each([
    [-50, 0],
    [0, 0],
    [300, 300],
    [720, 720],
    [900, 720],
  ])('clampScroll %i → %i (끝에서 막는다)', (value, expected) => {
    expect(clampScroll(value, world, screen)).toBe(expected);
  });

  it('스크롤 없는 지도는 늘 0', () => {
    expect(clampScroll(100, 1280, 1280)).toBe(0);
  });

  it('contentY: 0이면 세계 맨 아래가 화면 맨 아래, 최대면 세계 맨 위가 화면 맨 위', () => {
    expect(contentY(0, world, screen) + world).toBe(screen);
    expect(contentY(maxScroll(world, screen), world, screen)).toBe(0);
  });

  it('scrollToCenter: 그 노드가 화면 가운데에 온다. 끝 근처면 끝에서 멈춘다', () => {
    const s = scrollToCenter(1000, world, screen);
    expect(1000 + contentY(s, world, screen)).toBe(screen / 2);
    expect(scrollToCenter(world - 100, world, screen)).toBe(0); // 1번 근처 → 맨 아래
    expect(scrollToCenter(50, world, screen)).toBe(720); // 맨 위 근처 → 맨 위
  });

  it.each([
    [0, 0, false],
    [8, 8, false],
    [0, 12, false],
    [0, 13, true],
    [-10, -10, true],
  ])('isDrag(%i, %i) → %s (문턱 12)', (dx, dy, expected) => {
    expect(isDrag(dx, dy, 12)).toBe(expected);
  });
});

describe('view/mapLayout: mapFocus', () => {
  it('처음 들어오면 지금 할 곳', () => {
    expect(mapFocus(15, undefined, 20)).toEqual({ from: 14, to: 14, fresh: false });
  });

  it('방금 열렸으면 직전에 할 곳에서 새로 열린 곳으로', () => {
    expect(mapFocus(16, 15, 20)).toEqual({ from: 14, to: 15, fresh: true });
  });

  it('다시 봐도 그대로면 옮기지 않는다', () => {
    expect(mapFocus(16, 16, 20)).toEqual({ from: 15, to: 15, fresh: false });
  });

  it('다 깼으면(unlocked = 개수 + 1) 마지막 노드, 튀어나옴 없음', () => {
    expect(mapFocus(21, 20, 20)).toEqual({ from: 19, to: 19, fresh: false });
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
