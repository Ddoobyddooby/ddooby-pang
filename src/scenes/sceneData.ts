// 씬 사이에 넘기는 데이터 (스토리 화면 설계 1절 표). 씬 키: Menu, StageMap, Game, Result, Pause.

import type { ModeResult } from '../modes/GameMode';
import type { RankInfo } from './rankStatus';
import type { RunInfo } from './runClient';

/**
 * Game 씬 데이터. 없으면 timeattack.
 * 경쟁은 서버 run이 있으면 그 seed로 보드를 만들어 랭킹에 올리고, run 없이 시작했으면 로컬 판이다
 * (unranked = 서버를 쓸 수 있었는데 run을 못 받았다: 결과에 안내 줄)
 */
export type GameData =
  { mode: 'timeattack'; run?: RunInfo; unranked?: boolean } | { mode: 'story'; stageId: number };

export interface ResultData {
  result: ModeResult;
  /** 경쟁의 랭킹 등록 상태. 없으면 줄 없음 */
  rank?: RankInfo;
}

/** Pause 씬 데이터: 다시하기에 쓰고, 스토리면 [지도] 경쟁이면 [메뉴]를 보인다 */
export interface PauseData {
  from: GameData;
}
