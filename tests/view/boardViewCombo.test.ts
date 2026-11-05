// 실제 BoardView.play를 가짜 scene(가상 시계)로 돌려, combo 준비 연출이 끝나기 전에는
// remove·transform·폭발 FX가 시작되지 않는지 본다 (PLAN2 3.4). Phaser와 BlockSprite는 가짜.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIM, COMBO } from '../../src/config';
import type { Block, Board, GameEvent, Pos } from '../../src/core/types';
import { BoardView } from '../../src/view/BoardView';
import { comboPrepMs } from '../../src/view/fx/comboTimeline';
import { cellCenter, type Layout } from '../../src/view/layout';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../../src/view/theme/textures', () => ({ ensureTextures: () => undefined }));

// 가상 시계: 트윈·delayedCall을 모두 여기서 흘린다
const { clock, log, FakeSprite } = vi.hoisted(() => {
  const clock = { now: 0, seq: 0, timers: [] as { at: number; seq: number; fn: () => void }[] };
  const log = { sprites: new Map<number, { squintAt: number | null }>() };
  class FakeSprite {
    removing = false;
    squintAt: number | null = null;
    constructor(
      _scene: unknown,
      public x: number,
      public y: number,
      block: { id: number },
    ) {
      log.sprites.set(block.id, this);
    }
    setFace(face: string) {
      if (face === 'squint') this.squintAt = clock.now;
      return this;
    }
    setScale() {
      return this;
    }
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    pop() {}
    flash() {}
    squish() {}
    transformTo() {}
    destroy() {}
  }
  return { clock, log, FakeSprite };
});
vi.mock('../../src/view/BlockSprite', () => ({ BlockSprite: FakeSprite }));

const schedule = (ms: number, fn?: () => void) => {
  if (fn) clock.timers.push({ at: clock.now + ms, seq: clock.seq++, fn });
};
const tweenConfigs: { targets: unknown; x?: number; y?: number; at: number }[] = [];
const chain = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? undefined : chain()),
    apply: () => chain(),
  });
const scene = {
  add: chain(),
  make: chain(),
  tweens: {
    add(cfg: {
      targets: unknown;
      x?: number;
      y?: number;
      delay?: number;
      duration: number;
      onComplete?: () => void;
    }) {
      tweenConfigs.push({ targets: cfg.targets, x: cfg.x, y: cfg.y, at: clock.now });
      schedule((cfg.delay ?? 0) + cfg.duration, cfg.onComplete);
    },
    killTweensOf() {},
  },
  time: { delayedCall: (ms: number, fn: () => void) => schedule(ms, fn) },
};

async function flush() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}
async function advance(ms: number) {
  const end = clock.now + ms;
  for (;;) {
    await flush();
    clock.timers.sort((a, b) => a.at - b.at || a.seq - b.seq);
    const next = clock.timers[0];
    if (!next || next.at > end) break;
    clock.timers.shift();
    clock.now = next.at;
    next.fn();
  }
  clock.now = end;
  await flush();
}

const p = (r: number, c: number): Pos => ({ r, c });
const layout: Layout = { rows: 1, cols: 3, cell: 50, x: 0, y: 0, width: 150, height: 50 };
const board = (blocks: Block[]): Board =>
  ({
    rows: 1,
    cols: 3,
    cells: blocks,
    nextId: 100,
    seed: 1,
  }) as unknown as Board;

interface Probe {
  view: BoardView;
  names: number[];
  blasts: { at: number; ring: Pos; cells: number }[];
  done: () => boolean;
}
function start(blocks: Block[], steps: GameEvent[][]): Probe {
  const names: number[] = [];
  const blasts: Probe['blasts'] = [];
  const view = new BoardView(scene as never, board(blocks), layout, {
    onComboName: () => names.push(clock.now),
    onComboBlast: (_c, at, cells) => blasts.push({ at: clock.now, ring: at, cells: cells.length }),
  });
  let finished = false;
  void view.play(steps).then(() => (finished = true));
  return { view, names, blasts, done: () => finished };
}

beforeEach(() => {
  clock.now = 0;
  clock.timers = [];
  tweenConfigs.length = 0;
  log.sprites.clear();
});

describe('BoardView.play: combo 준비 연출', () => {
  const b = (id: number, special?: Block['special']): Block => ({
    id,
    color: special === 'color' ? null : 0,
    special,
  });
  const lineH = b(0, 'lineH');
  const lineV = b(1, 'lineV');
  const other = b(2);

  it('준비 시간이 끝나기 전에는 제거·폭발이 시작되지 않고, 끝나면 함께 시작한다', async () => {
    const combo: GameEvent = {
      type: 'combo',
      combo: 'lineLine',
      at: p(0, 1),
      partner: p(0, 0),
      cleared: [p(0, 0), p(0, 1)],
    };
    const remove: GameEvent = {
      type: 'remove',
      blocks: [
        { id: 0, at: p(0, 0), bySpecial: true },
        { id: 1, at: p(0, 1), bySpecial: true },
      ],
    };
    const probe = start([lineH, lineV, other], [[combo], [remove]]);
    await advance(comboPrepMs() - 1);
    expect(probe.names).toEqual([COMBO.mergeMs + COMBO.slowMs]);
    expect(probe.blasts).toEqual([]);
    expect(log.sprites.get(0)!.squintAt).toBeNull();
    expect(log.sprites.get(1)!.squintAt).toBeNull();
    await advance(1);
    expect(probe.blasts.map((x) => x.at)).toEqual([comboPrepMs()]);
    expect(log.sprites.get(0)!.squintAt).toBe(comboPrepMs());
    await advance(5000);
    expect(probe.done()).toBe(true);
  });

  it('역방향 컬러 조합: 컬러 칸으로 모이고, 폭발은 변신 뒤 컬러 칸에서', async () => {
    const color = b(0, 'color'); // (0,0) = partner 쪽
    const combo: GameEvent = {
      type: 'combo',
      combo: 'colorLine',
      at: p(0, 1),
      partner: p(0, 0),
      cleared: [p(0, 0)],
    };
    const transform: GameEvent = {
      type: 'transform',
      changes: [{ at: p(0, 2), block: { ...other, special: 'lineH' } }],
    };
    const activate: GameEvent = {
      type: 'activate',
      special: 'color',
      at: p(0, 0),
      cleared: [p(0, 0), p(0, 2)],
      depth: 0,
    };
    const remove: GameEvent = {
      type: 'remove',
      blocks: [
        { id: 0, at: p(0, 0), bySpecial: true },
        { id: 2, at: p(0, 2), bySpecial: true },
      ],
    };
    const probe = start([color, lineV, other], [[combo], [transform, activate, remove]]);
    await advance(comboPrepMs() - 1);
    expect(probe.blasts).toEqual([]);
    expect(log.sprites.get(0)!.squintAt).toBeNull();
    // 모이기: at 쪽(id 1) 블록이 컬러 칸(0,0)으로 간다
    const merge = tweenConfigs.find((t) => t.targets === log.sprites.get(1));
    expect(merge).toMatchObject(cellCenter(layout, p(0, 0)));
    await advance(1 + ANIM.transform - 1);
    expect(probe.blasts).toEqual([]); // 변신이 끝나기 전
    await advance(1);
    expect(probe.blasts).toEqual([{ at: comboPrepMs() + ANIM.transform, ring: p(0, 0), cells: 2 }]);
    await advance(5000);
    expect(probe.done()).toBe(true);
  });

  it('bombBomb은 두 번째 폭발이 bombBombSecondMs 뒤다', async () => {
    const bomb = b(0, 'bomb');
    const combo: GameEvent = {
      type: 'combo',
      combo: 'bombBomb',
      at: p(0, 1),
      partner: p(0, 0),
      cleared: [p(0, 0), p(0, 1)],
    };
    const remove: GameEvent = {
      type: 'remove',
      blocks: [
        { id: 0, at: p(0, 0), bySpecial: true },
        { id: 1, at: p(0, 1), bySpecial: true },
      ],
    };
    const probe = start([bomb, b(1, 'bomb'), other], [[combo], [remove]]);
    await advance(5000);
    expect(probe.blasts.map((x) => x.at)).toEqual([
      comboPrepMs(),
      comboPrepMs() + COMBO.bombBombSecondMs,
    ]);
  });
});
