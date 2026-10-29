// Jua 원본(assets/fonts-src)에서 필요한 글자만 남겨 WOFF2로 만든다. `npm run fonts:subset`
// 범위: 한글 KS X 1001 상용 2,350자 + 기본 라틴 + 자주 쓰는 기호. 새 문구는 대부분 이 안에 들어간다.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import subsetFont from 'subset-font';

const SRC = 'assets/fonts-src/Jua-Regular.ttf';
const OUT = 'public/fonts/Jua-subset.woff2';
const SYMBOLS = '·!?~♥★☆…×「」『』♡※○●△▽◇◆□■→←↑↓♪';

/** KS X 1001 한글 2,350자: EUC-KR 두 바이트 (0xB0A1 ~ 0xC8FE) */
function ksx1001Hangul() {
  const decoder = new TextDecoder('euc-kr');
  let text = '';
  for (let hi = 0xb0; hi <= 0xc8; hi++) {
    for (let lo = 0xa1; lo <= 0xfe; lo++) text += decoder.decode(new Uint8Array([hi, lo]));
  }
  return text;
}

let latin = '';
for (let code = 0x20; code <= 0x7e; code++) latin += String.fromCharCode(code);

const hangul = ksx1001Hangul();
const text = hangul + latin + SYMBOLS;

const source = await readFile(SRC);
const out = await subsetFont(source, text, { targetFormat: 'woff2' });
await mkdir('public/fonts', { recursive: true });
await writeFile(OUT, out);

const before = (await stat(SRC)).size;
console.log(`한글 ${[...hangul].length}자 + 라틴 ${[...latin].length}자 + 기호 ${[...SYMBOLS].length}자`);
console.log(`${SRC} ${(before / 1024).toFixed(0)}KB → ${OUT} ${(out.length / 1024).toFixed(0)}KB`);
