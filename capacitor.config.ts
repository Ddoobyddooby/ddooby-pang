import type { CapacitorConfig } from '@capacitor/cli';

// 앱 ID·이름은 설치 후 바꾸지 않는다 (PLAN 7.3)
const config: CapacitorConfig = {
  appId: 'com.ddooby.pang',
  appName: 'Ddooby-Pang',
  webDir: 'dist',
};

export default config;
