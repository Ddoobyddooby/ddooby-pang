// 화면 → 배경 음악 (PLAN 6.7, 테마별 게임 곡 PLAN 6.8). Phaser 없는 순수 함수.

import { MUSIC } from '../config';
import { DEFAULT_THEME, parseThemeId, type ThemeId } from '../data/themeIds';
import type { TrackName } from '../view/Music';
import type { GameData } from './sceneData';

export type MusicScene = 'Menu' | 'StageMap' | 'Ranking' | 'Game' | 'Result';

type GameMode = 'story' | 'timeattack';
export type GameTrackTable = Record<ThemeId, Partial<Record<GameMode, string>>>;

/** 테마 × 모드의 게임 곡. 그 테마에 곡이 없으면 기본 테마의 같은 모드 곡 (모르는 테마도 기본 테마) */
export function gameTrack(
  theme: ThemeId | string | undefined,
  mode: GameMode,
  table: GameTrackTable = MUSIC.gameTracks,
): TrackName {
  const own = table[parseThemeId(theme)][mode];
  return (own ?? table[DEFAULT_THEME][mode]) as TrackName;
}

/** 지금 테마의 게임 곡 이름들 (뒤에서 미리 읽을 때) */
export function gameTracksOf(theme: ThemeId | string | undefined): TrackName[] {
  return [...new Set([gameTrack(theme, 'story'), gameTrack(theme, 'timeattack')])];
}

/** 메뉴·지도·랭킹은 같은 곡(이어서), 게임은 테마 × 모드 곡, 결과 화면은 음악 없음 */
export function musicFor(
  scene: MusicScene,
  game?: GameData,
  theme?: ThemeId | string,
): TrackName | null {
  switch (scene) {
    case 'Menu':
    case 'StageMap':
    case 'Ranking':
      return 'menu';
    case 'Game':
      return gameTrack(theme, game?.mode === 'story' ? 'story' : 'timeattack');
    case 'Result':
      return null;
  }
}
