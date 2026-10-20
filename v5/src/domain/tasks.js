/* domain/tasks — 할 일 문서 { items:[], lists:[] }. v4 모양을 그대로 쓴다(제목 title, 마감 due, 완료 done …). 순수 함수. */
import { newId } from './blocks.js';
import { arr } from '../core/util.js';
import { addD } from '../core/date.js';


export const taskTitle = t => String((t && (t.title || t.text)) || '');

export function normTasks(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const lists = arr(d.lists).length ? arr(d.lists) : [{ id: 'l1', name: '할 일' }];
  return { ...d, items: arr(d.items), lists };
}

/* 어느 묶음에 속하나: done | over(마감 지남) | today | week(이번 주) | later | none(날짜 없음) */
export function bucket(t, today, ws) {
  if (t.done) return 'done';
  if (!t.due) return 'none';
  if (t.due < today) return 'over';
  if (t.due === today) return 'today';
  if (t.due <= addD(ws, 6)) return 'week';
  return 'later';
}
export const BUCKETS = [['over', '마감 지남'], ['today', '오늘'], ['week', '이번 주'], ['later', '이후'], ['none', '날짜 없음']];

export function groupTasks(doc, today, ws) {
  const g = { over: [], today: [], week: [], later: [], none: [], done: [] };
  normTasks(doc).items.forEach(t => g[bucket(t, today, ws)].push(t));
  const by = (a, b) => (a.due || '9').localeCompare(b.due || '9') || (a.time || '').localeCompare(b.time || '') || (b.prio || 0) - (a.prio || 0) || (a.created || 0) - (b.created || 0);
  Object.keys(g).forEach(k => g[k].sort(by));
  g.done.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return g;
}

export function addTask(doc, f, now = Date.now()) {
  const d = normTasks(doc), t = { id: 't' + newId(), title: String(f.title || '').trim(), list: f.list || d.lists[0].id, subs: [], due: f.due || '', time: f.time || '', loc: '', desc: f.desc || '', rem: [], prio: f.prio || 0, rep: '', photos: [], who: '', done: false, doneAt: null, created: now, log: [] };
  if (f.dk) t.dk = f.dk;
  return { doc: { ...d, items: [...d.items, t] }, task: t };
}
export const patchTask = (doc, id, patch) => { const d = normTasks(doc); return { ...d, items: d.items.map(t => (t.id === id ? { ...t, ...patch } : t)) }; };
export const removeTask = (doc, id) => { const d = normTasks(doc); return { ...d, items: d.items.filter(t => t.id !== id) }; };
export const toggleTask = (doc, id, now = Date.now()) => { const d = normTasks(doc), t = d.items.find(x => x.id === id); return t ? patchTask(d, id, { done: !t.done, doneAt: t.done ? null : now }) : d; };
