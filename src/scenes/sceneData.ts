// 씬 사이에 넘기는 데이터 (스토리 화면 설계 1절 표). 씬 키: Menu, StageMap, Game, Result.

import type { ModeResult } from '../modes/GameMode';

/** Game 씬 데이터. 없으면 timeattack */
export type GameData = { mode: 'timeattack' } | { mode: 'story'; stageId: number };

export interface ResultData {
  result: ModeResult;
}
