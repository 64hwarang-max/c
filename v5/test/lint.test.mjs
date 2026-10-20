import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lint } from '../tools/lint.mjs';
import { bundle } from '../tools/bundle.mjs';

const tmp = files => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gj5-')); for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); } return d; };

test('현재 src는 구조 검사를 통과한다', () => { assert.deepEqual(lint(path.resolve('src')), []); });
test('MutationObserver·전역 덮어쓰기·setInterval을 잡는다', () => {
  const d = tmp({ 'features/a.js': 'new MutationObserver(()=>{});\nwindow.foo = 1;\nsetInterval(()=>{},10);' });
  assert.equal(lint(d).length, 3);
});
test('주석 속 글자는 잡지 않는다', () => { assert.deepEqual(lint(tmp({ 'features/a.js': '/* MutationObserver 금지 */\n// window.x = 1\nexport const a = 1;' })), []); });
test('domain 은 화면·저장소를 쓸 수 없다', () => {
  const d = tmp({ 'domain/x.js': "import { s } from '../screens/a.js';\nexport const f = () => document.title + store;" });
  assert.ok(lint(d).length >= 2);
});
test('screens 는 어댑터를 직접 만질 수 없다', () => { assert.equal(lint(tmp({ 'screens/a.js': 'adapter.get(1);' })).length, 1); });
test('번들러: 이름이 겹치면 실패로 알린다', () => {
  const d = tmp({ 'main.js': "import { a } from './a.js';\nimport { b } from './b.js';\nconst x = a + b;", 'a.js': 'export const a = 1;\nconst same = 1;', 'b.js': 'export const b = 2;\nconst same = 2;' });
  assert.equal(bundle(path.join(d, 'main.js')).problems.length, 1);
});
test('번들러: 의존 순서대로 이어 붙인다', () => {
  const d = tmp({ 'main.js': "import { b } from './b.js';\nexport const m = b;", 'b.js': "import { a } from './a.js';\nexport const b = a + 1;", 'a.js': 'export const a = 1;' });
  const r = bundle(path.join(d, 'main.js')); assert.deepEqual(r.problems, []);
  assert.equal(new Function(r.code + '\nreturn m;')(), 2);
});
