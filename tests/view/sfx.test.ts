import { describe, expect, it } from 'vitest';
import { SOUND } from '../../src/config';
import { sfxKey, sfxRate, voiceFor } from '../../src/view/Sfx';

describe('sfxRate', () => {
  it('단계 1은 원래 높이', () => {
    expect(sfxRate(1)).toBe(1);
  });

  it('단계가 오를수록 음이 높아진다', () => {
    const rates = [1, 2, 3, 4, 5].map(sfxRate);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]!);
  });

  it('상한에서 멈추고, 0 이하는 단계 1로 본다', () => {
    const last = SOUND.matchRateByLevel[SOUND.matchRateByLevel.length - 1];
    expect(sfxRate(9)).toBe(last);
    expect(sfxRate(0)).toBe(1);
    expect(sfxRate(-3)).toBe(1);
  });
});

describe('voiceFor', () => {
  it.each([
    [1, null],
    [2, 'voice1'],
    [3, 'voice2'],
    [4, 'voice3'],
    [5, 'voice4'],
    [6, null],
    [7, null],
    [0, null],
  ])('단계 %i → %s', (level, voice) => {
    expect(voiceFor(level)).toBe(voice);
  });

  it('목소리는 모두 효과음 목록에 있다', () => {
    for (const voice of Object.values(SOUND.voiceByLevel))
      expect(SOUND.effects).toHaveProperty(voice!);
  });
});

describe('SOUND', () => {
  it('볼륨은 0~1, 파일은 확장자 없는 이름, 키는 이름마다 다르다', () => {
    const entries = Object.entries(SOUND.effects);
    for (const [, { file, volume }] of entries) {
      expect(volume).toBeGreaterThan(0);
      expect(volume).toBeLessThanOrEqual(1);
      expect(file).toMatch(/^([a-z]+\/)?[a-z0-9]+$/);
    }
    const keys = entries.map(([name]) => sfxKey(name as keyof typeof SOUND.effects));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('형식은 ogg 먼저, iOS용 m4a 다음', () => {
    expect(SOUND.formats).toEqual(['ogg', 'm4a']);
  });
});
