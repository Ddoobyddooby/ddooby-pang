// Android 뒤로 가기 버튼 (@capacitor/app backButton). BootScene이 앱에서 한 번만 등록한다. 웹에서는 아무것도 안 한다.
// 무엇을 할지는 backAction(순수)이 정하고, 여기서는 지금 씬에 그대로 시킨다.

import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type Phaser from 'phaser';
import { backAction } from './backAction';
import type { GameScene } from './GameScene';
import type { PauseScene } from './PauseScene';
import type { ResultScene } from './ResultScene';

let registered = false;

export function registerBackButton(game: Phaser.Game): void {
  if (registered || !Capacitor.isNativePlatform()) return;
  registered = true;
  void App.addListener('backButton', () => {
    const scenes = game.scene.getScenes(true); // 멈춘 씬(일시정지 중 Game)은 빠진다
    const keys = scenes.map((s) => s.sys.settings.key);
    const find = <T extends Phaser.Scene>(key: string) =>
      scenes.find((s) => s.sys.settings.key === key) as T | undefined;
    const action = backAction(keys, { resultKind: find<ResultScene>('Result')?.resultKind });

    if (action === 'pause') find<GameScene>('Game')?.requestPause();
    else if (action === 'resume') find<PauseScene>('Pause')?.resumeGame();
    else if (action === 'exit') void App.exitApp();
    else if (action !== 'none') scenes[0]?.scene.start(action.go);
  });
}
