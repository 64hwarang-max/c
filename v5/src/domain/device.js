/* domain/device — 기기(위젯·알림)에 내보낼 내용을 만든다. 순수 계산이며 기기 호출은 native/ 에서 한다. */
import { arr } from '../core/util.js';
import { addD, parseD } from '../core/date.js';
import { nowNext } from './blocks.js';
import { taskTitle } from './tasks.js';
import { isDone } from './rules.js';

const WK = '일월화수목금토';

/* 오늘 위젯: { date, title, body, foot } — v4 위젯 연결부와 같은 모양 */
export function widgetPayload({ day, tasks, rules, today, nowHM }) {
  const d = parseD(today), L = [];
  const pri = arr(day.pri).filter(p => p && String(p.text || '').trim());
  pri.forEach((p, i) => L.push(`${p.done ? '✔' : (i + 1) + '.'} ${p.text}`));
  const open = arr(tasks && tasks.items).filter(t => !t.done && t.due && t.due <= today).sort((a, b) => a.due.localeCompare(b.due) || (a.time || '').localeCompare(b.time || ''));
  if (open.length) { if (L.length) L.push(''); open.slice(0, 5).forEach(t => L.push(`☐ ${t.time ? t.time + ' ' : ''}${taskTitle(t)}${t.due < today ? ' (지남)' : ''}`)); if (open.length > 5) L.push(`  외 ${open.length - 5}개`); }
  const { cur } = nowNext(arr(day.plan), nowHM);
  if (cur) L.unshift(`▶ 지금 ${cur.s}~${cur.e} ${cur.act || cur.cat || ''}`, '');
  if (!L.length) L.push('오늘 계획이 비어 있습니다. 눌러서 우선순위를 정하십시오.');
  const foot = [], hs = arr(rules).filter(r => r.kind === 'habit');
  if (hs.length) foot.push(`습관 ${hs.filter(r => isDone(day, r.id)).length}/${hs.length}`);
  if (arr(day.notes).length) foot.push(`노트 ${day.notes.length}`);
  const step = day.eval && String(day.eval.step || '').trim(); if (step) foot.push(`👣 ${step.slice(0, 20)}`);
  return { date: today, title: `${d.getMonth() + 1}월 ${d.getDate()}일 (${WK[d.getDay()]})${open.length ? ` · 할 일 ${open.length}` : ''}`, body: L.join('\n'), foot: foot.join(' · ') };
}

/* 알림 아이디: 같은 항목은 늘 같은 번호(1억~2억 대). 다시 맞출 때 이 범위만 지운다. */
export const ID_BASE = 100000000, ID_SPAN = 100000000;
export function notifyId(key) { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ID_BASE + (h % ID_SPAN); }
const at = (date, hm) => { const [y, m, d] = date.split('-').map(Number), [h, mi] = hm.split(':').map(Number); return new Date(y, m - 1, d, h, mi, 0).getTime(); };

/* 알림 목록 — 앞으로 days일 안:
   · 계획 블록: 시작 lead분 전  · 마감 시각이 있는 할 일: 그 시각  · 루틴 알람(켜 둔 것): 알람 시각 */
export function reminders({ getDay, tasks, rules, today, now, days = 2, lead = 5 }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addD(today, i), day = getDay(date) || {}, wd = parseD(date).getDay();
    arr(day.plan).filter(b => b.s).forEach(b => { if (!arr(day.actual).some(a => a.from === b.id)) out.push({ key: `p|${date}|${b.id}`, at: at(date, b.s) - lead * 60000, title: `${b.s} ${b.act || b.cat || '계획'}`, body: `${lead}분 뒤 시작합니다` }); });
    arr(tasks && tasks.items).filter(t => !t.done && t.due === date && t.time).forEach(t => out.push({ key: `t|${t.id}`, at: at(date, t.time), title: taskTitle(t), body: '할 일' }));
    arr(rules).filter(r => r.kind === 'routine' && r.alarm && r.alarm.on && r.alarm.time && arr(r.alarm.days).includes(wd) && !isDone(day, r.id)).forEach(r => out.push({ key: `r|${date}|${r.id}`, at: at(date, r.alarm.time), title: r.name, body: '루틴 시간입니다' }));
  }
  return out.filter(x => x.at > now).sort((a, b) => a.at - b.at).slice(0, 60).map(x => ({ ...x, id: notifyId(x.key) }));
}
