/* domain/goals — 목표 문서 { list:[] }. v4 모양(lv 기간 단계, per 기간 키, tasks 단계, kind) 그대로. 순수 계산. */
import { arr } from '../core/util.js';
import { parseD, ymd, addD, weekStart, pad } from '../core/date.js';

export const LV = [['w', '1주'], ['m', '1달'], ['q', '3개월'], ['h', '6개월'], ['y', '1년']];
export const goalTitle = g => String((g && (g.title || g.text)) || '');
export const goalsOf = doc => arr(doc && doc.list);

export function perKey(lv, date) {
  const d = parseD(date), y = d.getFullYear(), m = d.getMonth();
  return lv === 'y' ? '' + y : lv === 'h' ? `${y}-H${m < 6 ? 1 : 2}` : lv === 'q' ? `${y}-Q${Math.floor(m / 3) + 1}` : lv === 'm' ? `${y}-${pad(m + 1)}` : weekStart(date);
}
const lastD = (y, m) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
export function perRange(lv, per) {
  if (!per) return null;
  if (lv === 'y') return [per + '-01-01', per + '-12-31'];
  if (lv === 'h') { const y = per.slice(0, 4); return per.endsWith('1') ? [y + '-01-01', y + '-06-30'] : [y + '-07-01', y + '-12-31']; }
  if (lv === 'q') { const y = +per.slice(0, 4), q = +per.slice(-1); return [`${y}-${pad(q * 3 - 2)}-01`, lastD(y, q * 3)]; }
  if (lv === 'm') { const [y, m] = per.split('-').map(Number); return [per + '-01', lastD(y, m)]; }
  if (lv === 'w') return [per, addD(per, 6)];
  return null;
}
export function perLabel(lv, k) {
  if (!k || lv === 'S') return '기한 없음';
  if (lv === 'y') return k + '년';
  if (lv === 'h') return `${k.slice(0, 4)} ${k.endsWith('1') ? '상반기' : '하반기'}`;
  if (lv === 'q') return `${k.slice(0, 4)} ${k.slice(-1)}분기`;
  if (lv === 'm') return `${k.slice(0, 4)}년 ${+k.slice(5)}월`;
  return `${+k.slice(5, 7)}월 ${+k.slice(8)}일 주`;
}
/* 지금 보아야 하는 목표인가: 기한 없음이거나 오늘이 그 기간 안 */
export function isCurrent(g, today) { const r = perRange(g.lv, g.per); return !r || (r[0] <= today && today <= r[1]); }

const nf = v => { const x = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(x) ? x : null; };
/* 진행률 0~1: 달성 표시 > 수치 > 습관 실천률 > 단계 > 하위 목표 평균 */
export function progress(g, list, all, today, seen = new Set()) {
  if (!g || seen.has(g.id)) return 0; seen.add(g.id);
  if (g.done) return 1;
  const kind = g.kind || 'proj';
  if (kind === 'num') { const t = nf(g.tgt), c = nf(g.cur), a = nf(g.n0); if (t != null && c != null) return Math.max(0, Math.min(1, a != null && a !== t ? (c - a) / (t - a) : t ? c / t : 0)); }
  if (kind === 'habit' && g.hid) {
    const r = perRange(g.lv, g.per); if (r) {
      const end = r[1] < today ? r[1] : today; if (end < r[0]) return 0;
      let done = 0, days = 0; for (let d = r[0]; d <= end; d = addD(d, 1)) { days++; if (all && all.get(d) && all.get(d).done && all.get(d).done['habit:' + g.hid]) done++; }
      return days ? done / days : 0;
    }
  }
  const steps = arr(g.tasks);
  const kids = list.filter(x => x.parent === g.id);
  const parts = [...steps.map(s => (s.done || +s.pct === 100 ? 1 : 0)), ...kids.map(k => progress(k, list, all, today, seen))];
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}
export const pct = p => Math.round(p * 100);
