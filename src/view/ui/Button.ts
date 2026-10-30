// 공통 웨이퍼 버튼 (스토리 화면 설계 2절): 둥근 웨이퍼 판 + 큰 글자(+ 작은 진행 문구).
// 누르면 말랑하게 눌렸다가 돌아온 뒤 onPress. 같은 화면의 버튼끼리 PressLock을 나눠 쓰면 하나만 눌린다.

import Phaser from 'phaser';
import { DECOR, THEME, UI } from '../../config';

export interface ButtonSpec {
  label: string;
  width: number;
  height: number;
  fontSize: number;
  /** 버튼 안 작은 글씨 (진행 상황 등) */
  sub?: string;
  subFontSize?: number;
}

/** 한 화면에서 버튼이 한 번만 눌리게 한다 (화면을 떠나는 중에 다른 버튼이 또 눌리지 않게) */
export interface PressLock {
  pressed: boolean;
}

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  spec: ButtonSpec,
  onPress: () => void,
  lock: PressLock = { pressed: false },
): Phaser.GameObjects.Container {
  const { width: w, height: h } = spec;
  const r = h / 2;
  const bg = scene.add
    .graphics()
    .fillStyle(THEME.wafer.fill, 1)
    .fillRoundedRect(-w / 2, -r, w, h, r)
    .lineStyle(DECOR.frame.border, THEME.wafer.stroke, 1)
    .strokeRoundedRect(-w / 2, -r, w, h, r);
  const font = { fontFamily: THEME.font };
  const label = scene.add
    .text(0, 0, spec.label, { ...font, fontSize: `${spec.fontSize}px`, color: UI.button.textColor })
    .setOrigin(0.5);
  const children: Phaser.GameObjects.GameObject[] = [bg, label];

  if (spec.sub) {
    const sub = scene.add
      .text(0, 0, spec.sub, {
        ...font,
        fontSize: `${spec.subFontSize ?? Math.round(spec.fontSize / 2)}px`,
        color: UI.button.subColor,
      })
      .setOrigin(0.5);
    // 두 줄을 합쳐 가운데에 둔다
    const total = label.height + UI.button.subGap + sub.height;
    label.setY(-total / 2 + label.height / 2);
    sub.setY(total / 2 - sub.height / 2);
    children.push(sub);
  }

  const button = scene.add
    .container(x, y, children)
    .setSize(w, h)
    .setInteractive({ useHandCursor: true });

  button.on('pointerup', () => {
    if (lock.pressed) return;
    lock.pressed = true;
    scene.tweens.add({
      targets: button,
      scale: UI.button.pressScale,
      duration: UI.button.pressMs,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: onPress,
    });
  });
  return button;
}
