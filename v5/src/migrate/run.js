/* migrate/run — v4 읽기, v6 백업 가져오기, 변환 실행. 저장소에는 여기서만 쓴다. */
import { K, SCHEMA, APP } from '../core/schema.js';
import { isObj } from '../core/util.js';
import { isDate } from '../core/date.js';
import { migrate } from './v4to5.js';

const V4_DOCS = ['settings', 'goals', 'people', 'budget', 'assets', 'tasks', 'stuff', 'books', 'projects', 'trash'];
const SKIP = k => k.startsWith('v5/') || k.startsWith('photo-') || k.startsWith('secret-') || k === 'fcsound' || k === '_sync';

/* 같은 기기의 v4 IndexedDB 문서를 읽는다(읽기만 한다) */
export async function readV4(adapter) {
  const keys = await adapter.keys();
  const v4 = { days: [], notes: [] };
  for (const k of keys) {
    if (SKIP(k)) continue;
    if (k.startsWith('day:')) { const o = await adapter.get(k); if (o && isDate(o.date)) v4.days.push(o); continue; }
    if (V4_DOCS.includes(k)) { v4[k] = await adapter.get(k); continue; }
    const o = await adapter.get(k);
    if (o && o.kind === 'note') v4.notes.push(o);
  }
  return v4;
}

/* v6 백업 JSON(.json/.txt)을 v4 모양으로 읽는다 */
export function parseBackup(text) {
  let p;
  try { p = JSON.parse(text); } catch (e) { throw new Error('백업 파일의 형식이 맞지 않습니다.'); }
  if (Array.isArray(p)) p = { days: p };
  if (!p || !Array.isArray(p.days)) throw new Error('백업에서 일지(days)를 찾지 못했습니다.');
  if (p.v && p.v > 6) throw new Error('이 앱보다 새로운 백업 형식입니다(v' + p.v + ').');
  return {
    settings: p.settings, goals: p.goals, people: p.people, budget: p.budget, assets: p.assets, tasks: p.tasks,
    stuff: p.stuff, books: p.books, projects: p.projects, trash: p.extra && p.extra.trash,
    notes: Array.isArray(p.notes) ? p.notes : [], days: p.days,
  };
}

export const isMigrated = async adapter => { const m = await adapter.get(K.meta); return !!(m && m.schema >= SCHEMA); };

/* 변환을 실행한다.
   1) 이미 끝났으면 건너뜀  2) v4 원본을 backupSink로 먼저 내보냄(실패하면 중단)  3) v5 문서를 쓴다  4) meta를 맨 마지막에 쓴다
   v4 문서는 지우지 않는다. 중간에 끊겨도 meta가 없으면 다음 실행에서 처음부터 다시 한다(문서 쓰기는 덮어쓰기라 안전). */
export async function runMigration({ adapter, backupSink, source }) {
  if (!source && await isMigrated(adapter)) return { skipped: true };
  const v4 = source || await readV4(adapter);
  const has = v4.days.length || v4.notes.length || v4.settings || v4.goals || v4.tasks || v4.people;
  if (!has) {                                     // 처음 쓰는 기기: 빈 meta만 만든다
    await adapter.put(K.meta, { schema: SCHEMA, migratedAt: Date.now(), report: { empty: true } });
    return { empty: true };
  }
  if (backupSink) await backupSink(JSON.stringify({ app: 'growth-journal', kind: 'v4-raw', exported: new Date().toISOString(), data: v4 }));
  else if (!source) throw new Error('원본 백업을 저장할 곳이 없어 변환을 중단합니다.');
  const { docs, report } = migrate(v4);
  const meta = docs[K.meta]; delete docs[K.meta];
  for (const k of Object.keys(docs)) await adapter.put(k, docs[k]);
  await adapter.put(K.meta, meta);
  return { report };
}

/* 파일 내용을 읽는다. v5 백업이면 그대로, 예전(v6) 백업이면 v5로 변환해서 돌려준다.
   반환: { kind:'v5'|'v6', docs, report? } — 못 읽으면 Error */
export function parseAny(text) {
  let p; try { p = JSON.parse(text); } catch (e) { throw new Error('백업 파일의 형식이 맞지 않습니다.'); }
  if (p && p.app === APP && p.kind === 'v5' && isObj(p.docs)) {
    if (p.v > 5) throw new Error('이 앱보다 새로운 백업 형식입니다(v' + p.v + ').');
    const docs = {}; Object.keys(p.docs).forEach(k => { if (k.startsWith('v5/')) docs[k] = p.docs[k]; });
    return { kind: 'v5', docs };
  }
  if (p && p.app === APP && p.kind === 'v4-raw' && p.data) { const r = migrate(p.data); return { kind: 'v6', docs: r.docs, report: r.report }; }
  const v4 = parseBackup(text), r = migrate(v4);
  return { kind: 'v6', docs: r.docs, report: r.report };
}

