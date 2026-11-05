// 테마 고르기 창의 진행 상태 (순수). 카드 누름 연출이 끝나기 전에 막·닫기가 눌려도
// 고르기와 닫기가 둘 다 실행되지 않게, 먼저 일어난 하나만 받는다.

import type { ThemeId } from '../data/themeIds';

export type PickerPhase = 'open' | 'picking' | 'closed';

export class PickerGate {
  private current: PickerPhase = 'open';
  private choice: ThemeId | null = null;

  constructor(
    private readonly onPick: (id: ThemeId) => void,
    private readonly onClose: () => void,
  ) {}

  get phase(): PickerPhase {
    return this.current;
  }

  /** 카드를 눌렀다 (연출 시작). 열려 있을 때만 받는다 */
  startPick(id: ThemeId): boolean {
    if (this.current !== 'open') return false;
    this.current = 'picking';
    this.choice = id;
    return true;
  }

  /** 카드 연출이 끝났다: 고르기를 확정하고 창을 닫는다 */
  finishPick(): void {
    if (this.current !== 'picking' || this.choice === null) return;
    const id = this.choice;
    this.current = 'closed';
    this.onPick(id);
  }

  /** 막·닫기 버튼. 열려 있을 때만 닫는다 (고르는 중이면 무시) */
  close(): boolean {
    if (this.current !== 'open') return false;
    this.current = 'closed';
    this.onClose();
    return true;
  }
}
