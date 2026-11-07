// Edge Function이 쓸 src 코드를 rolldown으로 한 파일씩 묶어 supabase/functions/_shared/에 둔다 (PLAN2 5.8 빌드 복사).
// 타입은 tsc 선언 파일로 옆에 두고, JS 맨 위의 @ts-self-types로 Deno에 알려 준다.
//
//   npm run server:shared          다시 만들어 쓴다
//   npm run server:shared:check    다시 만든 결과가 커밋본과 다르면 exit 1 (CI)
//
// 리플레이 번들(PLAN2 6.4)은 묶은 코드의 sha256 앞 12자를 코어 version(CORE_VERSION)으로 번들 끝에 붙이고,
// 클라이언트가 제출에 넣을 수 있게 src/replay/coreVersion.ts에도 쓴다
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { build } from 'rolldown';
import ts from 'typescript';

interface Target {
  /** 저장소 루트 기준 입력 파일 */
  entry: string;
  /** 저장소 루트 기준 출력 .js. 같은 이름의 .d.ts를 옆에 만든다 */
  out: string;
  /**
   * 선언을 합칠 파일 (entry가 다시 내보내기만 하는 진입점일 때). 서로의 상대 import·re-export는 지우고 이어 붙인다.
   * 없으면 entry 하나의 선언
   */
  declarations?: string[];
  /** 묶은 코드의 sha256 앞 12자를 CORE_VERSION으로 번들 끝에 붙이고 이 파일(.ts)에도 쓴다 */
  versionFile?: string;
}

const TARGETS: Target[] = [
  { entry: 'src/online/nicknameRules.ts', out: 'supabase/functions/_shared/nicknameRules.js' },
  {
    entry: 'src/replay/index.ts',
    out: 'supabase/functions/_shared/replay.js',
    declarations: ['src/replay/replay.ts', 'src/replay/judge.ts', 'src/replay/weekKey.ts'],
    versionFile: 'src/replay/coreVersion.ts',
  },
];

const ROOT = resolve(import.meta.dirname, '../..');

async function bundle(target: Target): Promise<Map<string, string>> {
  const header = `// 자동 생성: npm run server:shared (${target.entry}). 직접 고치지 않는다\n`;
  const result = await build({
    input: resolve(ROOT, target.entry),
    platform: 'neutral',
    write: false,
    output: { format: 'esm' },
  });
  const chunk = result.output[0];
  const dts = basename(target.out).replace(/\.js$/, '.d.ts');
  let js = `${header}// @ts-self-types="./${dts}"\n${chunk.code}`;
  let types = header + declaration(target.entry, target.declarations ?? [target.entry]);
  const files = new Map<string, string>();
  if (target.versionFile) {
    const version = createHash('sha256').update(chunk.code).digest('hex').slice(0, 12);
    js += `\nexport const CORE_VERSION = '${version}';\n`;
    types += `\n/** 코어 version: 이 번들 코드의 sha256 앞 12자 */\nexport declare const CORE_VERSION: string;\n`;
    files.set(
      target.versionFile,
      `// 자동 생성: npm run server:shared (${target.out} 코드의 sha256 앞 12자). 직접 고치지 않는다\n` +
        `export const CORE_VERSION = '${version}';\n`,
    );
  }
  files.set(target.out, js);
  files.set(target.out.replace(/\.js$/, '.d.ts'), types);
  return files;
}

/**
 * 선언(.d.ts). files의 선언을 차례로 이어 붙이고 그 사이의 상대 import·re-export는 지운다.
 * 그 밖의 파일 타입을 참조하면 그 파일도 같이 묶어야 하므로 import가 남으면 실패
 */
function declaration(entry: string, files: string[]): string {
  const file = resolve(ROOT, entry);
  const texts = new Map<string, string>();
  const program = ts.createProgram([file], {
    declaration: true,
    emitDeclarationOnly: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    types: [],
  });
  for (const name of files) {
    program.emit(program.getSourceFile(resolve(ROOT, name)), (out, data) => {
      if (out.endsWith('.d.ts')) texts.set(name, data);
    });
  }
  const local = new Set(files.map((name) => `./${basename(name).replace(/\.ts$/, '')}`));
  const parts = files.map((name) => {
    const text = texts.get(name);
    if (text === undefined) throw new Error(`${name} 선언 파일을 만들지 못했다`);
    // 같이 묶는 파일끼리의 import·re-export는 한 파일 안의 이름이 되므로 지운다
    return text.replace(
      /^(import|export)\s[^;]*?from\s+'([^']+)';\n?/gm,
      (line, _, from: string) => (local.has(from) ? '' : line),
    );
  });
  const text = parts.join('\n');
  if (/^import |^export .* from /m.test(text))
    throw new Error(`${entry} 선언에 다른 파일 참조가 남았다`);
  return text;
}

async function main(): Promise<number> {
  const check = process.argv.includes('--check');
  const files = new Map<string, string>();
  for (const target of TARGETS)
    for (const [path, text] of await bundle(target)) files.set(path, text);

  const stale: string[] = [];
  for (const [path, text] of files) {
    const abs = resolve(ROOT, path);
    let current: string | null = null;
    try {
      current = readFileSync(abs, 'utf8');
    } catch {
      // 아직 없는 파일
    }
    if (current === text) continue;
    if (check) {
      stale.push(path);
    } else {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
      console.log(`썼다: ${path}`);
    }
  }
  if (stale.length > 0) {
    console.error(
      `커밋본이 src와 다르다. npm run server:shared로 다시 만들어 커밋한다:\n  ${stale.join('\n  ')}`,
    );
    return 1;
  }
  if (check) console.log(`server:shared 일치 (${files.size}개 파일)`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(2);
  },
);
