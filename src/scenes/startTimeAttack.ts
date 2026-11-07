// 경쟁 시작 경로 (V2-W3-03, PLAN2 6.4): 메뉴 [경쟁]·결과 [다시하기]·일시정지 [다시하기]가 같이 쓴다.
// "준비 중…" 덮개로 입력을 막고 서버 run을 받은 뒤 Game 씬을 시작한다 (최대 RUN.startTimeoutMs).
// 서버를 쓸 수 없으면 덮개 없이 바로 시작한다.

import Phaser from 'phaser';
import { DECOR, GAME, RUN, THEME, UI } from '../config';
import { RANKING_TEXT } from '../view/rankingText';
import { getRunClient } from './runClient';
import { hasRankBlockingOption, prepareTimeAttack } from './timeAttackStart';

export function startTimeAttack(scene: Phaser.Scene): void {
  const client = getRunClient();
  const blocked = hasRankBlockingOption(window.location.search, import.meta.env.DEV);
  if (blocked || !client.canRank()) {
    scene.scene.start('Game', { mode: 'timeattack' });
    return;
  }

  // 화면 전체 덮개: 준비하는 동안 다른 버튼이 눌리지 않는다
  const { width, height } = scene.scale;
  const cx = GAME.width / 2;
  const depth = RUN.overlayDepth;
  scene.add
    .rectangle(cx, height / 2, width, height, RUN.dim.color, RUN.dim.alpha)
    .setDepth(depth)
    .setInteractive();
  const { pillWidth: w, pillHeight: h } = RUN;
  scene.add
    .graphics()
    .fillStyle(THEME.wafer.fill, 1)
    .fillRoundedRect(cx - w / 2, height / 2 - h / 2, w, h, h / 2)
    .lineStyle(DECOR.frame.border, THEME.wafer.stroke, 1)
    .strokeRoundedRect(cx - w / 2, height / 2 - h / 2, w, h, h / 2)
    .setDepth(depth + 1);
  scene.add
    .text(cx, height / 2, RANKING_TEXT.preparing, {
      fontFamily: THEME.font,
      fontSize: `${RUN.fontSize}px`,
      color: UI.button.textColor,
    })
    .setOrigin(0.5)
    .setDepth(depth + 2);

  void prepareTimeAttack(client, { blocked }).then((data) => {
    // 기다리는 사이 씬이 닫혔으면(Android 뒤로 가기 등) 시작하지 않는다
    if (!scene.sys.isActive()) return;
    scene.scene.start('Game', data);
  });
}
