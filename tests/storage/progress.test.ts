import { describe, expect, it, vi } from 'vitest';
import type { ModeResult } from '../../src/modes/GameMode';
import {
  LocalStorageAdapter,
  applyModeResult,
  defaultSave,
  parseSave,
  recordStory,
  recordTimeAttack,
  setMuted,
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

  it('settings가 없는 옛 저장값(W4-02 전)은 음소거 꺼짐으로 채우고 나머지는 그대로', () => {
    const old = {
      version: 1,
      story: { unlocked: 4, bestStars: { 1: 3 }, bestScore: { 1: 2500 } },
      timeattack: { bestScore: 900 },
    };
    const save = parseSave(JSON.stringify(old));
    expect(save.settings).toEqual({ muted: false });
    expect(save.story.unlocked).toBe(4);
    expect(save.timeattack.bestScore).toBe(900);
  });

  it('settings.muted는 boolean일 때만 읽는다', () => {
    const withMuted = (muted: unknown) =>
      parseSave(JSON.stringify({ ...defaultSave(), settings: { muted } })).settings.muted;
    expect(withMuted(true)).toBe(true);
    expect(withMuted(false)).toBe(false);
    expect(withMuted('yes')).toBe(false);
    expect(withMuted(1)).toBe(false);
  });
});

describe('setMuted', () => {
  it('음소거만 바꾸고 원본은 그대로', () => {
    const before = defaultSave();
    const after = setMuted(before, true);
    expect(after.settings.muted).toBe(true);
    expect(before.settings.muted).toBe(false);
    expect(after.story).toBe(before.story);
  });

  it('저장 → 불러오기로 유지된다', () => {
    const save = setMuted(defaultSave(), true);
    expect(parseSave(JSON.stringify(save))).toEqual(save);
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

describe('applyModeResult', () => {
  const story = (
    stageId: number,
    cleared: boolean,
    stars: 0 | 1 | 2 | 3,
    score: number,
  ): ModeResult => ({ kind: 'story', stageId, cleared, stars, score, bonus: 0 });

  it('타임어택 결과 → 최고 점수만 큰 값으로', () => {
    const r = (score: number): ModeResult => ({
      kind: 'timeattack',
      score,
      bestScore: 0,
      newBest: true,
    });
    const a = applyModeResult(defaultSave(), r(900), 10);
    expect(a.timeattack.bestScore).toBe(900);
    expect(applyModeResult(a, r(400), 10).timeattack.bestScore).toBe(900);
  });

  it('스토리 클리어 → 별·점수 기록 + 다음 스테이지 해금', () => {
    const s = applyModeResult(defaultSave(), story(1, true, 2, 6500), 10);
    expect(s.story.unlocked).toBe(2);
    expect(s.story.bestStars[1]).toBe(2);
    expect(s.story.bestScore[1]).toBe(6500);
  });

  it('스토리 실패 → 해금 그대로', () => {
    expect(applyModeResult(defaultSave(), story(1, false, 0, 300), 10).story.unlocked).toBe(1);
  });

  it('마지막 스테이지를 클리어해도 열린 스테이지는 전체 수를 넘지 않는다', () => {
    const s = applyModeResult(defaultSave(), story(10, true, 3, 5000), 10);
    expect(s.story.unlocked).toBe(10);
  });

  it('원본은 바뀌지 않는다', () => {
    const base = defaultSave();
    const snapshot = JSON.stringify(base);
    applyModeResult(base, story(1, true, 3, 1), 10);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
