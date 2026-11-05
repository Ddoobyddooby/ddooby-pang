# combo.ogg/.m4a 합성 (V2-W1-02). 외부 소리 없이 표준 라이브러리로만 만든다: 올라가는 반짝음 + 낮은 쿵 + 짧은 노이즈.
# 사용: python3 scripts/make-combo-sound.py /tmp/combo.wav  →  oggenc -q 4 -o public/audio/combo.ogg combo.wav
#       afconvert -f m4af -d aac -b 96000 combo.wav public/audio/combo.m4a
import math
import random
import struct
import sys
import wave

RATE = 44100
DUR = 0.75
random.seed(7)
frames = []
phase = 0.0
for i in range(int(RATE * DUR)):
    t = i / RATE
    # 반짝: 0~0.28초 동안 400Hz → 1600Hz로 올라가는 사인, 끝에서 사라진다
    s = 0.0
    if t < 0.28:
        f = 400 + (1600 - 400) * (t / 0.28) ** 2
        phase += 2 * math.pi * f / RATE
        s += 0.35 * math.sin(phase) * (1 - t / 0.28)
    # 쿵: 0.12초부터 90Hz → 50Hz 낮은 소리, 빠르게 줄어든다
    if t >= 0.12:
        u = t - 0.12
        s += 0.8 * math.sin(2 * math.pi * (50 + 40 * math.exp(-u * 12)) * u) * math.exp(-u * 6)
        # 노이즈 팡 (짧게)
        s += 0.3 * (random.random() * 2 - 1) * math.exp(-u * 30)
    # 시작·끝 클릭 방지
    s *= min(1, t / 0.005) * min(1, (DUR - t) / 0.05)
    frames.append(int(max(-1, min(1, s)) * 32000))

with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(struct.pack(f'<{len(frames)}h', *frames))
