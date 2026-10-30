// BootScene이 불러온 저장 데이터와 저장소를 씬들이 나눠 쓰는 자리 (scene registry).
// 저장소가 없으면(Boot를 거치지 않은 경우) 기본값으로 동작하고 저장은 건너뛴다.

import type Phaser from 'phaser';
import { defaultSave, type SaveData, type SaveStorage } from '../storage/progress';

const SAVE_KEY = 'save';
const STORAGE_KEY = 'saveStorage';

export function putSave(
  registry: Phaser.Data.DataManager,
  storage: SaveStorage,
  save: SaveData,
): void {
  registry.set(STORAGE_KEY, storage);
  registry.set(SAVE_KEY, save);
}

export function getSave(registry: Phaser.Data.DataManager): SaveData {
  return (registry.get(SAVE_KEY) as SaveData | undefined) ?? defaultSave();
}

/** 새 저장 데이터를 registry에 반영하고 저장소에 쓴다 (기다리지 않는다) */
export function commitSave(registry: Phaser.Data.DataManager, save: SaveData): void {
  registry.set(SAVE_KEY, save);
  const storage = registry.get(STORAGE_KEY) as SaveStorage | undefined;
  void storage?.save(save);
}
