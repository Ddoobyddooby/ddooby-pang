// 게임 화면 제목 글자 크기: 리본 명판 위에서는 줄이고, 리본 그림이 없으면 예전 크기. Phaser 없는 순수 함수.

import { DECOR, HUD } from '../config';

export function titleStyle(hasRibbon: boolean): { fontSize: number; strokeThickness: number } {
  return hasRibbon
    ? { fontSize: DECOR.ribbon.fontSize, strokeThickness: DECOR.ribbon.stroke }
    : { fontSize: HUD.title.fontSize, strokeThickness: HUD.title.strokeThickness };
}
