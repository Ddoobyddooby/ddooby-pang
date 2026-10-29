import { describe, expectTypeOf, it } from 'vitest';
import type {
  Block,
  Color,
  GameEvent,
  GameEventType,
  Pos,
  SpecialKind,
} from '../../src/core/types';

// 타입은 런타임에 사라지므로 expectTypeOf로 검사하고, 실제 검증은 `npm run typecheck`가 한다.
describe('core/types', () => {
  it('Color는 0~5', () => {
    expectTypeOf<Color>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5>();
  });

  it('특수 블록 종류는 5가지', () => {
    expectTypeOf<SpecialKind>().toEqualTypeOf<'lineH' | 'lineV' | 'bomb' | 'color' | 'super'>();
  });

  it('컬러 블록은 color가 null이다', () => {
    const colorBomb: Block = { id: 1, color: null, special: 'color' };
    expectTypeOf(colorBomb.color).toEqualTypeOf<Color | null>();
  });

  it('GameEvent는 type으로 좁혀진다', () => {
    const narrow = (e: GameEvent) => {
      if (e.type === 'fall') {
        expectTypeOf(e.moves[0]!.from).toEqualTypeOf<Pos>();
      }
      if (e.type === 'refill') {
        expectTypeOf(e.blocks[0]!.dropFrom).toEqualTypeOf<number>();
      }
    };
    expectTypeOf(narrow).toBeFunction();
  });

  it('이벤트 종류 목록', () => {
    expectTypeOf<GameEventType>().toEqualTypeOf<
      | 'swap'
      | 'swapBack'
      | 'match'
      | 'activate'
      | 'remove'
      | 'create'
      | 'fall'
      | 'refill'
      | 'score'
      | 'shuffle'
    >();
  });
});
