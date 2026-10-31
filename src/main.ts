import Phaser from 'phaser';
import { GAME } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultScene } from './scenes/ResultScene';
import { StageMapScene } from './scenes/StageMapScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.width,
  height: GAME.height,
  transparent: true, // 하늘은 index.html의 html 그라데이션 하나만 쓴다
  scale: {
    // 폭 720 기준으로 화면 비율에 맞춰 높이를 늘린다 (배치는 screenLayout)
    mode: Phaser.Scale.EXPAND,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Pause는 Game 위에 그려지도록 Game보다 뒤에 둔다
  scene: [BootScene, MenuScene, StageMapScene, GameScene, ResultScene, PauseScene],
});
