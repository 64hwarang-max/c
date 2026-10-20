/* migrate/v4to5 — v4 데이터(또는 v6 백업 JSON)를 v5 문서들로 바꾼다. 순수 함수: 입력을 바꾸지 않고 저장소를 만지지 않는다.
   입력 v4 = { settings, goals, people, budget, assets, tasks, books, projects, trash, notes:[], days:[] }
   출력   = { docs: { 키: 값 }, report }                                                               */
import { K, SCHEMA, PILLAR_KEYS, DROPPED_PILLARS, blankDay, normDay } from '../core/schema.js';
import { isDate, ymd } from '../core/date.js';
import { clone, isObj, arr } from '../core/util.js';
const DROP = new Set(DROPPED_PILLARS);

/* v5에서 뺀 기능의 설정 키(읽지 않는다. 원본은 v5/legacy에 남는다) */
const SETTINGS_DROPPED = new Set([
  'bible', 'hide', 'lvl', 'navMap', 'subOrd', 'secOrd', 'navOrd', 'favOrd',
  'stfMv', 'pmdMv', 'tmMv', 'rvMv', 'cyMv', 'workMv', 'wkMv2', 'balMv',
  'xpLv', 'xpPL', 'xpGoalAt', 'xpStreakMs', 'xpStreakAt', 'wt', 'wtGoal',
]);
/* 규칙·분류·중점으로 옮겨 가는 설정 키 */
const SETTINGS_MOVED = new Set(['cats', 'topics', 'majors', 'habits', 'routines', 'cycles', 'pcare', 'planRep', 'wkFocus']);

function convertBlock(b, rep) {
  const x = clone(b);
  if (x && DROP.has(x.area)) { x.area = ''; x.was = 'spirit'; rep.spiritRefs++; }
  return x;
}

function hmOf(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* 하루 문서 변환 */
export function convertDay(o, rep) {
  const src = clone(o), b = blankDay(src.date);
  const used = new Set(['date', 'v']);
  const take = k => { used.add(k); return src[k]; };

  b.plan = arr(take('plan')).map(x => convertBlock(x, rep));
  b.actual = arr(take('time')).map(x => convertBlock(x, rep));
  b.notes = arr(take('dn')).map(x => { const y = clone(x); if (DROP.has(y.k)) { y.k = ''; y.was = 'spirit'; rep.spiritRefs++; } return y; });

  /* 점수: 영성 점수는 읽지 않는다 */
  ['score', 'scUser', 'scAuto'].forEach(f => {
    const s = isObj(take(f)) ? clone(src[f]) : {};
    DROP.forEach(k => { if (k in s) { delete s[k]; rep.spiritScores++; } });
    if (s.temper && !s.fin) s.fin = s.temper;           // v4가 이미 하던 옛 이름 정리
    delete s.temper;
    b[f] = s;
  });

  /* 습관 체크 → 반복 완료 */
  const hab = isObj(take('habits')) ? src.habits : {};
  Object.keys(hab).forEach(id => { if (hab[id]) { b.done['habit:' + id] = true; rep.habitChecks++; } });

  b.runs = arr(take('routines'));
  b.fin = arr(take('fin')); b.meet = arr(take('meet')); b.mis = arr(take('mis')); b.pri = arr(take('pri')); b.photos = arr(take('photos'));

  const pick = (keys) => { const r = {}; keys.forEach(k => { if (k in src) { r[k] = take(k); } }); return r; };
  b.eval = pick(['mgrat', 'great', 'grat', 'wow', 'hard', 'hardDone', 'better', 'step', 'affirm', 'thought', 'verdict', 'ask', 'emo', 'best', 'refl', 'pages']);
  b.body = pick(['sleep', 'meals', 'ex', 'meas', 'sleepq']);

  /* 영성 전용 필드는 읽지 않는다(원본 v4 문서에는 남아 있다) */
  ['word', 'nurture'].forEach(k => { if (k in src) { take(k); rep.spiritFields++; } });

  /* 나머지는 잃지 않도록 rest에 보관한다 */
  Object.keys(src).forEach(k => { if (!used.has(k)) b.rest[k] = src[k]; });
  if (isObj(b.rest.ar)) DROP.forEach(k => { delete b.rest.ar[k]; });
  return normDay(b);
}

/* 따로 쓰던 노트 → 그날 하루 노트의 블록 */
export function noteToBlock(n) {
  const known = new Set(['kind', 'id', 'date', 'topic', 'title', 'body', 'photos', 'created', 'updated', 'area', 'sub', 'maj']);
  const x = {};
  Object.keys(n).forEach(k => { if (!known.has(k)) x[k] = n[k]; });
  return {
    id: n.id, ts: n.created || n.updated || 0, hm: hmOf(n.created || n.updated),
    k: n.area || (n.maj ? 'm:' + n.maj : ''), c: n.topic || '', s: n.sub || '',
    title: n.title || '', txt: n.body || '', photos: arr(n.photos), ln: null, from: 'note', upd: n.updated || 0, x,
  };
}

/* 설정 → 분류 / 반복 규칙 / 중점 / 나머지 설정 */
export function convertSettings(SET, rep) {
  const S = isObj(SET) ? clone(SET) : {};
  const fixArea = o => { if (o && DROP.has(o.area)) { o.area = ''; o.was = 'spirit'; rep.spiritRefs++; } return o; };

  const taxonomy = {
    pillars: PILLAR_KEYS.slice(),
    majors: arr(S.majors).map(fixArea),
    cats: arr(S.cats).map(fixArea),
    topics: arr(S.topics).map(fixArea),
  };

  const rules = [];
  arr(S.habits).forEach(h => rules.push({ id: 'habit:' + h.id, kind: 'habit', name: h.name, hid: h.id, every: { unit: 'd', n: 1 }, src: h }));
  arr(S.routines).forEach(r => rules.push({ id: 'routine:' + r.id, kind: 'routine', name: r.name, items: arr(r.items), alarm: r.alarm || null, every: { unit: 'w', days: (r.alarm && r.alarm.days) || [] }, src: r }));
  arr(S.cycles).forEach(c => rules.push({ id: 'cycle:' + c.id, kind: 'cycle', name: c.name, emo: c.emo || '', every: { unit: c.unit || 'd', n: +c.every || 1 }, last: c.last || '', remind: c.remind || 0, src: c }));
  arr(S.pcare).forEach(p => rules.push({ id: 'care:' + p.id, kind: 'care', name: p.t || p.name || '', pillar: DROP.has(p.k || p.area) ? '' : (p.k || p.area || ''), every: p.every || null, src: p }));
  arr(S.planRep).forEach(r => rules.push({ id: 'event:' + r.id, kind: 'event', name: r.name || r.act || '', src: r }));
  rep.rules = rules.reduce((a, r) => { a[r.kind] = (a[r.kind] || 0) + 1; return a; }, {});

  /* 중점 기둥: v4는 주마다 최대 3개, v5는 1개(맨 앞의 것). 영성은 제외한다. */
  const focus = {};
  if (isObj(S.wkFocus)) Object.keys(S.wkFocus).forEach(w => {
    const list = arr(S.wkFocus[w]).filter(k => PILLAR_KEYS.includes(k));
    if (list.length) { focus[w] = list[0]; if (list.length > 1) rep.focusTrimmed++; }
  });

  const prefs = {};
  Object.keys(S).forEach(k => { if (!SETTINGS_MOVED.has(k) && !SETTINGS_DROPPED.has(k)) prefs[k] = S[k]; });
  prefs.focus = focus;
  rep.settingsKept = Object.keys(prefs).length; rep.settingsDropped = Object.keys(S).filter(k => SETTINGS_DROPPED.has(k)).length;
  return { taxonomy, rules, prefs };
}

export function migrate(v4) {
  const rep = { days: 0, notesMoved: 0, notesDropped: 0, notesUndated: 0, habitChecks: 0, spiritScores: 0, spiritFields: 0, spiritRefs: 0, focusTrimmed: 0, stuffDropped: 0, warnings: [] };
  const docs = {};
  const days = new Map();

  arr(v4.days).forEach(o => {
    if (!o || !isDate(o.date)) { rep.warnings.push('날짜가 올바르지 않은 일지를 건너뜀'); return; }
    days.set(o.date, convertDay(o, rep)); rep.days++;
  });

  arr(v4.notes).forEach(n => {
    if (!n || !n.id) return;
    if (DROP.has(n.area)) { rep.notesDropped++; return; }
    let date = isDate(n.date) ? n.date : (n.created ? ymd(new Date(n.created)) : '');
    if (!isDate(date)) { rep.notesUndated++; rep.warnings.push('날짜를 알 수 없는 노트: ' + n.id); return; }
    if (!days.has(date)) days.set(date, normDay({ date }));
    const d = days.get(date);
    if (!d.notes.some(x => x.id === n.id)) { d.notes.push(noteToBlock(n)); rep.notesMoved++; }
  });
  days.forEach((d, date) => { d.notes.sort((a, b) => (a.hm || '') < (b.hm || '') ? -1 : (a.hm || '') > (b.hm || '') ? 1 : (a.ts || 0) - (b.ts || 0)); docs[K.day(date)] = d; });

  const st = convertSettings(v4.settings, rep);
  docs[K.taxonomy] = st.taxonomy; docs[K.rules] = { list: st.rules }; docs[K.prefs] = st.prefs;
  docs[K.legacy] = { settings: clone(v4.settings || {}), note: 'v4 설정 원본. v5는 읽지 않는다.' };

  /* 아직 구조를 바꾸지 않은 문서는 그대로 옮긴다(구조 정리는 해당 단계에서) */
  const copy = (key, val) => { if (val !== undefined && val !== null) docs[key] = clone(val); };
  copy(K.goals, v4.goals); copy(K.projects, v4.projects); copy(K.tasks, v4.tasks);
  copy(K.people, v4.people); copy(K.budget, v4.budget); copy(K.assets, v4.assets);
  copy(K.books, v4.books); copy(K.trash, v4.trash);
  if (v4.stuff) rep.stuffDropped = arr(v4.stuff.items || v4.stuff.list).length;
  const unspirit = (list, f) => arr(list).forEach(o => { if (o && DROP.has(o[f])) { o[f] = ''; o.was = 'spirit'; rep.spiritRefs++; } });
  if (docs[K.goals]) unspirit(docs[K.goals].list, 'area');
  if (docs[K.tasks]) { unspirit(docs[K.tasks].items, 'dk'); unspirit(docs[K.tasks].items, 'area'); }

  docs[K.meta] = { schema: SCHEMA, migratedAt: Date.now(), report: rep };
  return { docs, report: rep };
}
