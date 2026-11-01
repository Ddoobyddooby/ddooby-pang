// 게임 화면 위 제목 (PLAN 6.11). 미션 카드 첫 줄(missionCardLines)도 같은 문구를 쓴다. Phaser 없는 순수 함수.

import { MENU } from '../config';

/** GameData와 같은 모양 (view가 scenes에 의존하지 않게 여기 적는다) */
export type TitleMode = { mode: 'timeattack' } | { mode: 'story'; stageId: number };

/** 스토리 `스테이지 N`, 경쟁은 메뉴 버튼과 같은 말 (`경쟁 60초`) */
export function gameTitle(from: TitleMode): string {
  return from.mode === 'story' ? `스테이지 ${from.stageId}` : MENU.timeattack.text;
}
