// `npm run poc:deno` 전용 vitest 설정: Node 쪽 로그·점수 JSON을 만든다 (일반 `npm test`에는 들어가지 않는다)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['scripts/server-poc/**/*.poc.ts'], silent: false, testTimeout: 60000 },
});
