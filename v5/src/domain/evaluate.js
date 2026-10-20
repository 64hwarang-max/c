/* domain/evaluate — 하루 점수의 자동 초안. 시간 블록(계획 대비 실제)만 근거로 삼는다.
   시간으로 재기 어려운 기둥(재정·마음관리·습관 등)은 초안을 만들지 않고 직접 매기게 둔다. */
import { PILLAR_KEYS } from '../core/schema.js';
import { minutesBy } from './blocks.js';
import { pillarOfRule, isDone } from './rules.js';

export const NO_PLAN_MIN = 30;   // 계획이 없어도 이만큼 했으면 5점 초안

/* 기둥별 근거: { plan분, actual분, score(0~10, 초안 없으면 0) } */
/* rules: 규칙 목록(선택). 습관 규칙은 소속 기둥의 점수 초안이 된다(한 습관 비율). */
export function basis(day, tx, rules) {
  const P = minutesBy(day.plan || [], tx).pil, A = minutesBy(day.actual || [], tx).pil, out = {};
  PILLAR_KEYS.forEach(k => {
    const p = P[k], a = A[k]; let s = 0;
    if (p > 0) s = Math.round(10 * Math.min(1, a / p));
    else if (a >= NO_PLAN_MIN) s = 5;
    out[k] = { plan: p, actual: a, score: s };
  });
  const hab = {};
  (rules || []).filter(r => r.kind === 'habit').forEach(r => { const k = pillarOfRule(r); if (!PILLAR_KEYS.includes(k)) return; hab[k] = hab[k] || { due: 0, done: 0 }; hab[k].due++; if (isDone(day, r.id)) hab[k].done++; });
  Object.keys(hab).forEach(k => { out[k].habDue = hab[k].due; out[k].habDone = hab[k].done; out[k].score = Math.max(out[k].score, Math.round(10 * hab[k].done / hab[k].due)); });
  return out;
}

/* 저장용 초안 { 기둥키: 점수 } — 0점(근거 없음)은 담지 않는다 */
export function autoScores(day, tx, rules) {
  const b = basis(day, tx, rules), o = {};
  PILLAR_KEYS.forEach(k => { if (b[k].score > 0) o[k] = b[k].score; });
  return o;
}
