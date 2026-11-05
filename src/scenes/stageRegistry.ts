// BootScene이 불러온 스테이지 데이터를 씬들이 나눠 쓰는 자리 (scene registry).

import type Phaser from 'phaser';
import type { StageData } from '../data/stageLoader';
import type { StageDef } from '../data/stageSchema';

const KEY = 'stages';
const DEV_STAGE_KEY = 'devStage';

export function putStages(registry: Phaser.Data.DataManager, data: StageData): void {
  registry.set(KEY, data);
}

/** Boot가 성공해야 다른 씬이 시작되므로 항상 있다. 없으면 버그라서 던진다 */
export function getStages(registry: Phaser.Data.DataManager): StageData {
  const data = registry.get(KEY) as StageData | undefined;
  if (!data) throw new Error('스테이지 데이터가 없다 (BootScene을 거치지 않았다)');
  return data;
}

/** DEV ?obstacles 시험 스테이지 (BootScene이 DEV에서만 동적 import로 받아 둔다) */
export function putDevStage(registry: Phaser.Data.DataManager, stage: StageDef): void {
  registry.set(DEV_STAGE_KEY, stage);
}

/** 없으면 undefined (배포 빌드에서는 항상 없다) */
export function getDevStage(registry: Phaser.Data.DataManager): StageDef | undefined {
  return registry.get(DEV_STAGE_KEY) as StageDef | undefined;
}
