// 동그란 스피커 버튼 (PLAN 6.5). 공통 동그란 버튼(RoundButton)에 스피커 아이콘을 그린다.
// 기본 자리는 오른쪽 위, 지도의 [←](MAP.back)와 좌우 대칭. 저장은 모른다: 누르면 onToggle(새 값)을 부른다.

import type Phaser from 'phaser';
import { GAME, MAP } from '../../config';
import { addRoundButton, type DrawIcon } from './RoundButton';

export function addMuteButton(
  scene: Phaser.Scene,
  muted: boolean,
  onToggle: (muted: boolean) => void,
  y: number = MAP.back.y,
): Phaser.GameObjects.Container {
  let current = muted;
  const button = addRoundButton(scene, GAME.width - MAP.back.x, y, speaker(current), () => {
    current = !current;
    button.redraw(speaker(current));
    onToggle(current);
  });
  return button.container;
}

/** 스피커. 소리가 나면 음파 두 줄, 음소거면 X */
const speaker =
  (muted: boolean): DrawIcon =>
  (g, color) => {
    // 몸통(사각) + 나팔(사다리꼴)
    g.fillStyle(color, 1)
      .fillRect(-16, -6, 8, 12)
      .fillTriangle(-8, -6, 4, -15, 4, 15)
      .fillTriangle(-8, -6, 4, 15, -8, 6)
      .lineStyle(4, color, 1);
    if (muted) {
      g.beginPath().moveTo(9, -7).lineTo(21, 7).moveTo(21, -7).lineTo(9, 7).strokePath();
    } else {
      g.beginPath().arc(4, 0, 9, -0.9, 0.9).strokePath();
      g.beginPath().arc(4, 0, 17, -0.9, 0.9).strokePath();
    }
  };
