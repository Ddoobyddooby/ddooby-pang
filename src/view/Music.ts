// 배경 음악 (PLAN 6.7). 게임 하나에 하나(Music.of(game))라 씬이 바뀌어도 곡이 이어진다.
// 씬은 이름만 부른다: music.play('menu'). 같은 곡이면 다시 시작하지 않고, 다른 곡이면 페이드로 바꾼다.
// 페이드는 씬 트윈 대신 게임 step에서 직접 계산한다 (곡을 바꾸는 도중 씬이 끝나도 끊기지 않게).
// 효과음(Sfx)과 따로 켜고 끈다. 파일이 아직 없거나 로드에 실패했으면 조용히 기다린다.

import type Phaser from 'phaser';
import { MUSIC, SOUND } from '../config';

export type TrackName = (typeof MUSIC.tracks)[number];

export const musicKey = (name: TrackName): string => `music-${name}`;
/** [ogg, m4a] 순서. 브라우저가 재생할 수 있는 첫 형식을 고른다 (SOUND.formats) */
export const musicUrls = (name: TrackName): string[] =>
  SOUND.formats.map((ext) => `audio/music/${name}.${ext}`);

export type MusicTransition = 'keep' | 'switch' | 'stop' | 'none';

/** 지금 곡 → 틀 곡. 같은 곡이면 이어서(keep), 없음 → 없음이면 아무것도 안 함 */
export function musicTransition(
  current: TrackName | null,
  next: TrackName | null,
): MusicTransition {
  if (current === next) return current === null ? 'none' : 'keep';
  return next === null ? 'stop' : 'switch';
}

/** volume을 바꿀 수 있는 소리 (WebAudio / HTML5 Audio) */
type LoopSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

interface Fade {
  from: number;
  to: number;
  elapsed: number;
  ms: number;
  /** 다 줄이면 멈추고 버린다 */
  stopAtEnd: boolean;
}

/** 덕킹·켜고 끄기처럼 곡은 그대로 두고 볼륨만 바꿀 때 */
const QUICK_FADE_MS = 200;

export class Music {
  private static readonly byGame = new WeakMap<Phaser.Game, Music>();

  static of(game: Phaser.Game): Music {
    let music = Music.byGame.get(game);
    if (!music) {
      music = new Music(game);
      Music.byGame.set(game, music);
    }
    return music;
  }

  private enabled = true;
  private ducked = false;
  /** 씬이 원하는 곡 (꺼져 있거나 아직 안 읽혔어도 기억한다) */
  private desired: TrackName | null = null;
  private current: { name: TrackName; sound: LoopSound } | null = null;
  private readonly fades = new Map<LoopSound, Fade>();
  /** 뒤에서 읽는 중인 곡 */
  private readonly loading = new Set<TrackName>();

  private constructor(private readonly game: Phaser.Game) {
    game.events.on('step', (_time: number, delta: number) => this.step(delta));
    // DEV: 브라우저 콘솔에서 window.__music.state()로 지금 곡·볼륨 확인
    if (import.meta.env.DEV) (window as unknown as { __music?: unknown }).__music = this;
  }

  /** DEV 확인용 */
  state(): {
    desired: TrackName | null;
    current: TrackName | null;
    volume: number;
    enabled: boolean;
  } {
    return {
      desired: this.desired,
      current: this.current?.name ?? null,
      volume: Math.round((this.current?.sound.volume ?? 0) * 100) / 100,
      enabled: this.enabled,
    };
  }

  /** 씬이 원하는 곡. null이면 줄여서 끝낸다 (결과 화면) */
  play(name: TrackName | null, fadeMs: number = MUSIC.fadeMs): void {
    this.desired = name;
    this.ducked = false;
    this.apply(fadeMs);
  }

  /** 일시정지 중에는 볼륨을 줄인다 */
  duck(on: boolean): void {
    this.ducked = on;
    if (this.current) this.fadeTo(this.current.sound, this.level(), QUICK_FADE_MS);
  }

  /** ♪ 버튼·저장값. 다시 켜면 지금 화면의 곡부터 */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.apply(QUICK_FADE_MS);
  }

  /** 캐시에 없는 곡을 이 씬의 로더로 뒤에서 읽는다. 다 읽은 곡이 지금 원하는 곡이면 바로 튼다 */
  load(scene: Phaser.Scene, names: readonly TrackName[]): void {
    const todo = names.filter(
      (n) => !this.game.cache.audio.exists(musicKey(n)) && !this.loading.has(n),
    );
    if (todo.length === 0) return;
    for (const name of todo) {
      this.loading.add(name);
      scene.load.audio(musicKey(name), musicUrls(name));
      scene.load.once(`filecomplete-audio-${musicKey(name)}`, () => {
        this.loading.delete(name);
        if (this.desired === name) this.apply(MUSIC.fadeMs);
      });
    }
    // 다 읽기 전에 씬이 끝나면 로더가 멈춘다. 다음 씬이 다시 부를 수 있게 표시를 지운다
    const forget = () => todo.forEach((n) => this.loading.delete(n));
    scene.load.once('complete', forget);
    scene.events.once('shutdown', forget);
    scene.load.start();
  }

  private level(): number {
    return MUSIC.volume * (this.ducked ? MUSIC.pauseDuck : 1);
  }

  private apply(fadeMs: number): void {
    const target = this.enabled ? this.desired : null;
    const change = musicTransition(this.current?.name ?? null, target);
    if (change === 'none') return;
    if (change === 'keep') {
      if (this.current) this.fadeTo(this.current.sound, this.level(), QUICK_FADE_MS);
      return;
    }
    if (this.current) {
      this.fadeTo(this.current.sound, 0, fadeMs, true);
      this.current = null;
    }
    if (change === 'switch' && target && this.game.cache.audio.exists(musicKey(target))) {
      const sound = this.game.sound.add(musicKey(target), { loop: true, volume: 0 }) as LoopSound;
      sound.play();
      this.current = { name: target, sound };
      this.fadeTo(sound, this.level(), fadeMs);
    }
  }

  private fadeTo(sound: LoopSound, to: number, ms: number, stopAtEnd = false): void {
    this.fades.set(sound, { from: sound.volume, to, elapsed: 0, ms: Math.max(1, ms), stopAtEnd });
  }

  private step(delta: number): void {
    for (const [sound, fade] of this.fades) {
      fade.elapsed += delta;
      const t = Math.min(1, fade.elapsed / fade.ms);
      sound.setVolume(fade.from + (fade.to - fade.from) * t);
      if (t < 1) continue;
      this.fades.delete(sound);
      if (fade.stopAtEnd) {
        sound.stop();
        sound.destroy();
      }
    }
  }
}
