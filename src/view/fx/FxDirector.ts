// 연쇄 연출(파티클, 칭찬 문구, 흔들림, 웃음)과 특수 블록 발동 연출을 재생한다. 기다리게 하지 않는다 (play 완료와 무관).
// 어떤 모드인지 모른다. GameScene이 BoardView의 onMatch / onActivate에 연결해 준다.

import type Phaser from 'phaser';
import { FX, THEME } from '../../config';
import type { Color, Pos, SpecialKind } from '../../core/types';
import { cellCenter, type Layout } from '../layout';
import { FX_TEX, type Face } from '../theme/textures';
import { fxLevel, particleCount } from './fxLevels';
import type { RemovedCell } from './matchInfo';
import { specialFxPlan } from './specialFx';

const WHITE = 0xffffff;
/** 파티클은 블록(깊이 0) 위, 칭찬 문구 아래 */
const PARTICLE_DEPTH = 10;
const PRAISE_DEPTH = 20;
/** preview가 터뜨리는 행 */
const PREVIEW_ROW = 3;
export class FxDirector {
  private readonly hearts: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly stars: Phaser.GameObjects.Particles.ParticleEmitter;
  /** 웃음 타이머는 하나만 둔다. 새 연쇄가 오면 다시 잰다 */
  private happyTimer?: Phaser.Time.TimerEvent;
  private praiseText?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: Layout,
    private readonly faces: { setFaces(face: Face): void },
  ) {
    // 이미터는 한 번만 만들어 재사용한다 (매 연쇄마다 만들지 않는다)
    this.hearts = scene.add
      .particles(0, 0, FX_TEX.heart, {
        emitting: false,
        speed: { min: 120, max: 260 },
        angle: { min: 200, max: 340 },
        gravityY: 500,
        lifespan: 700,
        scale: FX.heartScale,
        alpha: { start: 1, end: 0 },
      })
      .setDepth(PARTICLE_DEPTH);
    this.stars = scene.add
      .particles(0, 0, FX_TEX.star, {
        emitting: false,
        speed: { min: 100, max: 220 },
        angle: { min: 0, max: 360 },
        rotate: { start: 0, end: 180 },
        lifespan: 600,
        scale: FX.starScale,
        alpha: { start: 1, end: 0 },
      })
      .setDepth(PARTICLE_DEPTH);
    this.stars.setParticleTint(THEME.star);
  }

  playMatch(level: number, removed: readonly RemovedCell[]): void {
    if (removed.length === 0) return;
    const info = fxLevel(level);

    // 하트: 전체 개수를 칸마다 고르게 나눈다 (나머지는 앞 칸부터 하나씩)
    const hearts = particleCount(info.level, removed.length);
    const base = Math.floor(hearts / removed.length);
    const extra = hearts % removed.length;
    // 별: 칸마다 하트의 절반쯤, 하트와 합쳐서 maxParticles를 넘지 않게
    const starBudget = info.stars ? Math.max(0, FX.maxParticles - hearts) : 0;
    const starsPerCell = Math.ceil(info.particlesPerBlock / 2);

    let starsLeft = starBudget;
    removed.forEach(({ at, color }, i) => {
      const { x, y } = cellCenter(this.layout, at);
      const heartCount = base + (i < extra ? 1 : 0);
      if (heartCount > 0) {
        this.hearts.setParticleTint(color === null ? WHITE : THEME.blocks[color].fill);
        this.hearts.explode(heartCount, x, y);
      }
      const starCount = Math.min(starsPerCell, starsLeft);
      if (starCount > 0) {
        this.stars.explode(starCount, x, y);
        starsLeft -= starCount;
      }
    });

    if (info.praise && info.praiseColor)
      this.showPraise(info.praise, info.praiseScale, info.praiseColor);
    if (info.shake) this.scene.cameras.main.shake(info.shake.duration, info.shake.intensity);
    if (info.happy) this.beHappy();
  }

  /** 특수 블록 발동: 빛줄기, 퍼지는 원, 흔들림, 반짝임 (specialFx.ts의 구성대로) */
  playActivate(special: SpecialKind, at: Pos, cleared: readonly Pos[]): void {
    const plan = specialFxPlan(special, cleared);
    const { x, y } = cellCenter(this.layout, at);
    for (const beam of plan.beams) this.beam(beam, x, y);
    if (plan.ring > 0) this.ring(x, y, plan.ring * this.layout.cell);
    if (plan.shake) {
      const { duration, intensity } = FX.special.superShake;
      this.scene.cameras.main.shake(duration, intensity);
    }
    for (const p of plan.sparkles) {
      const c = cellCenter(this.layout, p);
      this.stars.explode(FX.special.starsPerSparkle, c.x, c.y);
    }
  }

  /** 보드를 가로지르는 빛줄기가 가늘어지며 사라진다 */
  private beam(dir: 'row' | 'col', x: number, y: number): void {
    const { scene, layout } = this;
    const s = FX.special;
    const row = dir === 'row';
    const rect = row
      ? scene.add.rectangle(layout.x + layout.width / 2, y, layout.width, layout.cell)
      : scene.add.rectangle(x, layout.y + layout.height / 2, layout.cell, layout.height);
    rect.setFillStyle(s.beamColor, s.beamAlpha).setDepth(PARTICLE_DEPTH);
    rect.setScale(row ? 1 : s.beamWidth.start, row ? s.beamWidth.start : 1);
    scene.tweens.add({
      targets: rect,
      [row ? 'scaleY' : 'scaleX']: s.beamWidth.end,
      alpha: 0,
      duration: s.beamMs,
      ease: 'Quad.easeOut',
      onComplete: () => rect.destroy(),
    });
  }

  /** 가운데서 퍼지며 옅어지는 원 */
  private ring(x: number, y: number, radius: number): void {
    const s = FX.special;
    const circle = this.scene.add
      .circle(x, y, radius, s.ringColor, s.ringAlpha)
      .setDepth(PARTICLE_DEPTH)
      .setScale(0.3);
    this.scene.tweens.add({
      targets: circle,
      scale: 1,
      alpha: 0,
      duration: s.ringMs,
      ease: 'Quad.easeOut',
      onComplete: () => circle.destroy(),
    });
  }

  /** 남은 블록이 `^^`로 웃는다. 끝나면 반드시 평소 표정으로 돌린다 */
  private beHappy(): void {
    this.faces.setFaces('happy');
    this.happyTimer?.remove(false);
    this.happyTimer = this.scene.time.delayedCall(FX.happyMs, () => {
      this.happyTimer = undefined;
      this.faces.setFaces('normal');
    });
  }

  /** 이전 문구가 남아 있으면 바로 치우고 새로 띄운다 */
  private showPraise(praise: string, scale: number, color: string): void {
    const { scene } = this;
    if (this.praiseText) {
      scene.tweens.killTweensOf(this.praiseText);
      this.praiseText.destroy();
    }
    const text = scene.add
      .text(
        this.layout.x + this.layout.width / 2,
        this.layout.y + this.layout.height * FX.praiseStyle.yRatio,
        praise,
        {
          fontFamily: THEME.font,
          fontSize: `${FX.praiseStyle.fontSize * scale}px`,
          color,
          stroke: '#ffffff',
          strokeThickness: FX.praiseStyle.strokeThickness,
        },
      )
      .setOrigin(0.5)
      .setDepth(PRAISE_DEPTH)
      .setScale(0);
    this.praiseText = text;

    // 0 → 1.25 → 1, 잠깐 유지, 위로 떠오르며 사라진다. 도중에 치워지면 killTweensOf로 끊긴다
    scene.tweens.add({
      targets: text,
      scale: FX.praiseStyle.popScale,
      duration: FX.praiseStyle.popMs,
      ease: 'Quad.easeOut',
      onComplete: () =>
        scene.tweens.add({
          targets: text,
          scale: 1,
          duration: FX.praiseStyle.settleMs,
          onComplete: () =>
            scene.tweens.add({
              targets: text,
              y: text.y - FX.praiseStyle.rise,
              alpha: 0,
              delay: FX.praiseStyle.holdMs,
              duration: FX.praiseStyle.riseMs,
              onComplete: () => {
                text.destroy();
                if (this.praiseText === text) this.praiseText = undefined;
              },
            }),
        }),
    });
  }

  /** 개발용: 보드 가운데 행 3칸이 터진 것처럼 level 단계 연출만 재생한다. 블록 상태는 건드리지 않는다 */
  preview(level: number): void {
    const color = ((level - 1) % THEME.blocks.length) as Color; // 단계마다 다른 색 하트
    const cells = [2, 3, 4].map((c) => ({ at: { r: PREVIEW_ROW, c }, color }));
    this.playMatch(level, cells);
  }

  /** 개발용: 보드 가운데 칸에서 special 발동 연출만 재생한다. 무지개는 보드 전체에 반짝임 */
  previewSpecial(special: SpecialKind): void {
    const { rows, cols } = this.layout;
    const all = Array.from({ length: rows * cols }, (_, i) => ({
      r: Math.floor(i / cols),
      c: i % cols,
    }));
    this.playActivate(special, { r: PREVIEW_ROW, c: PREVIEW_ROW }, all);
  }
}
