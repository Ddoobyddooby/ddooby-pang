// 연쇄 연출(파티클, 칭찬 문구, 흔들림, 웃음)을 재생한다. 기다리게 하지 않는다 (play 완료와 무관).
// 어떤 모드인지 모른다. GameScene이 BoardView의 onMatch에 연결해 준다.

import type Phaser from 'phaser';
import { FX, THEME } from '../../config';
import { cellCenter, type Layout } from '../layout';
import { FX_TEX, type Face } from '../theme/textures';
import { fxLevel, particleCount } from './fxLevels';
import type { RemovedCell } from './matchInfo';

const WHITE = 0xffffff;
/** 파티클은 블록(깊이 0) 위, 칭찬 문구(D-09) 아래 */
const PARTICLE_DEPTH = 10;

export class FxDirector {
  private readonly hearts: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly stars: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layout: Layout,
    faces: { setFaces(face: Face): void },
  ) {
    void faces; // D-09에서 `^^` 표정에 쓴다
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
    void this.scene; // D-09에서 문구·흔들림에 쓴다
  }

  preview(level: number): void {
    void level; // D-11
  }
}
