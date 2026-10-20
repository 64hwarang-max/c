/* domain/rules — 반복 규칙(습관·루틴·주기·돌봄). 하나의 목록 K.rules.list, 완료는 하루 문서 day.done[규칙 id]에만 적는다. */
import { arr } from '../core/util.js';
import { addD, parseD } from '../core/date.js';

export const KIND_LABEL = { habit: '습관', routine: '루틴', cycle: '주기', care: '돌봄', event: '반복 일정' };
export const pillarOfRule = r => (r && r.pillar) || (r && r.kind === 'habit' ? 'habit' : '');
export const rulesOf = doc => arr(doc && doc.list);
export const isDone = (day, id) => !!(day && day.done && day.done[id]);

const UNIT = { d: 1, w: 7, m: 30 };
/* 마지막으로 한 날(date 이전 포함). 반복 완료는 날짜 문서에만 있으므로 거기서 찾는다. */
export function lastDone(all, id, date) {
  let last = '';
  all.forEach((d, k) => { if (k <= date && isDone(d, id) && k > last) last = k; });
  return last;
}
/* 연속 일수(date부터 거슬러). 오늘 아직 안 했으면 어제부터 센다. */
export function streakOf(all, id, date) {
  let d = isDone(all.get(date), id) ? date : addD(date, -1), n = 0;
  while (isDone(all.get(d), id)) { n++; d = addD(d, -1); }
  return n;
}

/* 그 날 해야 하는 규칙: 습관=매일, 루틴=알람 요일, 주기=마지막 한 날로부터 간격이 지났거나 한 적 없음, 돌봄=간격 지정 없으면 매일 */
export function dueRules(rules, date, all) {
  const wd = parseD(date).getDay();
  return rules.filter(r => {
    if (r.kind === 'habit') return true;
    if (r.kind === 'routine') return arr(r.every && r.every.days).includes(wd);
    if (r.kind === 'cycle') {
      const last = lastDone(all, r.id, date) || r.last || '', n = (r.every && r.every.n) || 1, u = UNIT[(r.every && r.every.unit) || 'd'] || 1;
      return !last || last === date || addD(last, n * u) <= date;
    }
    if (r.kind === 'care') return !r.every;
    return false;
  });
}
