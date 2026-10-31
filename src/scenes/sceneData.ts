// 씬 사이에 넘기는 데이터 (스토리 화면 설계 1절 표). 씬 키: Menu, StageMap, Game, Result, Pause.

import type { ModeResult } from '../modes/GameMode';

/** Game 씬 데이터. 없으면 timeattack */
export type GameData = { mode: 'timeattack' } | { mode: 'story'; stageId: number };

export interface ResultData {
  result: ModeResult;
}

/** Pause 씬 데이터: 다시하기에 쓰고, 스토리면 [지도] 경쟁이면 [메뉴]를 보인다 */
export interface PauseData {
  from: GameData;
}
