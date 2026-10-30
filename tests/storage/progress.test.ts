import { describe, expect, it, vi } from 'vitest';
import {
  LocalStorageAdapter,
  defaultSave,
  parseSave,
  recordStory,
  recordTimeAttack,
  type KeyValueStore,
  type SaveData,
} from '../../src/storage/progress';

const fakeStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
};

describe('parseSave', () => {
  it('null·깨진 JSON·배열·버전 다름 → 기본값', () => {
    expect(parseSave(null)).toEqual(defaultSave());
    expect(parseSave('{깨짐')).toEqual(defaultSave());
    expect(parseSave('[]')).toEqual(defaultSave());
    expect(parseSave('"x"')).toEqual(defaultSave());
    expect(parseSave(JSON.stringify({ ...defaultSave(), version: 2 }))).toEqual(defaultSave());
  });

  it('필드가 빠지면 그 부분만 기본값으로 채운다', () => {
    expect(parseSave('{"version":1}')).toEqual(defaultSave());
    const partial = parseSave(JSON.stringify({ version: 1, timeattack: { bestScore: 500 } }));
    expect(partial.timeattack.bestScore).toBe(500);
    expect(partial.story).toEqual(defaultSave().story);
  });

  it('잘못된 값(음수, 문자열, 범위 밖 별)은 버린다', () => {
    const save = parseSave(
      JSON.stringify({
        version: 1,
        story: { unlocked: 0, bestStars: { 1: 3, 2: 9, 3: 'x' }, bestScore: { 1: -5, 2: 100 } },
        timeattack: { bestScore: 'a' },
      }),
    );
    expect(save.story.unlocked).toBe(1);
    expect(save.story.bestStars).toEqual({ 1: 3 });
    expect(save.story.bestScore).toEqual({ 2: 100 });
    expect(save.timeattack.bestScore).toBe(0);
  });
});

describe('recordTimeAttack', () => {
  it('큰 값만 남기고 원본은 바뀌지 않는다', () => {
    const base = defaultSave();
    const a = recordTimeAttack(base, 800);
    expect(a.timeattack.bestScore).toBe(800);
    expect(recordTimeAttack(a, 300).timeattack.bestScore).toBe(800);
    expect(recordTimeAttack(a, 1200).timeattack.bestScore).toBe(1200);
    expect(base).toEqual(defaultSave());
  });
});

describe('recordStory', () => {
  it('클리어하면 다음 스테이지를 연다', () => {
    const s = recordStory(defaultSave(), 1, { cleared: true, stars: 2, score: 900 });
    expect(s.story.unlocked).toBe(2);
    expect(s.story.bestStars[1]).toBe(2);
    expect(s.story.bestScore[1]).toBe(900);
  });

  it('실패하면 해금은 그대로, 기록은 큰 값만', () => {
    const cleared = recordStory(defaultSave(), 1, { cleared: true, stars: 2, score: 900 });
    const failed = recordStory(cleared, 1, { cleared: false, stars: 0, score: 100 });
    expect(failed.story.unlocked).toBe(2);
    expect(failed.story.bestStars[1]).toBe(2);
    expect(failed.story.bestScore[1]).toBe(900);
    expect(
      recordStory(defaultSave(), 1, { cleared: false, stars: 0, score: 50 }).story.unlocked,
    ).toBe(1);
  });

  it('별·점수는 더 큰 값으로 갱신, 이미 더 높은 unlocked는 유지', () => {
    let s: SaveData = recordStory(defaultSave(), 5, { cleared: true, stars: 1, score: 500 });
    expect(s.story.unlocked).toBe(6);
    s = recordStory(s, 2, { cleared: true, stars: 3, score: 2000 });
    expect(s.story.unlocked).toBe(6); // 2를 다시 깨도 줄지 않는다
    s = recordStory(s, 5, { cleared: true, stars: 3, score: 400 });
    expect(s.story.bestStars[5]).toBe(3);
    expect(s.story.bestScore[5]).toBe(500);
  });

  it('원본 객체가 바뀌지 않는다', () => {
    const base = defaultSave();
    const snapshot = JSON.stringify(base);
    recordStory(base, 1, { cleared: true, stars: 3, score: 1 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('LocalStorageAdapter', () => {
  it('저장 → 로드 왕복, 키는 ddooby-pang/save', async () => {
    const store = fakeStore();
    const adapter = new LocalStorageAdapter(store);
    const save = recordStory(recordTimeAttack(defaultSave(), 777), 3, {
      cleared: true,
      stars: 3,
      score: 1500,
    });
    await adapter.save(save);
    expect(store.data.has('ddooby-pang/save')).toBe(true);
    expect(await new LocalStorageAdapter(store).load()).toEqual(save);
  });

  it('저장된 게 없으면 기본값', async () => {
    expect(await new LocalStorageAdapter(fakeStore()).load()).toEqual(defaultSave());
  });

  it('setItem·getItem이 throw해도 reject하지 않고 경고만 한다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const adapter = new LocalStorageAdapter(broken);
    await expect(adapter.save(defaultSave())).resolves.toBeUndefined();
    await expect(adapter.load()).resolves.toEqual(defaultSave());
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
