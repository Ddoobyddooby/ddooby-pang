// `npm run stages:sim` 전용 vitest 설정 (일반 `npm test`에는 들어가지 않는다)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['scripts/sim/**/*.sim.ts'], silent: false },
});
