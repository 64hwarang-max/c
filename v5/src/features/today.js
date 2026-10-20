/* features/today — 오늘 화면이 하는 일(액션). 하루 문서를 읽고 → 바꾸고 → store에 저장한다. 되돌리기는 저장 전 모습으로 돌아간다.
   DOM을 만지지 않는다. 화면은 이 액션만 부르고, 저장되면 store가 'change'를 알린다. */
import { newId, addMin, addBlock, updateBlock, moveBlock, resizeBlock, removeBlock, planToActual, undoPlanDone, sortBlocks } from '../domain/blocks.js';
import { parseQuick, withKind, parseAmt } from '../domain/quick.js';
import { guessBlock } from '../domain/classify.js';
import { areaOfCat } from '../domain/taxonomy.js';
import { autoScores } from '../domain/evaluate.js';
import { clone } from '../core/util.js';
import { K } from '../core/schema.js';

const uid = newId;

/* ctx(): { tx, prefs, people:[이름], today, nowHM } — main이 최신 문서로 채워 준다 */
export function createTodayActions({ store, ctx }) {
  const mutate = (date, fn) => store.lock(async () => {
    const before = await store.loadDay(date);
    const after = fn(clone(before)) || before;
    after.scAuto = autoScores(after, ctx().tx, ctx().rules);   // 자동 초안은 블록이 바뀔 때마다 이 한 곳에서 맞춘다
    await store.saveDay(after);
    return { undo: () => store.saveDay(before) };
  });
  const listKey = kind => (kind === 'plan' ? 'plan' : 'actual');

  /* 블록에 금액이 있으면 그날의 거래(fin)와 한 쌍으로 둔다. 거래는 day.fin 한 곳에만 있다. */
  function syncSpend(day, b) {
    day.fin = (day.fin || []).filter(f => f.bid !== b.id);
    const n = b.amt ? parseAmt(b.amt) : 0;
    if (n) day.fin.push({ id: uid(), bid: b.id, type: '지출', item: b.act || b.cat || '', amt: n, acc: '', bi: '', cat: '', need: '필요', auto: false });
  }
  async function learnCat(act, cat) {
    const t = (act || '').trim(); if (!t || !cat) return;
    const prefs = (await store.get(K.prefs)) || {}; prefs.catLearn = prefs.catLearn || {};
    if (prefs.catLearn[t] === cat) return;
    prefs.catLearn[t] = cat; await store.put(K.prefs, prefs);
  }
  function clean(fields) {
    const b = { ...fields };
    ['act', 'who', 'loc', 'memo', 'sub'].forEach(k => { if (typeof b[k] === 'string') b[k] = b[k].trim(); });
    if (b.s && !b.e) b.e = addMin(b.s, 60);
    return b;
  }

  return {
    load: date => store.loadDay(date),

    addBlock(date, kind, fields) {
      const c = ctx(), b = clean({ id: uid(), cat: '', who: '', ...fields });
      if (!b.cat || !b.who) { const g = guessBlock(b.act, { tx: c.tx, learn: c.prefs.catLearn, people: c.people }); if (!b.cat) b.cat = g.cat; if (!b.who) b.who = g.who; }
      return mutate(date, d => { const k = listKey(kind); d[k] = addBlock(d[k], b); if (k === 'actual') syncSpend(d, b); return d; });
    },
    async editBlock(date, kind, id, patch) {
      const k = listKey(kind), p = clean(patch);
      const r = await mutate(date, d => { d[k] = updateBlock(d[k], id, p); const b = d[k].find(x => x.id === id); if (b && k === 'actual') syncSpend(d, b); return d; });
      if (p.cat) learnCat(p.act, p.cat).catch(() => {});
      return r;
    },
    moveBlock: (date, kind, id, startMin) => mutate(date, d => { const k = listKey(kind); d[k] = moveBlock(d[k], id, startMin); return d; }),
    resizeBlock: (date, kind, id, endMin) => mutate(date, d => { const k = listKey(kind); d[k] = resizeBlock(d[k], id, endMin); return d; }),
    deleteBlock: (date, kind, id) => mutate(date, d => { const k = listKey(kind); d[k] = removeBlock(d[k], id); d.fin = (d.fin || []).filter(f => f.bid !== id); return d; }),

    /* 계획대로 했다: ids가 없으면 아직 안 한 계획 전부 */
    async planDone(date, ids) { let added = 0; const r = await mutate(date, d => { const x = planToActual(d, ids); added = x.added; return x.day; }); return { ...r, added }; },
    planUndo: (date, planId) => mutate(date, d => undoPlanDone(d, planId)),

    setPriority: (date, i, patch) => mutate(date, d => { d.pri = d.pri || []; while (d.pri.length <= i) d.pri.push({ text: '', link: '', done: false }); d.pri[i] = { ...d.pri[i], ...patch }; return d; }),

    /* 빠른 입력. 반환: { ok, msg, undo, date } 또는 { ok:false, msg } */
    preview(text, cur, kind) {
      const c = ctx();
      return this.load(cur).then(day => {
        const lastEnd = sortBlocks((day.plan || []).filter(b => b.e)).slice(-1)[0];
        const pc = { today: c.today, cur, nowHM: c.nowHM, lastPlanEnd: lastEnd ? lastEnd.e : '' };
        const r = parseQuick(text, pc);
        return kind ? withKind(r, kind, pc) : r;
      });
    },
    async apply(r, cur) {
      const c = ctx(), t = r.t || r.raw;
      if (!t && !r.raw) return { ok: false, msg: '입력한 내용이 없습니다.' };
      if (r.kind === 'task') return { ok: false, msg: '할 일은 계획 탭에서 입력합니다. 종류 칩에서 일정이나 노트를 고르면 지금 넣을 수 있습니다.' };
      const date = r.kind === 'plan' && r.date ? r.date : cur;
      const g = guessBlock(t, { tx: c.tx, learn: c.prefs.catLearn, people: c.people });
      let msg = '', res;
      if (r.kind === 'plan' || r.kind === 'done') {
        const kind = r.kind === 'plan' ? 'plan' : 'actual';
        const b = { id: uid(), s: r.s, e: r.e, act: t, cat: g.cat, who: g.who }; if (r.kind === 'done' && r.amt) b.amt = r.amt;
        res = await mutate(date, d => { const k = listKey(kind); d[k] = addBlock(d[k], b); if (k === 'actual') syncSpend(d, b); return d; });
        msg = `${r.kind === 'plan' ? '일정' : '한 일'}에 넣었습니다 · ${r.s}~${r.e} ${t}${r.date ? ` (${r.date.slice(5).replace('-', '.')})` : ''}${r.notime ? ' · 시간을 안 적어 9시에 넣었습니다' : ''}`;
      } else if (r.kind === 'fin') {
        const type = r.income ? '수입' : r.give ? '나눔' : '지출';
        res = await mutate(date, d => { d.fin = [...(d.fin || []), { id: uid(), type, item: t, amt: r.amtN || 0, acc: '', bi: '', cat: '', need: '필요', auto: false }]; return d; });
        msg = `${type} ${(r.amtN || 0).toLocaleString('ko-KR')}원 · ${t}`;
      } else if (r.kind === 'grat') {
        const x = t.replace(/^감사\s*[:：]?\s*/, '') || t;
        res = await mutate(date, d => { const e = d.eval = d.eval || {}; const L = Array.isArray(e.mgrat) ? e.mgrat.slice() : ['', '', '']; const i = L.findIndex(v => !v || !String(v).trim()); if (i >= 0) L[i] = x; else L.push(x); e.mgrat = L; return d; });
        msg = `감사에 넣었습니다 · ${x}`;
      } else if (r.kind === 'meet') {
        res = await mutate(date, d => { d.meet = [...(d.meet || []), { id: uid(), who: g.who || '', what: t, learn: '', follow: false, kind: '교제' }]; return d; });
        msg = `만남에 넣었습니다${g.who ? ' · ' + g.who : ''}`;
      } else {
        const body = (r.raw || '').replace(/^(메모|노트)\s*[:：]\s*/, '');
        res = await mutate(date, d => { d.notes = [...(d.notes || []), { id: 'q' + uid(), ts: Date.now(), hm: c.nowHM, k: '', c: '', s: '', title: body.split('\n')[0].slice(0, 30), txt: body, ln: null }]; return d; });
        msg = `하루 노트에 넣었습니다 · ${body.split('\n')[0].slice(0, 30)}`;
      }
      return { ok: true, msg, undo: res.undo, date };
    },
  };
}

/* 화면이 쓰는 보조: 기둥 이름 */
export const areaFor = (tx, cat) => areaOfCat(tx, cat);
