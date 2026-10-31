import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CapacitorPreferencesStorage,
  defaultSave,
  recordTimeAttack,
  setMuted,
  type KeyValueStore,
  type PreferencesLike,
} from '../../src/storage/progress';

const KEY = 'test/save';

/** Map에 저장하는 가짜 Preferences. set 호출을 기록한다 */
const fakePrefs = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]]);
  const prefs = {
    data,
    get: vi.fn(async ({ key }: { key: string }) => ({ value: data.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => void data.set(key, value)),
  };
  return prefs satisfies PreferencesLike;
};

const fakeLegacy = (initial?: string): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>(initial === undefined ? [] : [[KEY, initial]]);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('CapacitorPreferencesStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('빈 상태 → 기본값, Preferences에 쓰지 않는다', async () => {
    const prefs = fakePrefs();
    const storage = new CapacitorPreferencesStorage(prefs, fakeLegacy(), KEY);
    expect(await storage.load()).toEqual(defaultSave());
    expect(prefs.set).not.toHaveBeenCalled();
  });

  it('저장 → 다시 불러오면 같은 값', async () => {
    const prefs = fakePrefs();
    const save = setMuted(recordTimeAttack(defaultSave(), 1200), true);
    await new CapacitorPreferencesStorage(prefs, undefined, KEY).save(save);
    expect(await new CapacitorPreferencesStorage(prefs, undefined, KEY).load()).toEqual(save);
  });

  it('Preferences가 비어 있고 localStorage에 값 → 그 값으로 시작 + Preferences로 옮김 + localStorage는 그대로', async () => {
    const old = JSON.stringify(recordTimeAttack(defaultSave(), 900));
    const prefs = fakePrefs();
    const legacy = fakeLegacy(old);
    const loaded = await new CapacitorPreferencesStorage(prefs, legacy, KEY).load();
    expect(loaded.timeattack.bestScore).toBe(900);
    expect(prefs.data.get(KEY)).toBe(old);
    expect(legacy.data.get(KEY)).toBe(old);
  });

  it('Preferences에 값이 있으면 localStorage는 보지 않는다', async () => {
    const prefs = fakePrefs(JSON.stringify(recordTimeAttack(defaultSave(), 500)));
    const legacy = fakeLegacy(JSON.stringify(recordTimeAttack(defaultSave(), 9999)));
    const loaded = await new CapacitorPreferencesStorage(prefs, legacy, KEY).load();
    expect(loaded.timeattack.bestScore).toBe(500);
    expect(prefs.set).not.toHaveBeenCalled();
  });

  it('get·set이 실패해도 load·save는 실패하지 않는다 (경고만)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const broken: PreferencesLike = {
      get: () => Promise.reject(new Error('get')),
      set: () => Promise.reject(new Error('set')),
    };
    const storage = new CapacitorPreferencesStorage(broken, undefined, KEY);
    await expect(storage.load()).resolves.toEqual(defaultSave());
    await expect(storage.save(defaultSave())).resolves.toBeUndefined();
    // get이 실패하면 localStorage 기록으로라도 시작한다
    const legacy = fakeLegacy(JSON.stringify(recordTimeAttack(defaultSave(), 300)));
    const fromLegacy = await new CapacitorPreferencesStorage(broken, legacy, KEY).load();
    expect(fromLegacy.timeattack.bestScore).toBe(300);
    expect(warn).toHaveBeenCalled();
  });

  it('localStorage 접근이 throw해도 기본값으로 시작한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const legacy: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
    };
    const loaded = await new CapacitorPreferencesStorage(fakePrefs(), legacy, KEY).load();
    expect(loaded).toEqual(defaultSave());
  });

  it('연달아 두 번 저장하면(첫 번째가 늦게 끝나도) 마지막 값이 남는다', async () => {
    const data = new Map<string, string>();
    let releaseFirst!: () => void;
    let calls = 0;
    const prefs: PreferencesLike = {
      get: async ({ key }) => ({ value: data.get(key) ?? null }),
      set: ({ key, value }) => {
        calls++;
        if (calls === 1) {
          return new Promise<void>((resolve) => {
            releaseFirst = () => {
              data.set(key, value);
              resolve();
            };
          });
        }
        data.set(key, value);
        return Promise.resolve();
      },
    };
    const storage = new CapacitorPreferencesStorage(prefs, undefined, KEY);
    const first = storage.save(defaultSave());
    const second = storage.save(setMuted(defaultSave(), true));
    await Promise.resolve();
    expect(calls).toBe(1); // 두 번째는 첫 번째가 끝나기를 기다린다
    releaseFirst();
    await Promise.all([first, second]);
    expect(calls).toBe(2);
    expect(JSON.parse(data.get(KEY)!).settings.muted).toBe(true);
  });

  it('앞 저장이 실패해도 다음 저장은 진행된다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const data = new Map<string, string>();
    let calls = 0;
    const prefs: PreferencesLike = {
      get: async ({ key }) => ({ value: data.get(key) ?? null }),
      set: async ({ key, value }) => {
        if (++calls === 1) throw new Error('first');
        data.set(key, value);
      },
    };
    const storage = new CapacitorPreferencesStorage(prefs, undefined, KEY);
    void storage.save(defaultSave());
    await storage.save(setMuted(defaultSave(), true));
    expect(JSON.parse(data.get(KEY)!).settings.muted).toBe(true);
  });
});
