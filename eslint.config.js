import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'android/', '.omc/', '.playwright-mcp/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  // core는 순수 TS: 렌더러, DOM, 비결정적 랜덤에 의존하지 않는다 (PLAN 1, 3절)
  {
    files: ['src/core/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'core는 Phaser를 import하지 않는다.' }],
          patterns: [
            {
              group: ['**/view', '**/view/**', '**/scenes', '**/scenes/**'],
              message: 'core는 view / scenes에 의존하지 않는다.',
            },
            {
              group: ['**/modes/**', '**/data/**', '**/storage/**'],
              message: 'core는 다른 계층에 의존하지 않는다.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '랜덤은 core/rng.ts의 seed RNG만 쓴다.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core에서 DOM을 쓰지 않는다.' },
        { name: 'document', message: 'core에서 DOM을 쓰지 않는다.' },
      ],
    },
  },
  // modes도 core처럼 순수 TS: core와 config에만 의존한다 (PLAN 5절)
  {
    files: ['src/modes/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'modes는 Phaser를 import하지 않는다.' }],
          patterns: [
            {
              group: ['**/view', '**/view/**', '**/scenes', '**/scenes/**'],
              message: 'modes는 view / scenes에 의존하지 않는다.',
            },
            {
              group: ['**/data/**', '**/storage/**'],
              message: 'modes는 core와 config에만 의존한다.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '랜덤은 core/rng.ts의 seed RNG만 쓴다.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'modes에서 DOM을 쓰지 않는다.' },
        { name: 'document', message: 'modes에서 DOM을 쓰지 않는다.' },
      ],
    },
  },
  // data도 순수 TS: core와 config에만 의존한다 (PLAN 7.1)
  {
    files: ['src/data/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'data는 Phaser를 import하지 않는다.' }],
          patterns: [
            {
              group: ['**/view', '**/view/**', '**/scenes', '**/scenes/**'],
              message: 'data는 view / scenes에 의존하지 않는다.',
            },
            {
              group: ['**/modes/**', '**/storage/**'],
              message: 'data는 core와 config에만 의존한다.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: '랜덤은 core/rng.ts의 seed RNG만 쓴다.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'data에서 DOM을 쓰지 않는다.' },
        { name: 'document', message: 'data에서 DOM을 쓰지 않는다.' },
        { name: 'fetch', message: 'fetch는 data/stageLoader.ts만 쓴다 (W3-02).' },
      ],
    },
  },
  // stageLoader.ts만 fetch를 허용한다 (DOM 제한은 그대로)
  {
    files: ['src/data/stageLoader.ts'],
    languageOptions: { globals: { fetch: 'readonly' } },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'data에서 DOM을 쓰지 않는다.' },
        { name: 'document', message: 'data에서 DOM을 쓰지 않는다.' },
      ],
    },
  },
  // storage도 순수 규칙에 가깝게: Phaser·화면·전역 저장소에 의존하지 않는다. localStorage는 BootScene이 넘겨준다
  {
    files: ['src/storage/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'phaser', message: 'storage는 Phaser를 import하지 않는다.' }],
          patterns: [
            {
              group: ['**/view', '**/view/**', '**/scenes', '**/scenes/**'],
              message: 'storage는 view / scenes에 의존하지 않는다.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'storage는 전역을 직접 만지지 않는다. BootScene이 넘겨준다.' },
        { name: 'document', message: 'storage에서 DOM을 쓰지 않는다.' },
        { name: 'localStorage', message: 'localStorage는 BootScene이 어댑터에 넘겨준다.' },
      ],
    },
  },
  prettier,
);
