/* domain/blocks — 시간 블록(계획·실제)의 계산. 입력 배열을 바꾸지 않고 새 배열을 돌려준다. */
import { blockArea } from './taxonomy.js';
import { PILLAR_KEYS } from '../core/schema.js';

export const toMin = hm => { if (!hm) return NaN; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const fromMin = n => { const x = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
export const addMin = (hm, n) => (hm ? fromMin(toMin(hm) + n) : '');
export const snap = (n, step = 10) => Math.round(n / step) * step;

/* 블록의 분 단위 구간. 끝이 시작보다 이르거나 같으면 다음 날로 넘어간 것으로 본다. */
export function span(b) {
  const s = toMin(b.s); if (!Number.isFinite(s)) return null;
  let e = Number.isFinite(toMin(b.e)) ? toMin(b.e) : s + 60;
  if (e <= s) e += 1440;
  return [s, e];
}
export const durMin = b => { const p = span(b); return p ? p[1] - p[0] : 0; };

export const sortBlocks = arr => arr.slice().sort((a, b) => ((a.s || '99') < (b.s || '99') ? -1 : (a.s || '99') > (b.s || '99') ? 1 : 0));

export const newId = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export function addBlock(arr, b) { return sortBlocks([...arr, { id: b.id || newId(), ...b }]); }
export function removeBlock(arr, id) { return arr.filter(b => b.id !== id); }

/* 고치기. 끝시각이 바뀌면 바로 이어 붙어 있던 다음 블록들을 같이 민다(v4와 같은 동작). */
export function updateBlock(arr, id, patch, { chain = true } = {}) {
  const out = arr.map(b => ({ ...b }));
  const i = out.findIndex(b => b.id === id); if (i < 0) return arr;
  const old = { ...out[i] };
  out[i] = { ...old, ...patch };
  if (!out[i].e) out[i].e = addMin(out[i].s, 60);
  if (chain && old.e && out[i].e !== old.e) {
    let po = old.e, pn = out[i].e;
    const sorted = sortBlocks(out); const k = sorted.findIndex(b => b.id === id);
    for (let j = k + 1; j < sorted.length; j++) {
      const nx = out.find(b => b.id === sorted[j].id);
      if (nx.s !== po) break;
      const len = durMin(nx), oe = nx.e;
      nx.s = pn; nx.e = addMin(pn, len); po = oe; pn = nx.e;
    }
  }
  return sortBlocks(out);
}

/* 끌어서 옮기기: 길이는 그대로, 시작만 바꾼다(10분 단위, 하루 안에서) */
export function moveBlock(arr, id, startMin, step = 10) {
  const b = arr.find(x => x.id === id); if (!b) return arr;
  const len = durMin(b) || 60;
  const s = Math.max(0, Math.min(1440 - len, snap(startMin, step)));
  return updateBlock(arr, id, { s: fromMin(s), e: fromMin(s + len) }, { chain: false });
}
/* 끝 조절: 최소 10분 */
export function resizeBlock(arr, id, endMin, step = 10) {
  const b = arr.find(x => x.id === id); if (!b) return arr;
  const s = toMin(b.s); const e = Math.max(s + step, Math.min(1440, snap(endMin, step)));
  return updateBlock(arr, id, { e: fromMin(e) }, { chain: false });
}

/* 겹치는 블록을 나란히 놓기 위한 줄 배정 */
export function layoutLanes(arr) {
  const items = sortBlocks(arr).map(b => ({ b, p: span(b) })).filter(x => x.p);
  const res = new Map(); let group = [], gEnd = -1;
  const flush = () => { const n = group.reduce((m, x) => Math.max(m, x.lane + 1), 1); group.forEach(x => res.set(x.b.id, { lane: x.lane, lanes: n })); group = []; };
  items.forEach(it => {
    if (group.length && it.p[0] >= gEnd) { flush(); gEnd = -1; }
    const used = new Set(group.filter(g => g.p[1] > it.p[0]).map(g => g.lane));
    let lane = 0; while (used.has(lane)) lane++;
    group.push({ ...it, lane }); gEnd = Math.max(gEnd, it.p[1]);
  });
  flush();
  return res;
}

/* 다음 빈 시간: 가장 늦게 끝나는 블록 뒤, 없으면 지금 다음 정시(22시를 넘기지 않음) */
export function nextSlot(arr, nowHM, len = 60) {
  const ends = arr.map(b => span(b)).filter(Boolean).map(p => p[1]).filter(e => e <= 1440);
  let s = ends.length ? Math.max(...ends) : (Number.isFinite(toMin(nowHM)) ? (Math.floor(toMin(nowHM) / 60) + 1) * 60 : 540);
  s = Math.min(s, 22 * 60);
  return { s: fromMin(s), e: fromMin(Math.min(1440, s + len)) };
}

/* 계획 → 실제 */
export const doneIds = day => new Set((day.actual || []).map(b => b.from).filter(Boolean));
export function planToActual(day, ids) {
  const done = doneIds(day), want = ids ? new Set(ids) : null;
  const add = (day.plan || []).filter(p => p.s && p.e && !done.has(p.id) && (!want || want.has(p.id)))
    .map(p => { const { id, rid, ...rest } = p; return { ...rest, id: newId(), from: id }; });
  return { day: { ...day, actual: sortBlocks([...(day.actual || []), ...add]) }, added: add.length };
}
/* 계획대로 했다 취소: 계획에서 만든 실제 블록만 걷어낸다 */
export function undoPlanDone(day, planId) { return { ...day, actual: (day.actual || []).filter(b => b.from !== planId) }; }

/* 지금 / 다음 */
export function nowNext(plan, nowHM) {
  const m = toMin(nowHM); const L = sortBlocks(plan).filter(b => span(b));
  const cur = L.find(b => { const [s, e] = span(b); return s <= m && m < e; }) || null;
  const next = L.find(b => span(b)[0] > m) || null;
  return { cur, next };
}

/* 집계: 기둥별·분류별 분 */
export function minutesBy(blocks, tx) {
  const pil = {}, cat = {}; PILLAR_KEYS.forEach(k => { pil[k] = 0; });
  let other = 0, total = 0;
  blocks.forEach(b => { const d = durMin(b); if (!d) return; total += d; const a = blockArea(tx, b); if (a) pil[a] += d; else other += d; const c = b.cat || ''; cat[c] = (cat[c] || 0) + d; });
  return { pil, cat, other, total };
}
export function compareDay(day, tx) { return { plan: minutesBy(day.plan || [], tx), actual: minutesBy(day.actual || [], tx) }; }

export const hm = n => { const h = Math.floor(n / 60), m = n % 60; return h ? (m ? `${h}시간 ${m}분` : `${h}시간`) : `${m}분`; };
