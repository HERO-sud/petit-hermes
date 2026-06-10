// 全JSファイルの構文チェック（ESM）
import { execFileSync } from 'node:child_process';
import { globSync } from 'node:fs';

const files = [
  ...globSync('src/**/*.js'),
  ...globSync('tools/**/*.mjs'),
];
let fail = 0;
for (const f of files) {
  try {
    execFileSync('node', ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    console.error(`SYNTAX ERROR: ${f}\n${e.stderr}`);
    fail = 1;
  }
}
console.log(fail ? 'NG' : `OK (${files.length} files)`);
process.exit(fail);
