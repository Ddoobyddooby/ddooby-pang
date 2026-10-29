import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // Capacitor WebView에서 상대 경로로 로드
  server: { host: true },
  build: { chunkSizeWarningLimit: 1600 }, // Phaser 단일 번들(~1.2MB)
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node', // core는 DOM 없이 돌아야 한다
  },
});
