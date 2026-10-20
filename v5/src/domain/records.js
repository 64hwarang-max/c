/* domain/records — 기록 탭이 보여 주는 모음: 하루 노트, 거래, 만남, 책. 모두 날짜 문서·책 문서를 읽어 계산하기만 한다. */
import { arr } from '../core/util.js';
import { PILLARS } from '../core/schema.js';
import { newId } from './blocks.js';

const pilNameR = k => { const p = PILLARS.find(x => x[0] === k); return p ? p[1] : '분류 없음'; };

/* ---------- 노트 (하루 노트 블록 모음, 읽기 전용) ---------- */
export function collectNotes(all) {
  const out = [];
  all.forEach((d, date) => arr(d.notes).forEach(n => out.push({ ...n, date, title: n.title || String(n.txt || '').split('\n')[0] || '(제목 없음)' })));
  return out.sort((a, b) => b.date.localeCompare(a.date) || String(b.hm || '').localeCompare(String(a.hm || '')) || (b.ts || 0) - (a.ts || 0));
}
export function filterNotes(list, { q = '', k = '' } = {}) {
  const w = q.trim().toLowerCase();
  return list.filter(n => (!k || (k === '-' ? !n.k : n.k === k)) && (!w || [n.title, n.txt, n.c, n.s].some(x => String(x || '').toLowerCase().includes(w))));
}
/* 대분류 › 중분류 › 소분류 나무: [{name, count, kids:[{name, count, kids:[{name, notes}]}]}] */
export function groupNotes(list) {
  const root = new Map();
  list.forEach(n => {
    const a = pilNameR(n.k), b = n.c || '(중분류 없음)', c = n.s || '(소분류 없음)';
    if (!root.has(a)) root.set(a, new Map()); const m = root.get(a);
    if (!m.has(b)) m.set(b, new Map()); const s = m.get(b);
    if (!s.has(c)) s.set(c, []); s.get(c).push(n);
  });
  return [...root].map(([name, m]) => ({ name, count: [...m.values()].reduce((x, s) => x + [...s.values()].reduce((y, l) => y + l.length, 0), 0), kids: [...m].map(([n2, s]) => ({ name: n2, count: [...s.values()].reduce((y, l) => y + l.length, 0), kids: [...s].map(([n3, notes]) => ({ name: n3, notes })) })) }));
}
export function groupNotesByDate(list) {
  const m = new Map(); list.forEach(n => { if (!m.has(n.date)) m.set(n.date, []); m.get(n.date).push(n); });
  return [...m].map(([date, notes]) => ({ date, notes }));
}

/* ---------- 재정 (거래는 day.fin에만 있다) ---------- */
export const amtOf = f => { const n = typeof f.amt === 'number' ? f.amt : parseInt(String(f.amt ?? '').replace(/[^\d.-]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
export const kindOf = f => (f.type === '수입' ? 'in' : f.type === '나눔' ? 'give' : 'out');
export function monthFin(all, ym) {
  const rows = []; all.forEach((d, date) => { if (date.startsWith(ym)) arr(d.fin).forEach(f => rows.push({ ...f, date, n: amtOf(f), kd: kindOf(f) })); });
  rows.sort((a, b) => b.date.localeCompare(a.date));
  const sum = { in: 0, out: 0, give: 0 }, cat = new Map();
  rows.forEach(r => { sum[r.kd] += r.n; if (r.kd === 'out') { const c = r.cat || r.item || '기타'; cat.set(c, (cat.get(c) || 0) + r.n); } });
  return { rows, sum, net: sum.in - sum.out - sum.give, cats: [...cat].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n) };
}
export const addMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/* ---------- 만남 ---------- */
export function meetStats(all) {
  const m = new Map();
  all.forEach((d, date) => arr(d.meet).forEach(x => { const who = String(x.who || '').trim() || '(이름 없음)'; if (!m.has(who)) m.set(who, []); m.get(who).push({ ...x, date }); }));
  return [...m].map(([who, list]) => { list.sort((a, b) => b.date.localeCompare(a.date)); return { who, count: list.length, last: list[0].date, follow: list.filter(x => x.follow).length, list }; }).sort((a, b) => b.last.localeCompare(a.last));
}

/* ---------- 책 ---------- */
export const BOOK_ST = [['read', '읽는 중'], ['want', '읽고 싶은'], ['done', '다 읽음']];
export const booksOf = doc => arr(doc && (doc.items || doc.list));
export const bookGroups = doc => { const l = booksOf(doc); return BOOK_ST.map(([k, label]) => ({ k, label, items: l.filter(b => (b.st || 'want') === k).sort((a, b) => (b.updated || b.created || 0) - (a.updated || a.created || 0)) })); };
export function addBook(doc, f, now = Date.now()) {
  const d = doc && typeof doc === 'object' ? doc : {}, st = f.st || 'want', b = { id: 'b' + newId(), title: String(f.title || '').trim(), author: String(f.author || '').trim(), st, reason: '', start: '', end: '', rate: 0, feel: '', act: '', quote: '', sent: [], photos: [], created: now, updated: now };
  const key = Array.isArray(d.items) ? 'items' : Array.isArray(d.list) ? 'list' : 'items';
  return { doc: { ...d, [key]: [...arr(d[key]), b] }, book: b };
}
export function patchBook(doc, id, patch, now = Date.now()) {
  const d = doc || {}, key = Array.isArray(d.items) ? 'items' : 'list';
  return { ...d, [key]: arr(d[key]).map(b => (b.id === id ? { ...b, ...patch, updated: now } : b)) };
}
export function removeBook(doc, id) { const d = doc || {}, key = Array.isArray(d.items) ? 'items' : 'list'; return { ...d, [key]: arr(d[key]).filter(b => b.id !== id) }; }
