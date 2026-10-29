// core 이벤트를 따라가며 "어느 칸에 어떤 id가 있나"를 추적한다. Phaser 없는 순수 로직.
// BoardView는 swap 이벤트처럼 위치만 주어진 이벤트에서 움직일 스프라이트를 찾을 때 쓴다.
// 이벤트와 맞지 않는 상태를 만나면 바로 에러를 던진다 (core ↔ view 계약 위반).

import type { Board, GameEvent, Pos } from '../core/types';

const key = ({ r, c }: Pos) => `${r},${c}`;

export class EventTracker {
  private readonly at = new Map<string, number>();

  constructor(board: Board) {
    board.cells.forEach((block, i) => {
      if (block) this.at.set(key({ r: Math.floor(i / board.cols), c: i % board.cols }), block.id);
    });
  }

  idAt(pos: Pos): number | undefined {
    return this.at.get(key(pos));
  }

  /** "r,c" → id 사본 */
  snapshot(): Map<string, number> {
    return new Map(this.at);
  }

  apply(event: GameEvent): void {
    switch (event.type) {
      case 'swap':
      case 'swapBack': {
        const a = this.require(event.a, event.type);
        const b = this.require(event.b, event.type);
        this.at.set(key(event.a), b);
        this.at.set(key(event.b), a);
        break;
      }
      case 'remove':
        for (const { id, at } of event.blocks) {
          if (this.idAt(at) !== id) throw new Error(`remove: ${key(at)}에 ${id}가 없다`);
          this.at.delete(key(at));
        }
        break;
      case 'fall':
        // 한 열에서 동시에 움직이므로 전부 뗀 다음에 놓는다
        for (const { id, from } of event.moves) {
          if (this.idAt(from) !== id) throw new Error(`fall: ${key(from)}에 ${id}가 없다`);
          this.at.delete(key(from));
        }
        for (const { id, to } of event.moves) this.place(to, id, 'fall');
        break;
      case 'refill':
        for (const { block, at } of event.blocks) this.place(at, block.id, 'refill');
        break;
      case 'shuffle':
        this.at.clear();
        for (const { block, to } of event.mapping) this.place(to, block.id, 'shuffle');
        break;
      case 'create':
        this.place(event.at, event.block.id, 'create');
        break;
      case 'match':
      case 'activate':
      case 'score':
        break;
    }
  }

  private require(pos: Pos, type: string): number {
    const id = this.idAt(pos);
    if (id === undefined) throw new Error(`${type}: ${key(pos)}가 비어 있다`);
    return id;
  }

  private place(pos: Pos, id: number, type: string): void {
    if (this.at.has(key(pos))) throw new Error(`${type}: ${key(pos)}가 비어 있지 않다`);
    this.at.set(key(pos), id);
  }
}
