/* core/date — 날짜 계산(순수 함수). 'YYYY-MM-DD' 문자열만 쓴다. */
export const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
export const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
/* 오늘은 바꿔 끼울 수 있어야 시험이 된다 */
let clock = () => new Date();
export const setClock = f => { clock = f; };
export const today = () => ymd(clock());
/* 주는 월요일에 시작해 일요일에 끝난다 */
export const weekStart = s => { const d = parseD(s); const w = (d.getDay() + 6) % 7; return addD(s, -w); };
export const weekEnd = s => addD(weekStart(s), 6);
export const mins = (a, b) => { const f = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; }; let r = f(b) - f(a); if (r < 0) r += 1440; return r; };
