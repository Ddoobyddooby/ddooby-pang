# 장식 그림 출처

| 파일 | 원본 | 출처 | 쓰는 곳 |
|---|---|---|---|
| `title-ribbon.png` | `assets/ribbon-src/title-ribbon.png` (1024x320) | Codex(OpenAI) 생성, 2026-11-03 | 게임 화면(GameScene) 제목 뒤 리본 명판 |

- **프롬프트 요약**: 승인된 시안 맨 위의 제목 장식만 독립된 가로형 투명 이미지로 제작. 크림색 구름 명판 + 분홍 리본 끈과 매듭, 바느질 점선 테두리, 도톰한 펠트·종이 질감. 제목은 코드로 쓰므로 명판 가운데를 비움. 글자·별·얼굴·그림자·배경은 제외. 자세한 기록은 `.codex-out/W4-24-image.md`
- 변환: `sips -Z 720`으로 가로 720(720x225)으로 줄임. 화면에는 `DECOR.ribbon.width`(480)로 보인다

```sh
sips -Z 720 assets/ribbon-src/title-ribbon.png --out public/decor/title-ribbon.png
```
