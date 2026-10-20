/* domain/score — 점수·XP·레벨·연속 기록. 입력은 기둥 점수 하나뿐이고 나머지는 전부 여기서 계산한다.
   화면은 이 결과를 읽기만 한다. DOM·저장소를 만지지 않는다. */
import { PILLAR_KEYS } from '../core/schema.js';
import { addD, weekStart } from '../core/date.js';

export const FOCUS_MULT = 1.5;    // 그 주의 중점 기둥만 ×1.5

/* 하루의 최종 점수: 직접 매긴 값(scUser) > 저장된 점수(score) > 자동 초안(scAuto). 7기둥만 센다. */
export function dayScores(day) {
  const out = {};
  PILLAR_KEYS.forEach(k => {
    const v = [day.scUser, day.score, day.scAuto].map(s => s && +s[k]).find(x => Number.isFinite(x) && x > 0);
    if (v) out[k] = Math.max(0, Math.min(10, Math.round(v * 10) / 10));
  });
  return out;
}

/* 주 단위 중점 기둥: focus = { '주 시작일(월요일)': '기둥키' } */
export const focusOf = (focus, date) => (focus || {})[weekStart(date)] || '';
export const weightOf = (focus, date, k) => (k === focusOf(focus, date) ? FOCUS_MULT : 1);

/* 하루 XP: 기둥별 (점수 × 가중치). */
export function dayXp(day, focus) {
  const sc = dayScores(day), per = {};
  let total = 0;
  Object.keys(sc).forEach(k => { const x = Math.round(sc[k] * weightOf(focus, day.date, k) * 10) / 10; per[k] = x; total += x; });
  return { xp: Math.round(total * 10) / 10, per };
}

/* 레벨 곡선(잠정): 전체 L레벨 도달에 필요한 누적 XP / 기둥 L레벨 도달에 필요한 누적 XP */
export const needTotal = L => (L <= 1 ? 0 : 25 * (L - 1) * (L + 2));
export const needPillar = L => (L <= 1 ? 0 : 4 * (L - 1) * (L + 2));
function levelOf(xp, need) { let L = 1; while (need(L + 1) <= xp) L++; return L; }
export function levelInfo(xp, need = needTotal) {
  const L = levelOf(xp, need), a = need(L), b = need(L + 1);
  return { level: L, xp, into: Math.round((xp - a) * 10) / 10, span: b - a, toNext: Math.round((b - xp) * 10) / 10, pct: Math.round((xp - a) / (b - a) * 100) };
}

/* 기록이 있는 날인가 (연속 기록 판정용) */
export const hasRecord = d => !!(d && (Object.keys(dayScores(d)).length || (d.actual || []).length || (d.notes || []).length || Object.values(d.done || {}).some(Boolean)));

/* 전체 집계: days는 Map(날짜→day). 반환값 하나에서 전체 레벨·기둥 레벨·연속 기록·오늘 XP가 모두 나온다. */
export function summarize(days, focus, today) {
  const per = {}, pil = {}; PILLAR_KEYS.forEach(k => { pil[k] = 0; });
  let total = 0;
  days.forEach((d, date) => {
    if (date > today) return;
    const r = dayXp(d, focus);
    if (r.xp) per[date] = r.xp;
    total += r.xp; Object.keys(r.per).forEach(k => { pil[k] += r.per[k]; });
  });
  total = Math.round(total * 10) / 10;
  const ok = date => hasRecord(days.get(date));
  let streak = 0, d = today; if (!ok(d)) d = addD(d, -1);
  while (ok(d)) { streak++; d = addD(d, -1); }
  let best = 0, run = 0, prev = '';
  [...days.keys()].sort().forEach(date => { if (date > today || !ok(date)) { run = 0; prev = ''; return; } run = prev && addD(prev, 1) === date ? run + 1 : 1; prev = date; best = Math.max(best, run); });
  const pillars = {}; PILLAR_KEYS.forEach(k => { pillars[k] = Object.assign({ xp: Math.round(pil[k] * 10) / 10 }, levelInfo(pil[k], needPillar)); });
  return {
    total, level: levelInfo(total, needTotal), pillars, streak, best: Math.max(best, streak), perDay: per,
    today: dayXp(days.get(today) || { date: today }, focus),
  };
}

/* 레벨이 올랐는지 비교한다. 알림은 이 결과를 보고 띄운다(함수를 덮어쓰지 않는다). */
export function levelUps(prev, next) {
  const ups = [];
  if (prev && next.level.level > prev.level.level) ups.push({ kind: 'total', level: next.level.level });
  if (prev) PILLAR_KEYS.forEach(k => { if (next.pillars[k].level > prev.pillars[k].level) ups.push({ kind: 'pillar', key: k, level: next.pillars[k].level }); });
  return ups;
}
