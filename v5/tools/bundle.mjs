/* 외부 도구 없이 쓰는 번들러: src/ 의 ES 모듈을 의존 순서대로 이어 붙여 한 덩어리 스크립트로 만든다.
   조건: import는 './상대경로.js' 형태, export는 `export const|let|function|class` 형태만 쓴다. 최상위 이름은 모듈 사이에서 겹치면 안 된다(겹치면 실패). */
import fs from 'node:fs';
import path from 'node:path';

const IMPORT = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]\s*;?\s*$/gm;
const EXPORT_DECL = /^export\s+(async\s+function|function|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm;

export function bundle(entry) {
  const order = [], seen = new Set(), tops = new Map(), problems = [];
  const visit = file => {
    file = path.resolve(file);
    if (seen.has(file)) return; seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(IMPORT)) visit(path.resolve(path.dirname(file), m[1]));
    order.push(file);
  };
  visit(entry);
  const parts = order.map(file => {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(IMPORT, '');
    const rel = path.relative(path.dirname(entry), file);
    if (/^\s*export\s*\{/m.test(src) || /^\s*export\s+default/m.test(src)) problems.push(`${rel}: export { } / export default 는 쓸 수 없습니다.`);
    src = src.replace(EXPORT_DECL, (_, kw, name) => `${kw} ${name}`);
    for (const m of src.matchAll(/^(?:async\s+function|function|class|const|let|var)\s+([A-Za-z0-9_$]+)/gm)) {
      if (tops.has(m[1])) problems.push(`${rel}: 최상위 이름 '${m[1]}' 이(가) ${tops.get(m[1])} 와(과) 겹칩니다.`);
      else tops.set(m[1], rel);
    }
    return `/* ===== ${rel} ===== */\n${src}`;
  });
  return { code: parts.join('\n'), files: order, problems };
}
