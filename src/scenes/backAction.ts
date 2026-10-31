// Android 뒤로 가기 → 할 일 (PLAN 7.3 W4-07: 화면별로 한 단계 뒤로). Phaser·Capacitor 없는 순수 함수.

export type BackAction = 'pause' | 'resume' | 'exit' | 'none' | { go: 'Menu' | 'StageMap' };

/**
 * activeKeys = 지금 돌고 있는 씬 키 (멈춘 씬은 빠진다: 일시정지 중이면 Game 없이 Pause만).
 * resultKind = 결과 화면이면 스토리/경쟁
 */
export function backAction(
  activeKeys: readonly string[],
  ctx: { resultKind?: 'story' | 'timeattack' } = {},
): BackAction {
  if (activeKeys.includes('Pause')) return 'resume';
  if (activeKeys.includes('Game')) return 'pause';
  if (activeKeys.includes('Result'))
    return { go: ctx.resultKind === 'story' ? 'StageMap' : 'Menu' };
  if (activeKeys.includes('StageMap')) return { go: 'Menu' };
  if (activeKeys.includes('Menu')) return 'exit';
  return 'none'; // Boot(불러오는 중) 등
}
