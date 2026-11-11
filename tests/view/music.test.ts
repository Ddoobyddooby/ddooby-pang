import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC } from '../../src/config';
import { gameTrack, gameTracksOf, musicFor } from '../../src/scenes/musicRules';
import { musicKey, musicTransition, musicUrls } from '../../src/view/Music';

describe('musicFor', () => {
  it('메뉴·지도·랭킹은 테마와 무관하게 메뉴 곡', () => {
    for (const theme of [undefined, 'storybook', 'candy', 'space', 'ocean', 'nope']) {
      expect(musicFor('Menu', undefined, theme)).toBe('menu');
      expect(musicFor('StageMap', undefined, theme)).toBe('menu');
      expect(musicFor('Ranking', undefined, theme)).toBe('menu');
    }
  });

  const story = { mode: 'story', stageId: 4 } as const;
  const timeattack = { mode: 'timeattack' } as const;

  it('게임은 테마 × 모드 곡 (8칸 모두 다른 곡)', () => {
    const expected = {
      storybook: ['story-storybook', 'timeattack-storybook'],
      candy: ['story-candy', 'timeattack-candy'],
      space: ['story-space', 'timeattack-space'],
      ocean: ['story-ocean', 'timeattack-ocean'],
    } as const;
    const all: string[] = [];
    for (const [theme, [s, t]] of Object.entries(expected)) {
      expect(musicFor('Game', story, theme)).toBe(s);
      expect(musicFor('Game', timeattack, theme)).toBe(t);
      all.push(s, t);
    }
    expect(new Set(all).size).toBe(8);
  });

  it('곡이 빠진 테마는 기본 테마의 같은 모드 곡 (대체 규칙, 테스트용 표)', () => {
    const table = {
      storybook: { story: 'story-storybook', timeattack: 'timeattack-storybook' },
      candy: {},
      space: { story: 'story-space' },
      ocean: { timeattack: 'timeattack-ocean' },
    };
    expect(gameTrack('candy', 'story', table)).toBe('story-storybook');
    expect(gameTrack('candy', 'timeattack', table)).toBe('timeattack-storybook');
    expect(gameTrack('space', 'story', table)).toBe('story-space');
    expect(gameTrack('space', 'timeattack', table)).toBe('timeattack-storybook');
    expect(gameTrack('ocean', 'story', table)).toBe('story-storybook');
    expect(gameTrack('ocean', 'timeattack', table)).toBe('timeattack-ocean');
    expect(gameTrack('nope', 'story', table)).toBe('story-storybook');
  });

  it('테마를 안 주거나 모르는 값이면 기본 테마 곡, 게임 데이터가 없으면 경쟁 곡', () => {
    expect(musicFor('Game', story)).toBe('story-storybook');
    expect(musicFor('Game', story, 'nope')).toBe('story-storybook');
    expect(musicFor('Game')).toBe('timeattack-storybook');
  });

  it('결과 화면은 음악 없음', () => {
    for (const theme of [undefined, 'space'])
      expect(musicFor('Result', undefined, theme)).toBeNull();
  });
});

describe('gameTracksOf', () => {
  it('테마의 게임 곡 두 개', () => {
    expect(gameTracksOf('space')).toEqual(['story-space', 'timeattack-space']);
    expect(gameTracksOf('ocean')).toEqual(['story-ocean', 'timeattack-ocean']);
    expect(gameTracksOf('candy')).toEqual(['story-candy', 'timeattack-candy']);
  });
});

describe('musicTransition', () => {
  it('같은 곡이면 다시 시작하지 않고 이어간다 (메뉴 ↔ 지도, 다시하기)', () => {
    expect(musicTransition('menu', 'menu')).toBe('keep');
    expect(musicTransition('story-space', 'story-space')).toBe('keep');
  });

  it('다른 곡이면 바꾼다', () => {
    expect(musicTransition('menu', 'timeattack-space')).toBe('switch');
    expect(musicTransition(null, 'menu')).toBe('switch');
  });

  it('곡 → 없음이면 끝내고, 없음 → 없음이면 아무것도 안 한다', () => {
    expect(musicTransition('timeattack-space', null)).toBe('stop');
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

describe('데이터 (gameTracks · 파일)', () => {
  const dir = join(process.cwd(), 'public/audio/music');

  it('gameTracks가 가리키는 이름이 모두 tracks에 있다', () => {
    const names: readonly string[] = MUSIC.tracks;
    for (const modes of Object.values(MUSIC.gameTracks)) {
      for (const name of Object.values(modes)) expect(names).toContain(name);
    }
  });

  it('tracks마다 .ogg와 .m4a가 둘 다 있다', () => {
    for (const name of MUSIC.tracks) {
      expect(existsSync(join(dir, `${name}.ogg`)), `${name}.ogg`).toBe(true);
      expect(existsSync(join(dir, `${name}.m4a`)), `${name}.m4a`).toBe(true);
    }
  });

  it('쓰지 않는 음악 파일이 없다', () => {
    const used = new Set(MUSIC.tracks.flatMap((n) => [`${n}.ogg`, `${n}.m4a`]));
    expect(readdirSync(dir).filter((f) => !used.has(f))).toEqual([]);
  });
});
