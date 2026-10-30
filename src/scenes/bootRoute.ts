// Boot가 끝난 뒤 어느 화면으로 갈지 (스토리 화면 설계 1절). 순수 함수라 테스트한다.

import { previewResult } from './resultText';
import type { GameData, ResultData } from './sceneData';

export type BootRoute =
  { scene: 'Menu' } | { scene: 'Game'; data: GameData } | { scene: 'Result'; data: ResultData };

/** 지금까지 쓰던 개발 주소: 메뉴를 건너뛰고 타임어택 게임으로 바로 간다 */
const TIMEATTACK_KEYS = ['demo', 'seed', 'time', 'specials'];

/**
 * 기본은 메뉴.
 * DEV `?result=N` → 결과 화면 미리보기, DEV `?stage=N` → 스토리 N번 게임,
 * `?demo` `?seed` `?time` `?specials` → 타임어택 게임 (GameScene이 각 옵션을 읽는다)
 */
export function bootRoute(search: string, dev: boolean): BootRoute {
  const params = new URLSearchParams(search);
  if (dev) {
    const preview = previewResult(search);
    if (preview) return { scene: 'Result', data: { result: preview } };
    const stageId = Number(params.get('stage'));
    if (Number.isInteger(stageId) && stageId >= 1) {
      return { scene: 'Game', data: { mode: 'story', stageId } };
    }
  }
  if (TIMEATTACK_KEYS.some((key) => params.has(key))) {
    return { scene: 'Game', data: { mode: 'timeattack' } };
  }
  return { scene: 'Menu' };
}
