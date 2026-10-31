# 앱 아이콘 원본

분홍 배경 + 빨강 말랑이(`normal` 표정) 하나 (PLAN 7.3 W4-07). 그림은 게임 블록과 같은 함수(`src/view/theme/textures.ts`의 `drawBlockOnCanvas`)로 그린다.

| 파일 | 쓰임 |
|---|---|
| `icon-only.png` | 옛 기기용 통짜 아이콘 (배경 + 블록 74%) |
| `icon-foreground.png` | 적응형 아이콘 앞면 (투명 + 블록 70%) |
| `icon-background.png` | 적응형 아이콘 뒷면 (분홍 `THEME.sky.bottom`) |

모두 1024×1024 PNG.

## 다시 만들기

1. `npm run dev` → 브라우저에서 `http://localhost:5173/?icon` (DEV 전용 페이지, `src/dev/appIcon.ts`)
2. 세 링크를 눌러 받은 PNG를 이 폴더에 덮어쓴다
3. `npm run icons` → `android/app/src/main/res/mipmap-*`가 다시 만들어진다 (`@capacitor/assets`)
4. `npm run android:sync` 후 Android Studio에서 ▶

- 블록 크기·색을 바꾸려면 `src/dev/appIcon.ts`의 `BLOCK_RATIO`·`ICON_BACKGROUND`
- `@capacitor/assets`는 앞면에 16.7% 여백(inset)을 넣어 보이는 영역(72dp)에 맞춘다. 그래서 앞면 블록을 70%로 둔다
- 생성기는 `AndroidManifest.xml`을 자기 서식으로 다시 쓴다 (내용은 그대로). 지금 저장된 서식이 그 결과라 다시 돌려도 차이가 생기지 않는다
- 시작 화면은 Android 12+ 기본(아이콘 + 배경색)이고, 배경색은 `android/app/src/main/res/values/splash.xml` (`THEME.sky.top`)
