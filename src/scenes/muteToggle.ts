// 메뉴·지도 공통: 오른쪽 위 스피커 버튼을 저장값과 이어 준다.
// 저장값(settings.muted)이 단일 진실 원천이고, 누르면 저장 + 게임 전체 sound.mute에 반영한다.

import type Phaser from 'phaser';
import { setMuted } from '../storage/progress';
import { Sfx } from '../view/Sfx';
import { addMuteButton } from '../view/ui/MuteButton';
import { commitSave, getSave } from './saveRegistry';

export function addSceneMuteButton(scene: Phaser.Scene): void {
  const sfx = new Sfx(scene);
  addMuteButton(scene, getSave(scene.registry).settings.muted, (muted) => {
    commitSave(scene.registry, setMuted(getSave(scene.registry), muted));
    sfx.setMuted(muted);
    sfx.play('button'); // 소리를 켰을 때만 들린다
  });
}
