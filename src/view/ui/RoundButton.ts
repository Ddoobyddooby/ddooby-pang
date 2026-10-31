// 공통 동그란 아이콘 버튼: 흰 원 + 웨이퍼 테두리 + 아이콘(Graphics). 지도 [←]와 같은 모양·크기(MAP.back).
// 누르면 말랑하게 눌렸다 돌아온 뒤 onPress. 눌리는 중에는 다시 받지 않는다.

import Phaser from 'phaser';
import { MAP, THEME, UI } from '../../config';

/** 원 안에 아이콘을 그린다 (원점 = 버튼 가운데, 색 = MAP.back.arrow) */
export type DrawIcon = (g: Phaser.GameObjects.Graphics, color: number) => void;

export interface RoundButton {
  container: Phaser.GameObjects.Container;
  /** 아이콘을 바꿔 그린다 (음소거 켬/끔 등) */
  redraw(icon: DrawIcon): void;
}

export function addRoundButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: DrawIcon,
  onPress: () => void,
): RoundButton {
  const { r, arrow } = MAP.back;
  const g = scene.add.graphics();
  const redraw = (draw: DrawIcon) => {
    g.clear()
      .fillStyle(0xffffff, 1)
      .fillCircle(0, 0, r)
      .lineStyle(5, THEME.wafer.stroke, 1)
      .strokeCircle(0, 0, r);
    draw(g, arrow);
  };
  redraw(icon);

  const container = scene.add
    .container(x, y, [g])
    .setSize(r * 2, r * 2)
    .setInteractive({ useHandCursor: true });
  container.on('pointerup', () => {
    if (scene.tweens.isTweening(container)) return;
    scene.tweens.add({
      targets: container,
      scale: UI.button.pressScale,
      duration: UI.button.pressMs,
      yoyo: true,
      onComplete: onPress,
    });
  });
  return { container, redraw };
}

/** ❚❚ 두 막대 */
export const drawPauseIcon: DrawIcon = (g, color) => {
  g.fillStyle(color, 1).fillRoundedRect(-13, -14, 9, 28, 3).fillRoundedRect(4, -14, 9, 28, 3);
};
