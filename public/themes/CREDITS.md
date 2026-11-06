# 테마 그림 출처

| 파일 | 원본 | 출처 | 쓰는 곳 |
|---|---|---|---|
| `<테마>/block-0.png` ~ `block-6.png` | `assets/theme-src/<테마>/block-{0..6}.png` (256×256, 투명) | Codex(OpenAI) 생성, 2026-11-05 | 블록 몸통 (`src/view/theme/themes.ts`가 경로·배치를 갖고, `textures.ts`가 얼굴·특수 배지와 함께 굽는다) |
| `<테마>/bg.jpg` | `assets/theme-src/<테마>/bg.png` (1086×1448) | Codex(OpenAI) 생성, 2026-11-05 | 메뉴·지도·게임·결과 배경 |

테마: `candy`(사탕), `space`(우주), `ocean`(바다). 번호: 0 빨강, 1 주황, 2 노랑, 3 초록, 4 파랑, 5 보라, 6 무지개(컬러 블록). 얼굴·글자·로고 없음.

## 프롬프트 요약

- **candy**: 광택 있는 말랑한 젤리 사각형 + 곡선 무지개 띠. 분홍 설탕 언덕, 사탕집과 막대사탕을 위·아래 가장자리에 두고 가운데는 연분홍으로 비운 배경
- **space**: 굴절광과 은은한 내부 빛이 있는 유리 구슬 + 곡선 무지개 띠. 남보라 밤하늘의 별·행성·성운을 위·아래 가장자리에 두고 가운데는 비운 배경
- **ocean**: 윗부분이 뾰족하고 아래가 넓은 바다유리 물방울(우주 구슬과 구별) + 물결 무지개 띠. 수면·햇살·해초·산호·조개를 가장자리에 두고 가운데는 바닷물색으로 비운 배경
- **space·ocean block-0~5 교체본 (2026-11-06, Codex(OpenAI) 생성)**: 색마다 다른 모양으로 교체. 우주 = 혜성·태양·별·UFO·고리 행성·달, 바다 = 게·조개·불가사리·거북·물고기·해파리. 해당 색 계열 단색 테두리(무지개 테두리 없음), 가운데는 코드 얼굴 자리. block-6 무지개는 그대로. 원본 `assets/theme-src/<테마>/block-{0..5}.png`, 자세한 기록은 `.codex-out/V2-W2-07-shapes-image.md` (gitignore, 로컬)
- 공통: 블록은 정면, 같은 크기, 좌상단 광원, 가운데는 코드 얼굴을 위해 단순하게, 투명 배경. 기존 게임·캐릭터·브랜드를 닮지 않게. 자세한 기록은 `.codex-out/V2-W2-06-image.md` (gitignore, 로컬)
- 변환: 블록 PNG는 그대로. 배경은 macOS `sips`로 JPEG(품질 85) 변환

```bash
for t in candy space ocean; do
  sips -s format jpeg -s formatOptions 85 assets/theme-src/$t/bg.png --out public/themes/$t/bg.jpg
done
```
