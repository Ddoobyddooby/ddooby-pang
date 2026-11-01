// 메뉴·지도·일시정지 공통: 오른쪽 위 스피커(효과음)·♪(배경 음악) 버튼을 저장값과 이어 준다.
// 저장값(settings.muted / settings.music)이 단일 진실 원천이고, 누르면 저장 + Sfx / Music에 반영한다. 둘은 서로 영향이 없다.

import type Phaser from 'phaser';
import { setMusic, setMuted } from '../storage/progress';
import { Music } from '../view/Music';
import { Sfx } from '../view/Sfx';
import { addMusicButton } from '../view/ui/MusicButton';
import { addMuteButton } from '../view/ui/MuteButton';
import { commitSave, getSave } from './saveRegistry';

/** 자리를 주지 않으면 메뉴·지도의 오른쪽 위 (MAP.back과 대칭) */
export function addSceneMuteButton(scene: Phaser.Scene, y?: number, x?: number): void {
  const sfx = new Sfx(scene);
  addMuteButton(
    scene,
    getSave(scene.registry).settings.muted,
    (muted) => {
      commitSave(scene.registry, setMuted(getSave(scene.registry), muted));
      sfx.setMuted(muted);
      sfx.play('button'); // 소리를 켰을 때만 들린다
    },
    y,
    x,
  );
}

/** ♪: 자리를 주지 않으면 메뉴·지도의 스피커 왼쪽 */
export function addSceneMusicButton(scene: Phaser.Scene, y?: number, x?: number): void {
  const sfx = new Sfx(scene);
  addMusicButton(
    scene,
    getSave(scene.registry).settings.music,
    (on) => {
      commitSave(scene.registry, setMusic(getSave(scene.registry), on));
      Music.of(scene.game).setEnabled(on);
      sfx.play('button');
    },
    y,
    x,
  );
}
