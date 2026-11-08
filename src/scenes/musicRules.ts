// 화면 → 배경 음악 (PLAN 6.7). Phaser 없는 순수 함수.

import type { TrackName } from '../view/Music';
import type { GameData } from './sceneData';

export type MusicScene = 'Menu' | 'StageMap' | 'Ranking' | 'Game' | 'Result';

/** 메뉴·지도·랭킹은 같은 곡(이어서), 게임은 모드 곡, 결과 화면은 음악 없음 */
export function musicFor(scene: MusicScene, game?: GameData): TrackName | null {
  switch (scene) {
    case 'Menu':
    case 'StageMap':
    case 'Ranking':
      return 'menu';
    case 'Game':
      return game?.mode === 'story' ? 'story' : 'timeattack';
    case 'Result':
      return null;
  }
}
