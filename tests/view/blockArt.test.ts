import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DECOR } from '../../src/config';
import type { Color } from '../../src/core/types';
import {
  blockArtIndex,
  blockArtKey,
  blockKey,
  ensureTextures,
  specialKey,
} from '../../src/view/theme/textures';

const COLORS: (Color | null)[] = [0, 1, 2, 3, 4, 5, null];
const FACES = ['normal', 'squint', 'happy'] as const;

/** 부른 메서드 이름과 drawImage 인자만 적어 두는 가짜 2D 컨텍스트 */
function fakeCtx(): { ctx: unknown; images: unknown[]; calls: string[] } {
  const images: unknown[] = [];
  const calls: string[] = [];
  const props: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(props, {
    get: (t, p) =>
      p in t
        ? t[p]
        : (...args: unknown[]) => {
            calls.push(String(p));
            if (p === 'drawImage') images.push(args[0]);
            return { addColorStop: () => undefined };
          },
    set: (t, p, v) => {
      t[p] = v;
      return true;
    },
  });
  return { ctx, images, calls };
}

/** 로드에 성공한 그림 번호만 텍스처로 갖고 있는 가짜 scene */
function fakeScene(loaded: number[]) {
  const art = new Map(loaded.map((i) => [blockArtKey(i), { art: i }]));
  const baked = new Map<string, ReturnType<typeof fakeCtx>>();
  const createCanvas = vi.fn((key: string) => {
    const c = fakeCtx();
    baked.set(key, c);
    return { getContext: () => c.ctx, refresh: () => undefined };
  });
  const scene = {
    textures: {
      exists: (key: string) => art.has(key) || baked.has(key),
      get: (key: string) => ({ getSourceImage: () => art.get(key) }),
      createCanvas,
    },
  };
  return { scene: scene as never, baked, createCanvas };
}

describe('view/theme/textures 몸통 그림', () => {
  it('색 0~5는 같은 번호, 무지개(null)는 6번', () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => blockArtIndex(c as Color))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(blockArtIndex(null)).toBe(6);
  });

  it('그림 경로·배치가 7개 (색 6 + 무지개), 배율이 칸을 크게 넘지 않는다', () => {
    expect(DECOR.blockArt).toHaveLength(7);
    DECOR.blockArt.forEach((p, i) => {
      expect(p.url).toBe(`blocks/block-${i}.png`);
      expect(p.scale).toBeGreaterThan(0.8);
      expect(p.scale).toBeLessThanOrEqual(1.15);
      expect(p.faceScale).toBeGreaterThan(0.5);
      expect(p.faceScale).toBeLessThanOrEqual(1);
      expect(Math.abs(p.faceDy)).toBeLessThanOrEqual(15);
    });
  });

  it('그림 키는 서로 다르고 구운 블록 키와 겹치지 않는다', () => {
    const artKeys = DECOR.blockArt.map((_, i) => blockArtKey(i));
    expect(new Set(artKeys).size).toBe(7);
    const baked = COLORS.flatMap((c) => FACES.map((f) => blockKey(c, f)));
    for (const k of artKeys) expect(baked).not.toContain(k);
  });
});

describe('ensureTextures 그림/도형 분기', () => {
  beforeEach(() => {
    // 노드에는 Path2D가 없다. 가짜 컨텍스트는 경로 내용을 보지 않으므로 빈 클래스면 된다
    vi.stubGlobal('Path2D', class {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** 색마다 세 표정 모두 그 색 그림을 한 번 그렸는지(true) 또는 그림 없이 도형으로 그렸는지(false) */
  function usedArt(baked: ReturnType<typeof fakeScene>['baked']): boolean[] {
    return COLORS.map((color) => {
      const per = FACES.map((f) => baked.get(blockKey(color, f))!);
      const art = per.map((c) => c.images);
      const index = blockArtIndex(color);
      if (art.every((imgs) => imgs.length === 1 && (imgs[0] as { art: number }).art === index))
        return true;
      if (art.every((imgs) => imgs.length === 0) && per.every((c) => c.calls.includes('fill')))
        return false;
      throw new Error(`색 ${color}: 그림·도형이 섞였다`);
    });
  }

  it('7장 모두 읽었으면 모든 색이 자기 그림으로 굽는다', () => {
    const { scene, baked } = fakeScene([0, 1, 2, 3, 4, 5, 6]);
    ensureTextures(scene);
    expect(usedArt(baked)).toEqual([true, true, true, true, true, true, true]);
  });

  it('block-3만 실패하면 파랑만 코드 도형', () => {
    const { scene, baked } = fakeScene([0, 1, 2, 4, 5, 6]);
    ensureTextures(scene);
    expect(usedArt(baked)).toEqual([true, true, true, false, true, true, true]);
  });

  it('전부 실패하면 모든 색이 코드 도형', () => {
    const { scene, baked } = fakeScene([]);
    ensureTextures(scene);
    expect(usedArt(baked)).toEqual([false, false, false, false, false, false, false]);
  });

  it('두 번 불러도 텍스처를 다시 만들지 않는다', () => {
    const { scene, baked, createCanvas } = fakeScene([0, 1, 2, 3, 4, 5, 6]);
    ensureTextures(scene);
    const first = createCanvas.mock.calls.length;
    // 블록 21 + 특수 4 + 파티클 2
    expect(first).toBe(7 * 3 + 4 + 2);
    expect(baked.has(specialKey('bomb'))).toBe(true);
    ensureTextures(scene);
    expect(createCanvas.mock.calls.length).toBe(first);
  });
});
