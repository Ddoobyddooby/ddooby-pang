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

## 배경 음악 (W4-13, `music/`)

모두 OpenGameArt의 **CC0** 곡이다. 원본은 저장소에 넣지 않고 변환한 것만 둔다.

| 파일 | 곡 · 작가 | 원본 | 쓰는 곳 |
|---|---|---|---|
| `music/menu.{ogg,m4a}` | Happy Clappy Loop · OwlishMedia | `HappyClappyLoop.wav` · https://opengameart.org/content/happy-clappy-loop | 메뉴·스테이지 지도 |
| `music/timeattack.{ogg,m4a}` | Happy Vibes · Ruskerdax | `ruskerdax_-_happy_vibes.mp3` · https://opengameart.org/node/160228 | 경쟁 60초 |
| `music/story.{ogg,m4a}` | Two Simple Game Music Loops 중 게임 곡 · qubodup | `levelmusicloop-tigrun.wav` · https://opengameart.org/node/174263 | 스토리 |

변환 (모노 96kbps, 44.1kHz):

```sh
# 1) 모노 16비트 WAV로 풀기 (afconvert는 macOS 내장)
afconvert -f WAVE -d LEI16@44100 -c 1 HappyClappyLoop.wav menu.wav
afconvert -f WAVE -d LEI16@44100 -c 1 ruskerdax_-_happy_vibes.mp3 timeattack.wav
afconvert -f WAVE -d LEI16@44100 -c 1 levelmusicloop-tigrun.wav story.wav
# 2) mp3만 앞뒤 무음 자르기: |샘플| <= 8 인 앞 987·뒤 126 샘플 (약 22ms·3ms). 두 wav 루프는 무음이 없어 그대로
# 3) 인코딩: ogg는 oggenc(brew install vorbis-tools), m4a는 afconvert
oggenc -b 96 -o menu.ogg menu.wav
afconvert -f m4af -d aac -b 96000 menu.wav menu.m4a
```

- macOS `afconvert`는 Ogg Vorbis를 읽을 수만 있고 쓰지 못해서 `.ogg`는 `oggenc`로 만든다
- 반복 이음새: 디코드한 길이가 두 형식 모두 원본 WAV와 샘플 단위로 같다(menu 769,132 / timeattack 2,000,878 / story 1,820,904, Chrome에서 확인). AAC 인코더가 앞에 넣는 무음(priming)은 `afconvert`가 파일에 길이를 적어 두어 디코더가 잘라 낸다
- 크기: ogg 합계 약 1.0MB, m4a 약 1.3MB (기기는 한 형식만 받는다)

## 칭찬 목소리 (W4-15, `voice/`)

가족 녹음, 사용자 제공 (공개 저장소·공개 웹에 올리는 것에 사용자 동의, PLAN 6.9). 원본은 `assets/voice-src/voice1~4.m4a`(아이폰, 48kHz 모노), 앞뒤를 자른 편집본은 `assets/voice-src/trimmed/voice1~4.wav`다.

| 파일 | 쓰는 곳 |
|---|---|
| `voice/voice1.{ogg,m4a}` | 연쇄 2단계 `이안팡!` |
| `voice/voice2.{ogg,m4a}` | 연쇄 3단계 `이서팡!` |
| `voice/voice3.{ogg,m4a}` | 연쇄 4단계 `보라팡!!` |
| `voice/voice4.{ogg,m4a}` | 연쇄 5단계 `사랑해!!!` |

편집본 WAV에서 바로 만들었다 (모노 48kHz 그대로). 크기는 파일을 줄이지 않고 `src/config.ts` `SOUND.effects.voice1~4.volume`으로 맞춘다:

```sh
for i in 1 2 3 4; do
  oggenc -q 4 -o public/audio/voice/voice$i.ogg assets/voice-src/trimmed/voice$i.wav
  afconvert -f m4af -d aac -b 96000 assets/voice-src/trimmed/voice$i.wav public/audio/voice/voice$i.m4a
done
```
