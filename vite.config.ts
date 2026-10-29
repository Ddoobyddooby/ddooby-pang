import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // Capacitor WebView에서 상대 경로로 로드
  server: { host: true, allowedHosts: ['.ts.net'] }, // Tailscale MagicDNS 도메인으로 모바일 접속
  build: { chunkSizeWarningLimit: 1600 }, // Phaser 단일 번들(~1.2MB)
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node', // core는 DOM 없이 돌아야 한다
  },
});
