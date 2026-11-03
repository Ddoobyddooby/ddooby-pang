// 게임 화면 그림책 배경 (A안). 구름·별·언덕이 그림에 들어 있어 Background·addHills 대신 쓴다.
// 화면 폭에 맞춰 줄여 바닥에 붙이고, 화면이 그림보다 길면 장식 없는 가운데 띠만 늘린다.
// 화면이 그림보다 짧으면(넓은 화면) 띠를 늘리지 않고 위쪽이 잘린다.

import type Phaser from 'phaser';
import { DECOR, GAME } from '../../config';

export const STORYBOOK_KEY = 'bg-storybook';
const DEPTH = -100;

export interface StorybookSlices {
  scale: number;
  /** 화면 y (위 조각 윗변, 띠 윗변, 아래 조각 윗변)와 띠의 화면 높이 */
  topY: number;
  bandY: number;
  bandH: number;
  bottomY: number;
}

/** 원본 크기와 띠(band) 범위로 세 조각의 화면 배치를 정한다. Phaser 없는 순수 함수 */
export function storybookSlices(
  screenW: number,
  screenH: number,
  img: { w: number; h: number },
  band: { top: number; bottom: number },
): StorybookSlices {
  const scale = screenW / img.w;
  const topH = band.top * scale;
  const bottomH = (img.h - band.bottom) * scale;
  const bandH = Math.max((band.bottom - band.top) * scale, screenH - topH - bottomH);
  const bottomY = screenH - bottomH;
  const bandY = bottomY - bandH;
  return { scale, topY: bandY - topH, bandY, bandH, bottomY };
}

/**
 * screenWidth는 EXPAND로 넓어진 화면 폭 (카메라가 가운데 맞춤으로 밀어 둔 상태 기준).
 * 그림을 못 읽었으면 false (부르는 쪽이 코드로 그리는 하늘 장식으로 대신한다)
 */
export function addStorybookBackground(
  scene: Phaser.Scene,
  screenWidth: number,
  screenHeight: number,
): boolean {
  if (!scene.textures.exists(STORYBOOK_KEY)) return false;
  const tex = scene.textures.get(STORYBOOK_KEY);
  const { width: w, height: h } = tex.getSourceImage() as HTMLImageElement;
  const { band } = DECOR.storybook;
  if (!tex.has('top')) {
    tex.add('top', 0, 0, 0, w, band.top);
    tex.add('band', 0, 0, band.top, w, band.bottom - band.top);
    tex.add('bottom', 0, 0, band.bottom, w, h - band.bottom);
  }
  const width = Math.max(screenWidth, GAME.width);
  const s = storybookSlices(width, screenHeight, { w, h }, band);
  const left = (GAME.width - width) / 2;
  const add = (frame: string, y: number, displayH: number): void => {
    scene.add
      .image(left, y, STORYBOOK_KEY, frame)
      .setOrigin(0)
      .setDisplaySize(width, displayH)
      .setDepth(DEPTH);
  };
  add('top', s.topY, s.bandY - s.topY);
  // 이음매에 1px 틈이 보이지 않게 띠를 위아래로 1px씩 겹친다
  add('band', s.bandY - 1, s.bandH + 2);
  add('bottom', s.bottomY, screenHeight - s.bottomY);
  return true;
}
