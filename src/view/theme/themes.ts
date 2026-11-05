// 테마 목록과 지금 쓰는 테마 (SPEC 15절, PLAN2 4.3). 테마 하나 = 블록 몸통 그림 7장 + 배경 1장.
// 그림 경로·배치 값이라 config.ts가 아니라 여기에 둔다 (2주차 config.ts는 장애물 태스크만 고친다).
// 테마는 보기만 바꾼다. core 규칙·점수·seed 재현과 무관하다.

import { DECOR } from '../../config';
import { DEFAULT_THEME, isThemeId, type ThemeId } from '../../data/themeIds';

export { DEFAULT_THEME, isThemeId, parseThemeId, type ThemeId } from '../../data/themeIds';

/** 몸통 그림 한 장: 경로, 시안 좌표 100칸 대비 크기 배율, 얼굴을 내리는 정도와 줄이는 배율 (DECOR.blockArt와 같은 뜻) */
export interface BlockArt {
  url: string;
  scale: number;
  faceDy: number;
  faceScale: number;
}

export interface Theme {
  id: ThemeId;
  /** 메뉴 테마 카드에 보이는 이름 */
  name: string;
  /** 순서 = 색 0~5, 마지막이 무지개(컬러 블록). textures.ts의 blockArtIndex와 같다 */
  blocks: readonly BlockArt[];
  /** 배경 그림. band = 원본에서 장식이 없는 가운데 띠의 y 범위 (늘려도 티가 안 나는 곳) */
  background: { url: string; band: { top: number; bottom: number } };
}

/** 새 테마의 파일은 빨·주·노·초·파·보·무지개 순(block-0~6). 게임의 색 번호(빨·노·초·파·보·주)에 맞춰 늘어놓는다 */
const byColor = (dir: string, art: Omit<BlockArt, 'url'>[]): BlockArt[] =>
  [0, 2, 3, 4, 5, 1, 6].map((file, color) => ({
    url: `themes/${dir}/block-${file}.png`,
    ...art[color]!,
  }));

/** 그림이 비슷한 모양이라 일단 같은 배치. 눈으로 보고 테마마다 맞춘다 */
const same = (scale: number, faceDy: number, faceScale: number): Omit<BlockArt, 'url'>[] =>
  Array.from({ length: 7 }, () => ({ scale, faceDy, faceScale }));

export const THEMES: readonly Theme[] = [
  { id: 'storybook', name: '그림책', blocks: DECOR.blockArt, background: DECOR.storybook },
  {
    id: 'candy',
    name: '사탕',
    blocks: byColor('candy', same(1, 0, 0.85)),
    background: { url: 'themes/candy/bg.jpg', band: { top: 300, bottom: 1090 } },
  },
  {
    id: 'space',
    name: '우주',
    blocks: byColor('space', same(1, 0, 0.85)),
    background: { url: 'themes/space/bg.jpg', band: { top: 260, bottom: 1230 } },
  },
  {
    id: 'ocean',
    name: '바다',
    blocks: byColor('ocean', same(1, 7, 0.8)),
    background: { url: 'themes/ocean/bg.jpg', band: { top: 300, bottom: 1040 } },
  },
];

/**
 * 장애물 색 (PLAN2 5.5). 판 바탕은 모든 테마가 같은 크림이라 대부분 공통이고,
 * 젤리만 그 테마 블록 색과 겹치지 않게 테마마다 다르다. 그림 자체는 obstacleArt.ts
 */
export const OBSTACLE_COLORS: Record<ThemeId, { jelly: string; jellyEdge: string }> = {
  storybook: { jelly: '#ff6fb5', jellyEdge: '#c93c86' },
  candy: { jelly: '#5fe0c4', jellyEdge: '#1f9e86' },
  space: { jelly: '#ff6fb5', jellyEdge: '#b02f78' },
  ocean: { jelly: '#ff8a5c', jellyEdge: '#c4502a' },
};

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

let active: ThemeId = DEFAULT_THEME;

/** 지금 화면들이 쓰는 테마. BootScene이 저장값(또는 ?theme)으로 정하고, 메뉴에서 고르면 바뀐다 */
export function getActiveThemeId(): ThemeId {
  return active;
}

export function setActiveTheme(id: ThemeId): void {
  active = id;
}

/** 개발 주소 ?theme=<id>: 저장하지 않고 그 판만 적용. 없거나 모르는 값이면 null */
export function devTheme(search: string, dev: boolean): ThemeId | null {
  if (!dev) return null;
  const value = new URLSearchParams(search).get('theme');
  return isThemeId(value) ? value : null;
}

export function backgroundKey(id: ThemeId): string {
  return `bg-${id}`;
}
