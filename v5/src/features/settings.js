/* features/settings — 나 탭에서 바꾸는 것: 테마, 분류(K.taxonomy), 사람(K.people), 백업 내보내기·가져오기.
   분류·사람 문서의 주인은 이 파일이다. */
import { K } from '../core/schema.js';
import { clone, arr } from '../core/util.js';
import { newId } from '../domain/blocks.js';
import { defaultTaxonomy } from '../domain/taxonomy.js';
import { makeBackup, planImport } from '../domain/backup.js';
import { parseAny } from '../migrate/run.js';

export const THEMES = [['', '기기 설정 따라가기'], ['light', '밝게'], ['dark', '어둡게']];

export function createSettingsActions({ store }) {
  const edit = (key, fn, empty) => store.lock(async () => {
    const before = await store.get(key), after = fn(clone(before == null ? empty : before));
    await store.put(key, after);
    return { undo: () => (before == null ? store.del(key) : store.put(key, before)) };
  });
  const tax = fn => edit(K.taxonomy, d => { if (!Array.isArray(d.cats) || !d.cats.length) d.cats = defaultTaxonomy().cats; return fn(d) || d; }, defaultTaxonomy());
  const ppl = fn => edit(K.people, d => { const k = Array.isArray(d.items) ? 'items' : 'list'; d[k] = arr(d[k]); return fn(d, k) || d; }, { list: [] });
  const split = s => String(s || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean);

  return {
    setTheme: t => edit(K.prefs, p => { if (t === 'light' || t === 'dark') p.theme = t; else delete p.theme; return p; }, {}),

    /* 기기 연동 켜기·끄기: key는 'widget' | 'remind' */
    setDevice: (key, on) => edit(K.prefs, p => { p.devices = { ...(p.devices || {}), [key]: !!on }; return p; }, {}),

    /* 분류: name(고유) area(기둥 키 또는 '') color subs[] kw 문자열 */
    saveCat: (oldName, f) => tax(d => {
      const c = { name: String(f.name || '').trim(), area: f.area || '', color: f.color || '', subs: Array.isArray(f.subs) ? f.subs : split(f.subs), kw: Array.isArray(f.kw) ? f.kw.join(',') : String(f.kw || '').trim() };
      if (!c.name) return d;
      const i = d.cats.findIndex(x => x.name === oldName);
      if (i >= 0) d.cats[i] = { ...d.cats[i], ...c }; else if (!d.cats.some(x => x.name === c.name)) d.cats.push(c);
      return d;
    }),
    deleteCat: name => tax(d => { d.cats = d.cats.filter(c => c.name !== name); return d; }),

    addPerson: name => ppl((d, k) => { const n = String(name || '').trim(); if (n && !d[k].some(p => p && p.name === n)) d[k].push({ id: 'p' + newId(), name: n, type: '지인', updated: '' }); return d; }),
    deletePerson: id => ppl((d, k) => { d[k] = d[k].filter(p => p.id !== id); return d; }),

    /* ---- 백업 ---- */
    async exportText() {
      const docs = {}; for (const k of await store.keys()) if (k.startsWith('v5/')) docs[k] = await store.get(k);
      return JSON.stringify(makeBackup(docs));
    },
    parse: text => parseAny(text),
    /* 적용: 먼저 지금 상태를 sink로 내보내고(실패하면 중단), 계획대로 쓴다. meta는 맨 마지막. */
    async applyImport(parsed, mode, sink) {
      return store.lock(async () => {
        const existing = {}; for (const k of await store.keys()) if (k.startsWith('v5/')) existing[k] = await store.get(k);
        if (sink) await sink(JSON.stringify(makeBackup(existing)));
        const plan = planImport(existing, parsed.docs, mode);
        for (const k of plan.deletes) await store.adapter.del(k);
        for (const k of Object.keys(plan.writes)) await store.adapter.put(k, plan.writes[k]);
        if (existing[K.meta] == null) await store.adapter.put(K.meta, parsed.docs[K.meta] || { schema: 5, migratedAt: Date.now(), report: { imported: true } });
        return plan.sum;
      });
    },
  };
}
