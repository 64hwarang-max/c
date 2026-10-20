/* domain/quick — 빠른 입력 한 줄을 읽어 무엇인지(일정·한 일·지출·감사·만남·노트·할 일) 알아낸다.
   v4 qParse를 옮겼다. 오늘 날짜·지금 시각·직전 계획의 끝 시각은 ctx로 받는다(순수 함수). */
import { addMin } from './blocks.js';
import { parseWhen } from './when.js';
import { pad } from '../core/date.js';

function qHM(ap, h, m1, m2, half) {
  h = +h; const m = +(m1 || m2 || (half ? 30 : 0));
  if (ap && /오후|저녁|밤/.test(ap) && h < 12) h += 12;
  else if (ap && /오전|아침|새벽/.test(ap) && h === 12) h = 0;
  else if (!ap && h >= 1 && h <= 6) h += 12;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}
export function qDur(t) {
  let m = t.match(/(\d+(?:\.\d+)?)\s*시간(?:\s*(\d+)\s*분)?(?:\s*동안)?/);
  if (m) return { min: Math.round(+m[1] * 60 + (+m[2] || 0)), rest: t.replace(m[0], ' ') };
  m = t.match(/(\d+)\s*분(?:\s*동안)?/);
  if (m) return { min: +m[1], rest: t.replace(m[0], ' ') };
  return null;
}
export function qTime(t) {
  const AP = '(오전|오후|아침|저녁|밤|새벽)?\\s*', ONE = '(\\d{1,2})(?::(\\d{2})|\\s*시(?!간)\\s*(?:(\\d{1,2})\\s*분|(반))?)';
  let m = t.match(/(오전|오후|아침|저녁|밤|새벽)?\s*(\d{1,2})\s*(?:~|-|–)\s*(\d{1,2})\s*시(?!간)/);   // "9~11시"
  if (m) {
    const s = qHM(m[1], m[2], '', '', false); let e = qHM(m[1], m[3], '', '', false);
    if (s && e && e <= s) { const h = +e.slice(0, 2); if (h < 12) e = `${pad(h + 12)}:${e.slice(3)}`; }
    if (s && e && e > s) return { s, e, rest: t.replace(m[0], ' ') };
  }
  m = t.match(new RegExp(AP + ONE + '\\s*(?:~|-|–|부터|에서)\\s*' + AP + ONE + '\\s*(?:까지)?'));
  if (m) {
    const s = qHM(m[1], m[2], m[3], m[4], m[5]); let e = qHM(m[6] || m[1], m[7], m[8], m[9], m[10]);
    if (s && e && e <= s && !m[6]) { const [h, mm] = e.split(':').map(Number); if (h < 12) e = `${pad(h + 12)}:${pad(mm)}`; }
    if (s && e) return { s, e, rest: t.replace(m[0], ' ') };
  }
  m = t.match(new RegExp(AP + ONE + '\\s*(?:에|부터)?'));
  if (m) {
    const s = qHM(m[1], m[2], m[3], m[4], m[5]);
    if (s) { let rest = t.replace(m[0], ' '); const d = qDur(rest); if (d) rest = d.rest; return { s, e: addMin(s, d ? d.min : 60), rest }; }
  }
  return null;
}
export function parseAmt(t) {
  const s = String(t).replace(/,/g, '');
  let m = s.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?/); if (m) return Math.round(+m[1] * 10000 + (m[2] ? +m[2] * 1000 : 0));
  m = s.match(/(\d+(?:\.\d+)?)\s*천/); if (m) return Math.round(+m[1] * 1000);
  m = s.match(/(\d{2,})\s*원?/); return m ? +m[1] : 0;
}
const QAMT = /(\d[\d,]*(?:\.\d+)?\s*(?:만\s*)?(?:천\s*)?원|\d+\s*만(?:\s*\d+\s*천)?\s*원?(?=\s|$)|\d+\s*천\s*원?(?=\s|$))/;
const QPAST = /(했다|했음|했어|했고|했습니다|함$|완료|끝냄|끝났|끝남|다녀옴|다녀왔|먹었|봤다|봤음|읽었|마쳤|마침|갔다|갔음|왔다)/;
const qClean = t => t.replace(/\s+/g, ' ').replace(/^[\s,·:]+|[\s,·:]+$/g, '').trim();

export const KINDS = { plan: ['🗓', '일정'], done: ['✅', '한 일'], fin: ['💳', '지출·수입'], grat: ['🙏', '감사'], meet: ['🤝', '만남'], note: ['📝', '노트'], task: ['📋', '할 일'] };

/* ctx: { today, cur(보고 있는 날), nowHM, lastPlanEnd } */
export function parseQuick(raw, ctx) {
  const t0 = (raw || '').trim(); const r = { raw: t0, kind: '', t: t0 };
  if (!t0) return r;
  let t = t0;
  const pm = t.match(/^(일정|할\s*일|지출|수입|감사|만남|메모|노트|한\s*일)\s*[:：]\s*/); let forced = '';
  if (pm) {
    forced = { 일정: 'plan', 지출: 'fin', 수입: 'fin', 감사: 'grat', 만남: 'meet', 메모: 'note', 노트: 'note' }[pm[1].replace(/\s/g, '')] || (/한/.test(pm[1]) ? 'done' : 'task');
    t = t.slice(pm[0].length); if (pm[1] === '수입') r.income = 1;
  }
  const tm = qTime(t), am = t.match(QAMT), past = QPAST.test(t);
  if (am) { r.amt = am[1].replace(/\s/g, ''); r.amtN = parseAmt(r.amt); }
  const strip = x => qClean(am ? x.replace(am[1], ' ') : x);
  if (tm) { r.s = tm.s; r.e = tm.e; r.t = strip(tm.rest); }
  else { const d = qDur(t); if (d) { r.dur = d.min; r.t = strip(d.rest); } else r.t = strip(t); }
  r.t = r.t.replace(/\s*(했다|했음|했어|했습니다|함|완료)$/, '').trim() || r.t;

  const T = ctx.today, cur = ctx.cur || T, nowHM = ctx.nowHM || '12:00';
  const isDone = () => past || cur < T || (cur === T && r.e && r.e <= nowHM);
  let k = forced;
  if (!k && /^감사|감사(하다|합니다|했다|해요|한다)|고마웠|고맙다|고마운/.test(t0)) k = 'grat';
  if (!k && am && !tm) k = 'fin';
  if (!k && !tm && /만났|만남|면담|상담했|통화했|찾아뵘|심방|안부/.test(t0)) k = 'meet';
  if (!k && tm) k = isDone() ? 'done' : 'plan';
  if (!k && (past || r.dur)) k = 'done';
  if (!k && /해야|하기$|사기$|사야|예약|신청|제출|보내기|연락하기|전화하기|챙기기|까지|내일|모레|글피|다음\s*주|이번\s*주|[월화수목금토일]요일|매일|매주|\d+일/.test(t0)) k = 'task';
  if (!k && (t0.length > 40 || /\n/.test(t0))) k = 'note';

  /* 날짜가 들어 있으면 그날의 일정으로 */
  if ((!forced || forced === 'plan') && (!k || k === 'task' || k === 'plan' || k === 'done')) {
    const w = parseWhen(tm ? tm.rest : t, T);
    if (w.date && !/까지/.test(t0)) {
      r.date = w.date; k = 'plan';
      if (!r.s) { r.s = '09:00'; r.e = addMin('09:00', r.dur || 60); r.notime = 1; }
      const tt = strip(w.rest); if (tt) r.t = tt;
      if (r.date === cur) delete r.date;
    }
  }
  r.kind = k || 'task';
  if (r.kind === 'fin' && !r.income && /월급|급여|수입|입금|받았|용돈\s*받|환급|이자|수당/.test(t0)) r.income = 1;
  if (r.kind === 'fin' && /헌금|기부|후원|십일조|나눔/.test(t0)) r.give = 1;
  if (r.kind === 'done' && !r.s) { const d = r.dur || 30; const n = cur === T ? nowHM : '12:30'; r.e = n; r.s = addMin(n, -d); if (r.s > r.e) r.s = '00:00'; }
  if (r.kind === 'plan' && !r.s) { r.s = ctx.lastPlanEnd || `${pad(Math.min(22, +nowHM.slice(0, 2) + 1))}:00`; r.e = addMin(r.s, r.dur || 60); }
  return r;
}

/* 사용자가 칩으로 종류를 바꿨을 때 시간을 채워 준다 */
export function withKind(r, kind, ctx) {
  const x = { ...r, kind, user: 1 }, nowHM = ctx.nowHM || '12:00', cur = ctx.cur || ctx.today;
  if (kind === 'done' && !x.s) { x.e = cur === ctx.today ? nowHM : '12:30'; x.s = addMin(x.e, -(x.dur || 30)); }
  if (kind === 'plan' && !x.s) { x.s = ctx.lastPlanEnd || `${pad(Math.min(22, +nowHM.slice(0, 2) + 1))}:00`; x.e = addMin(x.s, x.dur || 60); }
  return x;
}
