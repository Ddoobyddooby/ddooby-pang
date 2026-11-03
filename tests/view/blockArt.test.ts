import { describe, expect, it } from 'vitest';
import { DECOR } from '../../src/config';
import { ART_PLACE, blockArtIndex, blockArtKey, blockKey } from '../../src/view/theme/textures';

describe('view/theme/textures 몸통 그림', () => {
  it('색 0~5는 같은 번호, 무지개(null)는 6번', () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => blockArtIndex(c as 0))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(blockArtIndex(null)).toBe(6);
  });

  it('그림 경로와 배치 표가 7개씩 (색 6 + 무지개)', () => {
    expect(DECOR.blockArt).toHaveLength(7);
    expect(ART_PLACE).toHaveLength(7);
    DECOR.blockArt.forEach((url, i) => expect(url).toBe(`blocks/block-${i}.png`));
  });

  it('그림 키는 서로 다르고 구운 블록 키와 겹치지 않는다', () => {
    const artKeys = DECOR.blockArt.map((_, i) => blockArtKey(i));
    expect(new Set(artKeys).size).toBe(7);
    const baked = [0, 1, 2, 3, 4, 5, null].flatMap((c) =>
      (['normal', 'squint', 'happy'] as const).map((f) => blockKey(c as 0 | null, f)),
    );
    for (const k of artKeys) expect(baked).not.toContain(k);
  });

  it('몸통이 텍스처 밖으로 크게 넘치지 않고 얼굴이 몸통 안에 있다', () => {
    for (const p of ART_PLACE) {
      expect(p.scale).toBeGreaterThan(0.8);
      expect(p.scale).toBeLessThanOrEqual(1.15);
      expect(p.faceScale).toBeGreaterThan(0.5);
      expect(p.faceScale).toBeLessThanOrEqual(1);
      expect(Math.abs(p.faceDy)).toBeLessThanOrEqual(15);
    }
  });
});
