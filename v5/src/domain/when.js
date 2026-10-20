/* domain/when — 말로 쓴 날짜 읽기("내일", "다음 주 화요일", "10월 3일" …). v4 parseWhen의 날짜 부분만 옮겼다. */
import { addD, parseD, ymd, weekStart } from '../core/date.js';

const WDK = '일월화수목금토';
const nextWd = (w, from, strict) => { const d = parseD(from); let k = (w - d.getDay() + 7) % 7; if (strict && k === 0) k = 7; d.setDate(d.getDate() + k); return ymd(d); };

/* 반환: { date: 'YYYY-MM-DD' 또는 '', rest: 날짜 표현을 뺀 글 } */
export function parseWhen(src, T) {
  let s = ' ' + (src || '') + ' ', date = '', m;
  const cut = re => { const x = s.match(re); if (x) s = s.replace(x[0], ' '); return x; };
  if (cut(/\s오늘(까지)?(\s|$)/)) date = T;
  else if (cut(/\s내일(까지)?(\s|$)/)) date = addD(T, 1);
  else if (cut(/\s모레(까지)?(\s|$)/)) date = addD(T, 2);
  else if (cut(/\s글피(까지)?(\s|$)/)) date = addD(T, 3);
  else if ((m = cut(/\s(다음\s?주|담주)\s*([일월화수목금토])요일(까지)?\s?/))) date = addD(weekStart(addD(T, 7)), (WDK.indexOf(m[2]) + 6) % 7);
  else if (cut(/\s(다음\s?주|담주)(\s|$)/)) date = weekStart(addD(T, 7));
  else if ((m = cut(/\s이번\s?주\s*([일월화수목금토])요일(까지)?\s?/))) { date = addD(weekStart(T), (WDK.indexOf(m[1]) + 6) % 7); if (date < T) date = addD(date, 7); }
  else if (cut(/\s주말(까지)?(\s|$)/)) date = nextWd(6, T);
  else if ((m = cut(/\s([일월화수목금토])요일(까지)?\s?/))) date = nextWd(WDK.indexOf(m[1]), T);
  else if ((m = cut(/\s(\d{1,3})\s*일\s*(후|뒤)\s?/))) date = addD(T, +m[1]);
  else if ((m = cut(/\s(\d{1,2})\s*주\s*(후|뒤)\s?/))) date = addD(T, 7 * m[1]);
  else if ((m = cut(/\s다음\s?달\s*(\d{1,2})일(까지)?\s?/))) { const d = parseD(T); date = ymd(new Date(d.getFullYear(), d.getMonth() + 1, +m[1])); }
  else if ((m = cut(/\s(\d{1,2})월\s*(\d{1,2})일(까지)?\s?/))) { const d = parseD(T); const x = new Date(d.getFullYear(), +m[1] - 1, +m[2]); if (ymd(x) < T) x.setFullYear(x.getFullYear() + 1); date = ymd(x); }
  else if ((m = cut(/\s(\d{1,2})\/(\d{1,2})(\s|$)/))) { const d = parseD(T); const x = new Date(d.getFullYear(), +m[1] - 1, +m[2]); if (ymd(x) < T) x.setFullYear(x.getFullYear() + 1); date = ymd(x); }
  else if ((m = cut(/\s(\d{1,2})일(까지)?(\s|$)/))) { const d = parseD(T); let x = new Date(d.getFullYear(), d.getMonth(), +m[1]); if (ymd(x) < T) x = new Date(d.getFullYear(), d.getMonth() + 1, +m[1]); date = ymd(x); }
  return { date, rest: s.replace(/\s+/g, ' ').trim() };
}
