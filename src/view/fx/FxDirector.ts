// 연쇄 연출(파티클, 칭찬 문구, 흔들림, 웃음)을 재생한다. 기다리게 하지 않는다 (play 완료와 무관).
// 어떤 모드인지 모른다. GameScene이 BoardView의 onMatch에 연결해 준다.

import type Phaser from 'phaser';
import { FX, THEME } from '../../config';
import { cellCenter, type Layout } from '../layout';
import { FX_TEX, type Face } from '../theme/textures';
import { fxLevel, particleCount } from './fxLevels';
import type { RemovedCell } from './matchInfo';

const WHITE = 0xffffff;
/** 파티클은 블록(깊이 0) 위, 칭찬 문구 아래 */
const PARTICLE_DEPTH = 10;
const PRAISE_DEPTH = 20;
/** 칭찬 문구 모양과 움직임 (ms, px). 문구·색·크기 배율은 config의 FX / THEME에 있다 */
const PRAISE = {
  fontSize: 72,
  strokeThickness: 12,
  /** 보드 높이 대비 문구 y 위치 */
  yRatio: 0.3,
  popScale: 1.25,
  popMs: 150,
  settleMs: 100,
  holdMs: 500,
  riseMs: 400,
  rise: 30,
};

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
        scale: { start: 0.35, end: 0.1 },
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
        scale: { start: 0.3, end: 0.1 },
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
        this.layout.y + this.layout.height * PRAISE.yRatio,
        praise,
        {
          fontFamily: THEME.font,
          fontSize: `${PRAISE.fontSize * scale}px`,
          color,
          stroke: '#ffffff',
          strokeThickness: PRAISE.strokeThickness,
        },
      )
      .setOrigin(0.5)
      .setDepth(PRAISE_DEPTH)
      .setScale(0);
    this.praiseText = text;

    // 0 → 1.25 → 1, 잠깐 유지, 위로 떠오르며 사라진다. 도중에 치워지면 killTweensOf로 끊긴다
    scene.tweens.add({
      targets: text,
      scale: PRAISE.popScale,
      duration: PRAISE.popMs,
      ease: 'Quad.easeOut',
      onComplete: () =>
        scene.tweens.add({
          targets: text,
          scale: 1,
          duration: PRAISE.settleMs,
          onComplete: () =>
            scene.tweens.add({
              targets: text,
              y: text.y - PRAISE.rise,
              alpha: 0,
              delay: PRAISE.holdMs,
              duration: PRAISE.riseMs,
              onComplete: () => {
                text.destroy();
                if (this.praiseText === text) this.praiseText = undefined;
              },
            }),
        }),
    });
  }

  preview(level: number): void {
    void level; // D-11
  }
}
