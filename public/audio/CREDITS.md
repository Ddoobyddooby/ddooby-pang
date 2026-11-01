# 효과음 출처

모두 Kenney(www.kenney.nl)의 무료 에셋이고 라이선스는 **CC0 1.0** (Creative Commons Zero, http://creativecommons.org/publicdomain/zero/1.0/)다. 출처 표시 의무는 없지만 기록해 둔다.

| 파일 | 원본 팩 | 원본 파일 | 쓰는 곳 |
|---|---|---|---|
| `swap.ogg` | Interface Sounds 1.0 | `Audio/drop_002.ogg` | 유효 스왑 |
| `bad.ogg` | Interface Sounds 1.0 | `Audio/back_002.ogg` | 되돌아가는 스왑 |
| `match.ogg` | Interface Sounds 1.0 | `Audio/glass_002.ogg` | 매치 (연쇄 단계마다 재생 속도를 올려 음이 높아짐) |
| `special.ogg` | Interface Sounds 1.0 | `Audio/maximize_006.ogg` | 특수 블록 발동 |
| `clear.ogg` | Interface Sounds 1.0 | `Audio/confirmation_004.ogg` | 클리어 / 경쟁 결과 |
| `fail.ogg` | Interface Sounds 1.0 | `Audio/minimize_006.ogg` | 실패 |
| `button.ogg` | UI Audio (UI SFX Set) | `Audio/click1.ogg` | 버튼 |
| `star.ogg` | Interface Sounds 1.0 | `Audio/glass_005.ogg` | 결과 화면 별 하나 찰 때 |

`.ogg`는 이름만 바꾸고 내용은 손대지 않았다. 볼륨과 음 높이는 `src/config.ts`의 `SOUND`에서 맞춘다.

## m4a (아이폰 Safari용, W4-12)

iOS Safari는 Ogg Vorbis를 못 읽을 수 있어 같은 이름의 `.m4a`(AAC)를 같이 둔다. 게임은 `[ogg, m4a]`를 넘기고 브라우저가 재생할 수 있는 첫 번째를 쓴다 (`src/config.ts` `SOUND.formats`).

변환은 macOS 내장 `afconvert`로 `.ogg`에서 바로 만들었다 (무손실 원본은 없다):

```sh
cd public/audio
for f in *.ogg; do afconvert -f m4af -d aac "$f" "${f%.ogg}.m4a"; done
```

`.ogg`를 바꾸면 이 명령으로 `.m4a`도 다시 만든다. ffmpeg가 있으면 `ffmpeg -i swap.ogg -c:a aac swap.m4a`도 된다.
