import { describe, expect, it } from 'vitest';
import { MUSIC } from '../../src/config';
import { musicFor } from '../../src/scenes/musicRules';
import { musicKey, musicTransition, musicUrls } from '../../src/view/Music';

describe('musicFor', () => {
  it('메뉴·지도는 같은 메뉴 곡', () => {
    expect(musicFor('Menu')).toBe('menu');
    expect(musicFor('StageMap')).toBe('menu');
    expect(musicFor('Ranking')).toBe('menu');
  });

  it('게임은 모드 곡', () => {
    expect(musicFor('Game', { mode: 'timeattack' })).toBe('timeattack');
    expect(musicFor('Game', { mode: 'story', stageId: 4 })).toBe('story');
    expect(musicFor('Game')).toBe('timeattack');
  });

  it('결과 화면은 음악 없음', () => {
    expect(musicFor('Result')).toBeNull();
  });
});

describe('musicTransition', () => {
  it('같은 곡이면 다시 시작하지 않고 이어간다 (메뉴 ↔ 지도, 다시하기)', () => {
    expect(musicTransition('menu', 'menu')).toBe('keep');
    expect(musicTransition('story', 'story')).toBe('keep');
  });

  it('다른 곡이면 바꾼다', () => {
    expect(musicTransition('menu', 'timeattack')).toBe('switch');
    expect(musicTransition(null, 'menu')).toBe('switch');
  });

  it('곡 → 없음이면 끝내고, 없음 → 없음이면 아무것도 안 한다', () => {
    expect(musicTransition('timeattack', null)).toBe('stop');
    expect(musicTransition(null, null)).toBe('none');
  });
});

describe('파일', () => {
  it('곡마다 [ogg, m4a] 두 형식, 키는 곡마다 다르다', () => {
    expect(musicUrls('menu')).toEqual(['audio/music/menu.ogg', 'audio/music/menu.m4a']);
    const keys = MUSIC.tracks.map(musicKey);
    expect(new Set(keys).size).toBe(MUSIC.tracks.length);
  });
});
