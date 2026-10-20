/* domain/week — 한 주(월~일)의 날짜, 기둥 균형(이번 주 일평균 vs 지난주), 날별 요약. 순수 계산. */
import { PILLAR_KEYS } from '../core/schema.js';
import { addD, weekStart } from '../core/date.js';
import { dayScores, dayXp, hasRecord } from './score.js';
import { durMin } from './blocks.js';

export const weekDates = ws => [0, 1, 2, 3, 4, 5, 6].map(i => addD(ws, i));
export const thisWeek = d => weekStart(d);

/* 기둥별 일평균. 기록 없는 날은 0점으로 센다. 아직 오지 않은 날은 센 날수에서 뺀다. */
function avgOf(all, ws, today) {
  const dates = weekDates(ws).filter(d => d <= today), n = dates.length, sum = {};
  PILLAR_KEYS.forEach(k => { sum[k] = 0; });
  dates.forEach(d => { const sc = dayScores(all.get(d) || {}); PILLAR_KEYS.forEach(k => { sum[k] += sc[k] || 0; }); });
  const out = {}; PILLAR_KEYS.forEach(k => { out[k] = n ? Math.round(sum[k] / n * 10) / 10 : 0; });
  return { avg: out, days: n };
}
export function weekBalance(all, ws, today) {
  const cur = avgOf(all, ws, today), prev = avgOf(all, addD(ws, -7), today), out = {};
  PILLAR_KEYS.forEach(k => { out[k] = { avg: cur.avg[k], prev: prev.avg[k], delta: Math.round((cur.avg[k] - prev.avg[k]) * 10) / 10 }; });
  return { per: out, days: cur.days };
}

/* 가장 약한 기둥(이번 주 평균이 가장 낮은 것) — 다음 주 중점 후보로 보여 줄 때 쓴다 */
export function weakest(bal) {
  return PILLAR_KEYS.slice().sort((a, b) => bal.per[a].avg - bal.per[b].avg || PILLAR_KEYS.indexOf(a) - PILLAR_KEYS.indexOf(b))[0];
}

/* 날별 요약: 계획 수, 한 계획 수, XP, 기록 여부 */
export function daySummary(day, focus) {
  const d = day || { plan: [], actual: [] };
  const done = new Set((d.actual || []).map(b => b.from).filter(Boolean));
  const plan = (d.plan || []).filter(b => b.s);
  return { plan: plan.length, done: plan.filter(b => done.has(b.id)).length, planMin: plan.reduce((a, b) => a + durMin(b), 0), xp: dayXp(d, focus).xp, rec: hasRecord(d) };
}
