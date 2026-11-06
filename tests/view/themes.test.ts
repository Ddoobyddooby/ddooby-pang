import { describe, expect, it } from 'vitest';
import { DECOR } from '../../src/config';
import { THEME_IDS } from '../../src/data/themeIds';
import {
  DEFAULT_THEME,
  THEMES,
  backgroundKey,
  devTheme,
  getActiveThemeId,
  getTheme,
  parseThemeId,
  setActiveTheme,
} from '../../src/view/theme/themes';

describe('view/theme/themes 목록', () => {
  it('테마 4개: 그림책(기본)·사탕·우주·바다, ID는 THEME_IDS와 같은 순서', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['storybook', 'candy', 'space', 'ocean']);
    expect(THEMES.map((t) => t.id)).toEqual([...THEME_IDS]);
    expect(THEMES.map((t) => t.name)).toEqual(['그림책', '사탕', '우주', '바다']);
    expect(DEFAULT_THEME).toBe('storybook');
  });

  it('그림책 테마는 지금 DECOR의 블록 그림·배경을 그대로 가리킨다', () => {
    const storybook = getTheme('storybook');
    expect(storybook.blocks).toBe(DECOR.blockArt);
    expect(storybook.background).toBe(DECOR.storybook);
  });

  it('테마마다 블록 7장(색 6 + 무지개)과 배경, 배치 값이 상식 범위', () => {
    for (const t of THEMES) {
      expect(t.blocks).toHaveLength(7);
      t.blocks.forEach((b) => {
        expect(b.url).toMatch(/\.png$/);
        expect(b.scale).toBeGreaterThan(0.8);
        expect(b.scale).toBeLessThanOrEqual(1.15);
        expect(b.faceScale).toBeGreaterThan(0.5);
        expect(b.faceScale).toBeLessThanOrEqual(1);
        expect(Math.abs(b.faceDy)).toBeLessThanOrEqual(15);
      });
      expect(t.background.band.top).toBeLessThan(t.background.band.bottom);
      expect(new Set(t.blocks.map((b) => b.url)).size).toBe(7);
    }
  });

  it('새 테마는 파일 순서(빨·주·노·초·파·보·무지개)를 게임 색 번호(빨·노·초·파·보·주)로 옮긴다', () => {
    const files = getTheme('candy').blocks.map((b) => Number(/block-(\d)\.png$/.exec(b.url)![1]));
    expect(files).toEqual([0, 2, 3, 4, 5, 1, 6]);
  });

  it.each(['space', 'ocean'] as const)(
    '%s: 색마다 다른 모양 그림(block-0~5)이 게임 색 번호 순서로 놓이고 배치 값이 상식 범위',
    (id) => {
      const { blocks } = getTheme(id);
      // 게임 색 빨·노·초·파·보·주 ↔ 파일 0·2·3·4·5·1, 마지막은 무지개(6)
      expect(blocks.map((b) => b.url)).toEqual(
        [0, 2, 3, 4, 5, 1, 6].map((n) => `themes/${id}/block-${n}.png`),
      );
      blocks.forEach((b) => {
        for (const v of [b.scale, b.faceScale]) expect(Number.isFinite(v) && v > 0).toBe(true);
        expect(Number.isFinite(b.faceDy)).toBe(true);
        expect(Number.isFinite(b.faceDx ?? 0)).toBe(true);
        expect(Math.abs(b.faceDx ?? 0)).toBeLessThanOrEqual(15);
      });
      // 색마다 배치를 따로 맞췄다 (7장 공통 배치가 아니다)
      expect(
        new Set(blocks.slice(0, 6).map((b) => `${b.faceDx ?? 0}/${b.faceDy}/${b.faceScale}`)).size,
      ).toBeGreaterThan(3);
    },
  );

  it('모든 테마 그림 경로가 서로 다르다 (읽을 때 키가 겹치지 않게)', () => {
    const urls = THEMES.flatMap((t) => [t.background.url, ...t.blocks.map((b) => b.url)]);
    expect(new Set(urls).size).toBe(urls.length);
    expect(new Set(THEMES.map((t) => backgroundKey(t.id))).size).toBe(THEMES.length);
  });
});

describe('테마 고르기 규칙', () => {
  it('모르는 값·없는 값은 기본 테마', () => {
    expect(parseThemeId(undefined)).toBe('storybook');
    expect(parseThemeId('princess')).toBe('storybook');
    expect(parseThemeId(3)).toBe('storybook');
    expect(parseThemeId('ocean')).toBe('ocean');
  });

  it('지금 테마는 setActiveTheme으로 바뀐다', () => {
    expect(getActiveThemeId()).toBe('storybook');
    setActiveTheme('space');
    expect(getActiveThemeId()).toBe('space');
    setActiveTheme('storybook');
  });

  it('?theme=<id>는 DEV에서 알려진 ID만', () => {
    expect(devTheme('?theme=candy', true)).toBe('candy');
    expect(devTheme('?theme=candy', false)).toBeNull();
    expect(devTheme('?theme=princess', true)).toBeNull();
    expect(devTheme('', true)).toBeNull();
  });
});
