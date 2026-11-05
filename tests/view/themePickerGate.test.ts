import { describe, expect, it, vi } from 'vitest';
import { PickerGate } from '../../src/view/themePickerGate';

function gate() {
  const onPick = vi.fn();
  const onClose = vi.fn();
  return { g: new PickerGate(onPick, onClose), onPick, onClose };
}

describe('PickerGate', () => {
  it('카드 → 연출 끝: 고르기만 한 번', () => {
    const { g, onPick, onClose } = gate();
    expect(g.startPick('candy')).toBe(true);
    g.finishPick();
    g.finishPick();
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith('candy');
    expect(onClose).not.toHaveBeenCalled();
    expect(g.phase).toBe('closed');
  });

  it('카드를 누른 뒤 연출 중에 막을 눌러도 닫기는 무시, 고르기는 그대로', () => {
    const { g, onPick, onClose } = gate();
    g.startPick('space');
    expect(g.close()).toBe(false);
    g.finishPick();
    expect(onPick).toHaveBeenCalledWith('space');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('막으로 닫은 뒤에는 늦게 온 연출 완료가 고르기를 실행하지 않는다', () => {
    const { g, onPick, onClose } = gate();
    expect(g.close()).toBe(true);
    expect(g.startPick('ocean')).toBe(false);
    g.finishPick();
    expect(onPick).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('카드를 두 번 눌러도, 닫기를 두 번 눌러도 한 번만', () => {
    const { g, onPick } = gate();
    g.startPick('candy');
    expect(g.startPick('ocean')).toBe(false);
    g.finishPick();
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith('candy');

    const b = gate();
    b.g.close();
    b.g.close();
    expect(b.onClose).toHaveBeenCalledOnce();
  });
});
