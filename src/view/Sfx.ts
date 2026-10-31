// 효과음 재생 (PLAN 6.5). 씬·버튼은 이름만 부른다: sfx.play('match', { level }).
// 음소거는 게임 하나에 하나: 모듈 변수 + 게임 전체 sound.mute (모든 씬이 같이 따른다).
// 저장값(settings.muted)이 단일 진실 원천이고, Boot와 스피커 버튼이 setMuted로 여기에 반영한다.
// 기다리게 하지 않는다. 파일이 없거나 로드에 실패했으면 조용히 넘어간다.

import type Phaser from 'phaser';
import { SOUND } from '../config';

export type SfxName = keyof typeof SOUND.effects;

/** 캐시 키 (BootScene이 이 키로 미리 읽는다) */
export const sfxKey = (name: SfxName): string => `sfx-${name}`;

/** match 소리의 연쇄 단계(1부터) → 재생 속도. 단계가 오를수록 음이 높아지고 상한에서 멈춘다 */
export function sfxRate(level: number): number {
  const rates = SOUND.matchRateByLevel;
  const i = Math.min(Math.max(1, Math.round(level)), rates.length) - 1;
  return rates[i] ?? 1;
}

/**
 * sound.mute는 WebAudio gain을 예약해 바꾸므로 바로 다시 읽으면 옛값일 수 있다.
 * 그래서 재생 여부는 이 값으로 판단한다
 */
let muted = false;

export class Sfx {
  /** 이름별 마지막 재생 시각 (minGapMs 안의 중복을 건너뛴다) */
  private readonly lastAt = new Map<SfxName, number>();

  constructor(private readonly scene: Phaser.Scene) {}

  play(name: SfxName, opts: { level?: number } = {}): void {
    const { sound, cache, time } = this.scene;
    if (muted) return;
    const key = sfxKey(name);
    if (!cache.audio.exists(key)) return;
    const now = time.now;
    if (now - (this.lastAt.get(name) ?? -Infinity) < SOUND.minGapMs) return;
    this.lastAt.set(name, now);

    const rate = name === 'match' ? sfxRate(opts.level ?? 1) : 1;
    sound.play(key, { volume: SOUND.effects[name].volume, rate });
    if (import.meta.env.DEV) console.debug(`[sfx] ${name} rate=${rate}`);
  }

  setMuted(value: boolean): void {
    muted = value;
    this.scene.sound.mute = value;
  }
}
