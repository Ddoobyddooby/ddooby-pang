// 카메라 흔들림 고르기 (PLAN 6.8). Phaser 없는 순수 함수.
// Phaser는 이미 흔들리는 중이면 새 요청을 무시한다. 그래서 약한 흔들림이 먼저 오면 센 흔들림이 묻힌다.
// 지금 흔들림이 끝났거나 새 것이 더 세면 새 것을 force로 시작하고, 아니면 무시한다.

export interface ShakeRequest {
  duration: number;
  intensity: number;
}

/** 지금 흔들리고 있는 것 (endAt = 끝나는 시각, scene.time.now 기준 ms) */
export interface ShakeState {
  intensity: number;
  endAt: number;
}

/** 새 흔들림을 시작해야 하면 그 상태를, 무시하면 null을 돌려준다 */
export function pickShake(
  current: ShakeState | null,
  next: ShakeRequest,
  now: number,
): ShakeState | null {
  const running = current !== null && now < current.endAt;
  if (running && next.intensity <= current.intensity) return null;
  return { intensity: next.intensity, endAt: now + next.duration };
}
