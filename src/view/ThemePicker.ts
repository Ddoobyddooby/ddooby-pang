// 테마 고르기 창 (SPEC 15절): 어두운 막 + 크림 판 위에 테마 카드 4개(이름 + 블록 3개 미리보기)와 닫기 버튼.
// 카드를 누르면 onPick(id), 막이나 닫기를 누르면 onClose. 위치는 화면 가운데 기준 (GAME.width 좌표계).
// 값이 여기 있는 건 2주차 동안 config.ts를 장애물 태스크만 고치기 때문이다.

import Phaser from 'phaser';
import { DECOR, GAME, THEME, UI } from '../config';
import type { Color } from '../core/types';
import { Sfx } from './Sfx';
import { PickerGate } from './themePickerGate';
import { addButton, type PressLock } from './ui/Button';
import { blockKey, ensureBlockTextures } from './theme/textures';
import { THEMES, type ThemeId } from './theme/themes';

const PICKER = {
  depth: 100,
  dim: { color: 0x3b2b3a, alpha: 0.55 },
  panel: { width: 640, alpha: 0.97, pad: 36 },
  title: { text: '테마 고르기', fontSize: 52, strokeThickness: 8, height: 90 },
  /** 카드 2×2. 아이가 누르기 쉽게 크게 */
  card: { width: 280, height: 270, gap: 28, radius: 28, border: 5, nameFontSize: 46 },
  selected: { fill: 0xfff3d6, stroke: 0xff6b9a, border: 8 },
  /** 카드 안 블록 미리보기: 0 빨강, 2 초록, 무지개 */
  preview: { colors: [0, 2, null] as readonly (Color | null)[], size: 76, gap: 84, dy: -52 },
  nameDy: 78,
  close: { width: 280, height: 96, fontSize: 44, text: '닫기', gap: 28 },
} as const;

/** 창을 연다. 닫을 때(고르든 닫든) 만든 것을 모두 지운다 */
export function openThemePicker(
  scene: Phaser.Scene,
  current: ThemeId,
  onPick: (id: ThemeId) => void,
  onClose: () => void,
): void {
  const { width, height } = scene.scale;
  const cx = GAME.width / 2;
  const cy = height / 2;
  const root = scene.add.container(0, 0).setDepth(PICKER.depth);
  const sfx = new Sfx(scene);
  // 먼저 일어난 고르기·닫기 하나만 받는다 (카드 누름 연출 중에 막을 눌러도 닫기와 고르기가 둘 다 실행되지 않게)
  const cards: Phaser.GameObjects.Container[] = [];
  const dispose = (): void => {
    scene.tweens.killTweensOf(cards);
    root.destroy();
  };
  const gate = new PickerGate(
    (id) => {
      dispose();
      if (id === current) onClose();
      else onPick(id);
    },
    () => {
      dispose();
      onClose();
    },
  );

  // 막: 누르면 닫힘. 뒤에 있는 버튼이 눌리지 않게 화면 전체를 덮는다
  const dim = scene.add
    .rectangle(cx, cy, width, height, PICKER.dim.color, PICKER.dim.alpha)
    .setInteractive();
  dim.on('pointerup', () => gate.close());
  root.add(dim);

  const { card, panel } = PICKER;
  const rows = Math.ceil(THEMES.length / 2);
  const gridH = rows * card.height + (rows - 1) * card.gap;
  const bodyH = PICKER.title.height + gridH + PICKER.close.gap + PICKER.close.height;
  const top = cy - (bodyH + panel.pad * 2) / 2;
  const { radius, border } = DECOR.frame;
  const panelBg = scene.add
    .graphics()
    .fillStyle(THEME.wafer.inner, panel.alpha)
    .fillRoundedRect(cx - panel.width / 2, top, panel.width, bodyH + panel.pad * 2, radius)
    .lineStyle(border, THEME.wafer.stroke, 1)
    .strokeRoundedRect(cx - panel.width / 2, top, panel.width, bodyH + panel.pad * 2, radius);
  // 판 위를 눌러도 막이 닫히지 않게
  const block = scene.add
    .rectangle(cx, top + (bodyH + panel.pad * 2) / 2, panel.width, bodyH + panel.pad * 2, 0, 0)
    .setInteractive();
  root.add([panelBg, block]);

  const bodyTop = top + panel.pad;
  root.add(
    scene.add
      .text(cx, bodyTop + PICKER.title.height / 2, PICKER.title.text, {
        fontFamily: THEME.font,
        fontSize: `${PICKER.title.fontSize}px`,
        color: THEME.title.fill,
        stroke: THEME.title.stroke,
        strokeThickness: PICKER.title.strokeThickness,
      })
      .setOrigin(0.5),
  );

  const lock: PressLock = { pressed: false };
  THEMES.forEach((theme, i) => {
    ensureBlockTextures(scene, theme.id); // 고르기 전 테마도 미리보기에 쓴다
    const x = cx + (i % 2 === 0 ? -1 : 1) * (card.width / 2 + card.gap / 2);
    const y =
      bodyTop +
      PICKER.title.height +
      Math.floor(i / 2) * (card.height + card.gap) +
      card.height / 2;
    const picked = theme.id === current;
    const bg = scene.add
      .graphics()
      .fillStyle(picked ? PICKER.selected.fill : 0xffffff, 1)
      .fillRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, card.radius)
      .lineStyle(
        picked ? PICKER.selected.border : card.border,
        picked ? PICKER.selected.stroke : THEME.wafer.stroke,
        1,
      )
      .strokeRoundedRect(-card.width / 2, -card.height / 2, card.width, card.height, card.radius);
    const p = PICKER.preview;
    const blocks = p.colors.map((color, k) =>
      scene.add
        .image((k - (p.colors.length - 1) / 2) * p.gap, p.dy, blockKey(color, 'normal', theme.id))
        .setDisplaySize(p.size, p.size),
    );
    const name = scene.add
      .text(0, PICKER.nameDy, theme.name, {
        fontFamily: THEME.font,
        fontSize: `${card.nameFontSize}px`,
        color: UI.button.textColor,
      })
      .setOrigin(0.5);
    const cardView = scene.add
      .container(x, y, [bg, ...blocks, name])
      .setSize(card.width, card.height)
      .setInteractive({ useHandCursor: true });
    cardView.on('pointerup', () => {
      if (lock.pressed || !gate.startPick(theme.id)) return;
      lock.pressed = true;
      sfx.play('button');
      scene.tweens.add({
        targets: cardView,
        scale: UI.button.pressScale,
        duration: UI.button.pressMs,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => gate.finishPick(),
      });
    });
    cards.push(cardView);
    root.add(cardView);
  });

  root.add(
    addButton(
      scene,
      cx,
      bodyTop + PICKER.title.height + gridH + PICKER.close.gap + PICKER.close.height / 2,
      {
        label: PICKER.close.text,
        width: PICKER.close.width,
        height: PICKER.close.height,
        fontSize: PICKER.close.fontSize,
      },
      () => gate.close(),
      lock,
    ),
  );
}
