# 배경 그림 출처

| 파일 | 원본 | 출처 | 쓰는 곳 |
|---|---|---|---|
| `storybook.jpg` | `assets/background-src/storybook-background-source.png` (1086x1448) | Codex(OpenAI) 생성, 2026-11-03 | 게임 화면(GameScene) 배경 |

- **프롬프트 요약**: 승인된 A안 전체 시안을 스타일 참고로 사용한 세로형 720×1280 모바일 매치-3 배경 원본. 종이 오리기와 부드러운 구아슈 질감, 하늘색에서 분홍으로 이어지는 솜사탕 하늘, 둥근 구름과 작은 금색 별. 하단 18%에 크림·분홍 언덕, 막대사탕과 컵케이크를 배치하고 중앙 70%는 보드가 올라가도록 비움. 9:16 크롭을 고려하며 보드·격자·블록·UI·글자·기존 게임을 닮은 요소는 제외.
- 같은 때 만든 전체 화면 시안(`assets/design-src/storybook-gameplay-concept.png`)은 참고용이다. 게임에 넣지 않았고 보드·블록은 코드로 그린다 (`docs/WORKFLOW.md` 8.6)
- 변환: Windows PowerShell `System.Drawing`으로 원본 PNG를 크기 그대로 JPEG(품질 85)로 저장 (2.3MB → 238KB)

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path 'assets/background-src/storybook-background-source.png'))
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
$img.Save((Join-Path (Get-Location) 'public/backgrounds/storybook.jpg'), $enc, $p); $img.Dispose()
```
