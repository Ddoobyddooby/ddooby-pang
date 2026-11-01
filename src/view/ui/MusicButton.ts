// 동그란 ♪ 버튼 (PLAN 6.7): 배경 음악 켜고 끄기. 기본 자리는 스피커 버튼(효과음) 왼쪽 MUSIC.buttonGap (메뉴·지도).
// 저장은 모른다: 누르면 onToggle(새 값)을 부른다.

import type Phaser from 'phaser';
import { GAME, MAP, MUSIC } from '../../config';
import { addRoundButton, type DrawIcon } from './RoundButton';

export function addMusicButton(
  scene: Phaser.Scene,
  on: boolean,
  onToggle: (on: boolean) => void,
  y: number = MAP.back.y,
  x: number = GAME.width - MAP.back.x - MUSIC.buttonGap,
): Phaser.GameObjects.Container {
  let current = on;
  const button = addRoundButton(scene, x, y, note(current), () => {
    current = !current;
    button.redraw(note(current));
    onToggle(current);
  });
  return button.container;
}

/** 8분음표 둘을 이은 ♫. 꺼지면 사선 */
const note =
  (on: boolean): DrawIcon =>
  (g, color) => {
    g.fillStyle(color, 1)
      .fillEllipse(-9, 10, 13, 10)
      .fillEllipse(11, 6, 13, 10)
      .fillRect(-4, -14, 4, 24)
      .fillRect(16, -18, 4, 24)
      .fillTriangle(-4, -14, 20, -18, 20, -10)
      .fillTriangle(-4, -14, 20, -10, -4, -6);
    if (!on) {
      g.lineStyle(5, 0xffffff, 1).lineBetween(-20, -20, 20, 20);
      g.lineStyle(3, color, 1).lineBetween(-20, -20, 20, 20);
    }
  };
