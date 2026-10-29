import type Phaser from 'phaser';

/** 트윈을 Promise로 감싼다. 대상이 없거나 시간이 0이면 바로 끝난다 */
export function tween(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> {
  const targets = config.targets;
  const empty = Array.isArray(targets) && targets.length === 0;
  if (empty || !config.duration) {
    return Promise.resolve();
  }
  return new Promise((resolve) => scene.tweens.add({ ...config, onComplete: () => resolve() }));
}
