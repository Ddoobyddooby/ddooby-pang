// 테마 ID와 읽기 규칙 (SPEC 15절). 그림·배치(view/theme/themes.ts)와 저장(storage/progress.ts)이 같이 쓰는 순수 데이터라 따로 뒀다.

export const THEME_IDS = ['storybook', 'candy', 'space', 'ocean'] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** 그림책 테마: v0.1부터 쓰던 기본 */
export const DEFAULT_THEME: ThemeId = 'storybook';

export function isThemeId(value: unknown): value is ThemeId {
  return THEME_IDS.some((id) => id === value);
}

/** 없거나 모르는 값(옛 저장, 빠진 테마)은 기본 테마 */
export function parseThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : DEFAULT_THEME;
}
