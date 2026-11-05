// 화면 배경 고르기: 고른 테마의 그림이 있으면 그것, 없으면 코드로 그리는 하늘 장식(+언덕).
// 그림책 테마는 게임 화면에서만 그림(backgrounds/storybook.jpg)을 쓰고, 메뉴·지도·결과는 v0.1처럼 코드 장식이다.

import type Phaser from 'phaser';
import { Background } from './Background';
import { addHills } from './Hills';
import { addThemeBackground } from './StorybookBackground';
import { getActiveThemeId } from './themes';

export interface SceneBackgroundOptions {
  /** true면 그림책 테마도 그림을 쓴다 (게임 화면) */
  storybookArt: boolean;
  /** 코드 장식일 때 바닥 언덕도 그린다 (지도는 스크롤 묶음 안에 따로 넣어서 false) */
  hills: boolean;
}

/** 그림 배경을 깔았으면 true, 코드 장식으로 대신했으면 false */
export function addSceneBackground(
  scene: Phaser.Scene,
  width: number,
  height: number,
  { storybookArt, hills }: SceneBackgroundOptions,
): boolean {
  const id = getActiveThemeId();
  if ((id !== 'storybook' || storybookArt) && addThemeBackground(scene, width, height, id)) {
    return true;
  }
  new Background(scene);
  if (hills) addHills(scene, width, height);
  return false;
}
