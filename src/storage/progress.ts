// 저장 데이터 (PLAN 7.2). 순수 규칙(parse, record*)과 저장소 어댑터. Phaser와 전역(window)에 의존하지 않는다:
// localStorage는 BootScene이 getItem/setItem을 가진 객체로 넘겨준다.

import { SAVE } from '../config';
import type { ModeResult } from '../modes/GameMode';

export type Stars = 0 | 1 | 2 | 3;

export interface SaveData {
  version: 1;
  story: { unlocked: number; bestStars: Record<number, Stars>; bestScore: Record<number, number> };
  timeattack: { bestScore: number };
  /** 옛 저장값에는 없다. parseSave가 기본값으로 채운다 (version은 1 그대로) */
  settings: { muted: boolean };
}

/** DOM의 Storage와 겹치지 않게 SaveStorage. Capacitor Preferences(비동기)도 같은 모양으로 붙인다 */
export interface SaveStorage {
  load(): Promise<SaveData>;
  save(data: SaveData): Promise<void>;
}

/** localStorage 모양의 최소 인터페이스 (테스트에서 가짜를 넣는다) */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    story: { unlocked: 1, bestStars: {}, bestScore: {} },
    timeattack: { bestScore: 0 },
    settings: { muted: false },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const nonNegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** 없음·깨진 JSON·버전 다름 → 기본값. 빠지거나 잘못된 필드는 그 부분만 기본값으로 채운다 */
export function parseSave(json: string | null): SaveData {
  if (json === null) return defaultSave();
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return defaultSave();
  }
  if (!isRecord(raw) || raw.version !== 1) return defaultSave();

  const save = defaultSave();
  const story = isRecord(raw.story) ? raw.story : {};
  if (Number.isInteger(story.unlocked) && (story.unlocked as number) >= 1) {
    save.story.unlocked = story.unlocked as number;
  }
  if (isRecord(story.bestStars)) {
    for (const [id, stars] of Object.entries(story.bestStars)) {
      if (stars === 0 || stars === 1 || stars === 2 || stars === 3)
        save.story.bestStars[+id] = stars;
    }
  }
  if (isRecord(story.bestScore)) {
    for (const [id, score] of Object.entries(story.bestScore)) {
      if (nonNegative(score)) save.story.bestScore[+id] = score;
    }
  }
  const timeattack = isRecord(raw.timeattack) ? raw.timeattack : {};
  if (nonNegative(timeattack.bestScore)) save.timeattack.bestScore = timeattack.bestScore;
  const settings = isRecord(raw.settings) ? raw.settings : {};
  if (typeof settings.muted === 'boolean') save.settings.muted = settings.muted;
  return save;
}

/** 음소거 설정을 바꾼다. 원본은 바꾸지 않는다 */
export function setMuted(save: SaveData, muted: boolean): SaveData {
  return { ...save, settings: { ...save.settings, muted } };
}

/** 최고 점수는 큰 값만 남긴다. 원본은 바꾸지 않는다 */
export function recordTimeAttack(save: SaveData, score: number): SaveData {
  return {
    ...save,
    timeattack: { bestScore: Math.max(save.timeattack.bestScore, score) },
  };
}

/** 클리어하면 다음 스테이지를 연다. 별·점수는 큰 값만, 이미 더 높은 unlocked는 유지. 원본은 바꾸지 않는다 */
export function recordStory(
  save: SaveData,
  stageId: number,
  { cleared, stars, score }: { cleared: boolean; stars: Stars; score: number },
): SaveData {
  return {
    ...save,
    story: {
      unlocked: cleared ? Math.max(save.story.unlocked, stageId + 1) : save.story.unlocked,
      bestStars: {
        ...save.story.bestStars,
        [stageId]: Math.max(save.story.bestStars[stageId] ?? 0, stars) as Stars,
      },
      bestScore: {
        ...save.story.bestScore,
        [stageId]: Math.max(save.story.bestScore[stageId] ?? 0, score),
      },
    },
  };
}

/**
 * 한 판의 결과를 저장 데이터에 반영한다 (순수). 타임어택은 최고 점수, 스토리는 별·점수·다음 스테이지 해금.
 * 열린 스테이지는 전체 스테이지 수(stageCount)를 넘지 않는다 (10번 클리어해도 11번은 없다)
 */
export function applyModeResult(save: SaveData, result: ModeResult, stageCount: number): SaveData {
  if (result.kind === 'timeattack') return recordTimeAttack(save, result.score);
  const next = recordStory(save, result.stageId, result);
  return {
    ...next,
    story: { ...next.story, unlocked: Math.min(next.story.unlocked, stageCount) },
  };
}

/** localStorage(모양이 같은 객체) 하나의 키에 JSON 통째로 저장한다. 실패해도 게임은 멈추지 않는다 */
export class LocalStorageAdapter implements SaveStorage {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string = SAVE.key,
  ) {}

  load(): Promise<SaveData> {
    let json: string | null = null;
    try {
      json = this.store.getItem(this.key);
    } catch (error) {
      console.warn('[save] 불러오기 실패, 기본값으로 시작', error);
    }
    return Promise.resolve(parseSave(json));
  }

  save(data: SaveData): Promise<void> {
    try {
      this.store.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      console.warn('[save] 저장 실패 (용량·시크릿 모드), 계속 진행', error);
    }
    return Promise.resolve();
  }
}
