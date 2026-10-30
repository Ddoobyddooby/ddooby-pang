// BootScene이 불러온 스테이지 데이터를 씬들이 나눠 쓰는 자리 (scene registry).

import type Phaser from 'phaser';
import type { StageData } from '../data/stageLoader';

const KEY = 'stages';

export function putStages(registry: Phaser.Data.DataManager, data: StageData): void {
  registry.set(KEY, data);
}

/** Boot가 성공해야 다른 씬이 시작되므로 항상 있다. 없으면 버그라서 던진다 */
export function getStages(registry: Phaser.Data.DataManager): StageData {
  const data = registry.get(KEY) as StageData | undefined;
  if (!data) throw new Error('스테이지 데이터가 없다 (BootScene을 거치지 않았다)');
  return data;
}
