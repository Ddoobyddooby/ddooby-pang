// 오른쪽 위 동그란 스피커 버튼 (PLAN 6.5). 지도의 [←] 버튼(MAP.back)과 같은 모양·크기, 좌우 대칭 위치.
// 저장은 모른다: 누르면 onToggle(새 값)을 부르고, 씬이 저장값과 Sfx에 반영한다.

import Phaser from 'phaser';
import { GAME, MAP, THEME, UI } from '../../config';

export function addMuteButton(
  scene: Phaser.Scene,
  muted: boolean,
  onToggle: (muted: boolean) => void,
): Phaser.GameObjects.Container {
  const b = MAP.back;
  const g = scene.add.graphics();
  let current = muted;
  drawSpeaker(g, current);

  const button = scene.add
    .container(GAME.width - b.x, b.y, [g])
    .setSize(b.r * 2, b.r * 2)
    .setInteractive({ useHandCursor: true });
  button.on('pointerup', () => {
    if (scene.tweens.isTweening(button)) return;
    current = !current;
    drawSpeaker(g, current);
    onToggle(current);
    scene.tweens.add({
      targets: button,
      scale: UI.button.pressScale,
      duration: UI.button.pressMs,
      yoyo: true,
    });
  });
  return button;
}

/** 흰 동그라미 + 스피커. 소리가 나면 음파 두 줄, 음소거면 X */
function drawSpeaker(g: Phaser.GameObjects.Graphics, muted: boolean): void {
  const { r, arrow: icon } = MAP.back;
  g.clear()
    .fillStyle(0xffffff, 1)
    .fillCircle(0, 0, r)
    .lineStyle(5, THEME.wafer.stroke, 1)
    .strokeCircle(0, 0, r)
    // 스피커 몸통(사각) + 나팔(사다리꼴)
    .fillStyle(icon, 1)
    .fillRect(-16, -6, 8, 12)
    .fillTriangle(-8, -6, 4, -15, 4, 15)
    .fillTriangle(-8, -6, 4, 15, -8, 6)
    .lineStyle(4, icon, 1);
  if (muted) {
    g.beginPath().moveTo(9, -7).lineTo(21, 7).moveTo(21, -7).lineTo(9, 7).strokePath();
  } else {
    g.beginPath().arc(4, 0, 9, -0.9, 0.9).strokePath();
    g.beginPath().arc(4, 0, 17, -0.9, 0.9).strokePath();
  }
}
