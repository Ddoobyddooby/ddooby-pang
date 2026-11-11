# 효과음 출처

모두 Kenney(www.kenney.nl)의 무료 에셋이고 라이선스는 **CC0 1.0** (Creative Commons Zero, http://creativecommons.org/publicdomain/zero/1.0/)다. 출처 표시 의무는 없지만 기록해 둔다.

| 파일 | 원본 팩 | 원본 파일 | 쓰는 곳 |
|---|---|---|---|
| `swap.ogg` | Interface Sounds 1.0 | `Audio/drop_002.ogg` | 유효 스왑 |
| `bad.ogg` | Interface Sounds 1.0 | `Audio/back_002.ogg` | 되돌아가는 스왑 |
| `match.ogg` | Interface Sounds 1.0 | `Audio/glass_002.ogg` | 매치 (연쇄 단계마다 재생 속도를 올려 음이 높아짐) |
| `special.ogg` | Interface Sounds 1.0 | `Audio/maximize_006.ogg` | 특수 블록 발동 |
| `clear.ogg` | Interface Sounds 1.0 | `Audio/confirmation_004.ogg` | 스토리 클리어 |
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

## 배경 음악 (W4-13, V2-W4-04, `music/`)

모두 OpenGameArt의 **CC0** 곡이다 (2026-11-12 각 게시물과 압축 안 readme에서 다시 확인). 원본은 저장소에 넣지 않고 변환한 것만 둔다.
게임 곡은 테마 × 모드마다 다르다 (SPEC 15절, PLAN2 6.8). 곡이 없는 자리(사탕 스토리·경쟁, 바다 경쟁)는 그림책 테마의 같은 모드 곡을 쓴다.

| 파일 | 곡 · 작가 | 원본 | 라이선스 | 쓰는 곳 |
|---|---|---|---|---|
| `music/menu.{ogg,m4a}` | Happy Clappy Loop · OwlishMedia | `HappyClappyLoop.wav` · https://opengameart.org/content/happy-clappy-loop | CC0 | 메뉴·스테이지 지도·랭킹 (모든 테마) |
| `music/story-storybook.{ogg,m4a}` | Cozy Puzzle In-Game 3 · MintoDog | `cozy_puzzle_in-game_3_bpm108.ogg` · https://opengameart.org/content/cozy-puzzle-in-game-3 | CC0 | 그림책 × 스토리 (사탕 × 스토리 대신) |
| `music/timeattack-storybook.{ogg,m4a}` | Children's March Theme · CleytonKauffman | `childrens_march_theme.zip` 안 `Children's March Theme.wav` · https://opengameart.org/content/childrens-march-theme | CC0 (압축 안 `readme.txt`도 CC0) | 그림책 × 경쟁 60초 (사탕·바다 × 경쟁 대신) |
| `music/story-space.{ogg,m4a}` | Iridescent Deep 차분한 버전 루프 · Tsorthan Grove | `iridescent_deep_ogg.7z` 안 `Iridescent Deep - Loop (Alternate).ogg` · https://opengameart.org/content/iridescent-deep | CC0 | 우주 × 스토리 |
| `music/timeattack-space.{ogg,m4a}` | Interstellar Fleet 1 루프 버전 · Zane Little Music | `interstellar_fleet_1.zip` 안 `WAV/Interstellar Fleet 1 [LOOP].wav` · https://opengameart.org/content/interstellar-fleet-1 | CC0 | 우주 × 경쟁 60초 |
| `music/story-ocean.{ogg,m4a}` | Aurora · Trex0n | `aurora.wav` · https://opengameart.org/content/aurora-0 | CC0 | 바다 × 스토리 |

변환 (모노, 44.1kHz. 루프 구간은 자르지 않는다):

```sh
# 1) 모노 16비트 WAV로 풀기 (afconvert는 macOS 내장, Ogg Vorbis도 읽는다). WAV가 들어 있는 압축은 WAV를 쓴다
afconvert -f WAVE -d LEI16@44100 -c 1 cozy_puzzle_in-game_3_bpm108.ogg story-storybook.wav
afconvert -f WAVE -d LEI16@44100 -c 1 "Children's March Theme.wav" timeattack-storybook.wav
afconvert -f WAVE -d LEI16@44100 -c 1 "Iridescent Deep - Loop (Alternate).ogg" story-space.wav
afconvert -f WAVE -d LEI16@44100 -c 1 "Interstellar Fleet 1 [LOOP].wav" timeattack-space.wav
afconvert -f WAVE -d LEI16@44100 -c 1 aurora.wav story-ocean.wav
# 2) 인코딩: ogg는 oggenc(brew install vorbis-tools) 96kbps, m4a는 afconvert 96kbps
oggenc -b 96 -o story-ocean.ogg story-ocean.wav
afconvert -f m4af -d aac -b 96000 story-ocean.wav story-ocean.m4a
#    m4a만 1.5MB를 넘는 두 곡은 비트레이트를 낮췄다: story-storybook 88000, story-space 80000
```

- 앞뒤 무음: 다섯 원본 모두 처음·끝에 무음이 없어(|샘플| > 64가 첫·끝 샘플부터) 자르지 않았다
- 반복 이음새: 디코드한 길이가 두 형식 모두 원본과 샘플 단위로 같다 (Chrome `decodeAudioData`, 2026-11-12).
  menu 769,132 / story-storybook 5,488,000 / timeattack-storybook 2,822,400 / story-space 6,773,760 / timeattack-space 3,907,939 / story-ocean 3,528,000.
  AAC 인코더가 앞에 넣는 무음(priming 2,112)은 `afconvert`가 파일에 길이를 적어 두어 디코더가 잘라 낸다
- 크기: 곡마다 1.5MB 이하 (ogg 0.67~1.26MB, m4a 0.80~1.41MB. 기기는 한 형식만 받는다)

## 경쟁 결과 소리 (W4-22)

모두 **CC0**이다. 사용자가 직접 들어 보고 골랐다 (PLAN 6.15).

| 파일 | 원본 | 손질 | 쓰는 곳 |
|---|---|---|---|
| `newbest.{ogg,m4a}` | OpenGameArt "Win Jingle" `winfretless_0.ogg` | 손대지 않음 (3.8초) | 경쟁 최고 기록 갱신 (축하 곡) |
| `applause.{ogg,m4a}` | OpenGameArt "Applause in a large hall or church" `applause-clapping-church-crowd-immersive.wav` | 5.0~7.5초 구간, 앞 0.05초·뒤 0.8초 페이드, `oggenc -q 4` | 경쟁 최고 기록 갱신 (박수, 축하 곡과 같이) |
| `nobest.{ogg,m4a}` | Kenney "85 Short music jingles" (OpenGameArt `jingleSounds_Kenney.zip`) `jingles_STEEL07.ogg` | 손대지 않음 (1.6초) | 경쟁 최고 기록 못 깸 (아쉬움 곡) |

메인 세션이 ogg·m4a로 변환해 준 파일을 그대로 넣었다. 크기는 `src/config.ts` `SOUND.effects`의 `volume`으로 맞춘다.

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
