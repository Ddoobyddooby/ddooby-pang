# 배경 그림 출처

| 파일 | 원본 | 출처 | 쓰는 곳 |
|---|---|---|---|
| `storybook.jpg` | `assets/background-src/storybook-background-source.png` (1086x1448) | Codex(OpenAI) 생성, 2026-11-03 | 게임 화면(GameScene) 배경 |

- **프롬프트 요약** (원문 기록이 저장소에 없어 결과 그림과 `docs/WORKFLOW.md` 8.3 요청 항목을 바탕으로 적음, 원문 확인 필요): 세로형 모바일 매치-3 게임 배경, A안 "솜사탕 그림책". 종이 그림책·파스텔 질감, 하늘색에서 분홍으로 이어지는 하늘, 구석의 구름과 별, 바닥에 분홍·크림 언덕·막대사탕·컵케이크·과자 집. 가운데는 보드와 UI가 올라가게 비움. 글자 없음, 다른 게임·캐릭터를 닮지 않게
- 같은 때 만든 전체 화면 시안(`assets/design-src/storybook-gameplay-concept.png`)은 참고용이다. 게임에 넣지 않았고 보드·블록은 코드로 그린다 (`docs/WORKFLOW.md` 8.3)
- 변환: Windows PowerShell `System.Drawing`으로 원본 PNG를 크기 그대로 JPEG(품질 85)로 저장 (2.3MB → 238KB)

```powershell
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile((Resolve-Path 'assets/background-src/storybook-background-source.png'))
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)
$img.Save((Join-Path (Get-Location) 'public/backgrounds/storybook.jpg'), $enc, $p); $img.Dispose()
```
