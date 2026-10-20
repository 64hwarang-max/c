/* main — 시작점. 저장소를 열고, 변환을 한 번 하고, 탭 틀을 그린다. 여기서만 모듈들을 이어 붙인다. */
import { createBus } from './core/events.js';
import { pickAdapter, createStore } from './core/store.js';
import { today, pad } from './core/date.js';
import { K } from './core/schema.js';
import { summarize, levelUps } from './domain/score.js';
import { PILLARS } from './core/schema.js';
import { defaultTaxonomy } from './domain/taxonomy.js';
import { newId } from './domain/blocks.js';
import { runMigration, parseBackup } from './migrate/run.js';
import { migrate } from './migrate/v4to5.js';
import { makeBackupSink } from './native/backup-sink.js';
import { createDeviceSync, deviceOn } from './features/device-sync.js';
import { onResume, onBack } from './native/app.js';
import { closeSheet } from './ui/sheet.js';
import { createTodayActions } from './features/today.js';
import { createDayEndActions } from './features/dayend.js';
import { createPlanningActions } from './features/planning.js';
import { renderToday } from './screens/today.js';
import { renderWeek } from './screens/week.js';
import { createPillarActions } from './features/pillars.js';
import { renderPillar } from './screens/pillar.js';
import { createRecordActions } from './features/records.js';
import { renderRecords } from './screens/records.js';
import { collectNotes, booksOf } from './domain/records.js';
import { dueRules, rulesOf, isDone, streakOf, pillarOfRule } from './domain/rules.js';
import { goalsOf } from './domain/goals.js';
import { weekBalance } from './domain/week.js';
import { groupTasks, normTasks } from './domain/tasks.js';
import { parseQuick } from './domain/quick.js';
import { weekStart, addD } from './core/date.js';
import { renderMe } from './screens/me.js';
import { renderDiag } from './screens/diag.js';
import { createSettingsActions } from './features/settings.js';
import { sampleV4 } from './dev/sample-v4.js';
import { toast } from './ui/sheet.js';

const BUILD = '__BUILD__';
const TABS = [['today', '☀️', '오늘'], ['week', '🗓️', '주'], ['pillar', '🏛️', '기둥'], ['log', '📒', '기록'], ['me', '🧬', '나']];
const NEXT = {};

const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const peopleList = doc => { const l = Array.isArray(doc) ? doc : doc && (doc.list || doc.items || doc.people) || []; return l.filter(p => p && typeof p === 'object' && p.name); };
const peopleNames = doc => { const l = Array.isArray(doc) ? doc : doc && (doc.list || doc.items || doc.people) || []; return l.map(p => (typeof p === 'string' ? p : p && p.name)).filter(Boolean); };

async function boot() {
  const root = document.getElementById('app');
  const bus = createBus(), adapter = pickAdapter(), store = createStore(adapter, bus);
  const S = { up: '', tab: 'today', date: today(), mode: 'plan', qText: '', q: null, tx: defaultTaxonomy(), prefs: {}, people: [], peopleList: [], ws: weekStart(today()), tasks: normTasks(null), weeks: {}, goals: { list: [] }, rules: [], room: '', books: {}, log: { sub: 'notes', view: 'tree', q: '', k: '', ym: today().slice(0, 7) }, day: null, sample: false, msg: '' };
  const diag = { build: BUILD, mode: adapter.mode, migrated: false, report: null, fromSample: false, msg: '', sum: null, focus: {} };

  /* 화면 틀: 머리 + 탭 내용 + 아래 탭 줄. 틀은 한 번만 만든다. */
  root.innerHTML = `<header class="top"><h1>성장일지 <small>v5 · ${BUILD === 'dev' ? '시험판' : BUILD}</small></h1><p class="muted" data-note hidden></p></header>
    <main id="view"></main>
    <nav class="tabs" aria-label="주 메뉴">${TABS.map(([k, e, l]) => `<button type="button" data-tab="${k}"><span aria-hidden="true">${e}</span>${l}</button>`).join('')}</nav>`;
  const view = root.querySelector('#view');
  const panes = {}; TABS.forEach(([k]) => { const s = document.createElement('section'); s.dataset.pane = k; s.hidden = true; view.appendChild(s); panes[k] = s; });

  const ctx = () => ({ tx: S.tx, prefs: S.prefs, people: S.people, rules: S.rules, today: today(), nowHM: nowHM() });
  const feat = createTodayActions({ store, ctx }), end = createDayEndActions({ store, ctx }), plan = createPlanningActions({ store, ctx }), pil = createPillarActions({ store, ctx }), rec = createRecordActions({ store }), cfg = createSettingsActions({ store }), sink = makeBackupSink(), dev = createDeviceSync({ store, ctx });
  let devTimer = 0;
  const syncDevices = () => { clearTimeout(devTimer); devTimer = setTimeout(() => { dev.run().catch(() => {}); }, 1500); };   // 바뀐 뒤 잠깐 모아서 한 번만
  const all = new Map();   // 모든 날 문서(점수·레벨 계산용). 저장될 때마다 바뀐 날만 다시 읽는다.
  let sum = null, pending = Promise.resolve();

  async function refreshDocs() {
    S.tx = (await store.get(K.taxonomy)) || defaultTaxonomy();
    if (!S.tx.cats || !S.tx.cats.length) S.tx = { ...S.tx, cats: defaultTaxonomy().cats };
    S.prefs = (await store.get(K.prefs)) || {};
    const pdoc = await store.get(K.people); S.people = peopleNames(pdoc); S.peopleList = peopleList(pdoc);
    S.tasks = await plan.loadTasks(); S.weeks = await plan.loadWeeks();
    S.books = await rec.loadBooks(); S.goals = await pil.loadGoals(); S.rules = rulesOf(await pil.loadRules());
  }
  const vmToday = () => ({ date: S.date, today: today(), mode: S.mode, day: S.day, tx: S.tx, prefs: S.prefs, people: S.people, q: S.q, now: { hm: nowHM() }, sum, due: dueRules(S.rules, S.date, all).map(r => ({ id: r.id, name: r.name, kind: r.kind, pillar: pillarOfRule(r), done: isDone(S.day, r.id), streak: r.kind === 'habit' ? streakOf(all, r.id, S.date) : 0 })), rules: S.rules });

  const vmWeek = () => { const T = today(), thisWs = weekStart(T); return { ws: S.ws, thisWs, today: T, all, prefs: S.prefs, tx: S.tx, bal: weekBalance(all, S.ws, T), tasks: S.tasks, groups: groupTasks(S.tasks, T, thisWs), wrap: S.weeks[S.ws] || {} }; };
  async function drawWeek() { await pending; renderWeek(panes.week, vmWeek(), actWeek); }
  const vmPillar = () => { const T = today(); return { room: S.room, sum, bal: weekBalance(all, weekStart(T), T), prefs: S.prefs, ws: weekStart(T), today: T, goals: S.goals, rules: S.rules, all, dayToday: all.get(T) || {} }; };
  async function drawPillar() { await pending; renderPillar(panes.pillar, vmPillar(), actPillar); }
  const vmLog = () => ({ log: S.log, all, notes: collectNotes(all), books: S.books, booksAll: booksOf(S.books), today: today() });
  async function drawLog(partial) { await pending; renderRecords(panes.log, vmLog(), actLog, partial); }
  async function loadDay() { S.day = await feat.load(S.date); }
  async function drawToday() { await pending; if (!S.day || S.day.date !== S.date) await loadDay(); renderToday(panes.today, vmToday(), actToday); }
  function drawTabs() {
    root.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
    TABS.forEach(([k]) => { panes[k].hidden = k !== S.tab; });
    const note = root.querySelector('[data-note]'); const txt = S.up || (S.sample ? '시험판의 샘플 하루입니다. 저장은 이 화면 안에서만 됩니다.' : ''); note.hidden = !txt || S.tab !== 'today'; note.textContent = txt;
  }
  async function drawPane() {
    drawTabs();
    if (S.tab === 'today') return drawToday();
    if (S.tab === 'week') return drawWeek();
    if (S.tab === 'pillar') return drawPillar();
    if (S.tab === 'log') return drawLog();
    if (S.tab === 'me') return drawMe();
    panes[S.tab].innerHTML = `<section class="card"><h2>${TABS.find(t => t[0] === S.tab)[2]}</h2><p class="muted">이 탭은 ${NEXT[S.tab]} 단계에서 붙습니다.</p></section>`;
  }

  /* 오늘 화면이 부르는 액션 — 저장은 features/today, 여기는 화면 상태와 이어 주기만 한다 */
  const undoable = async r => { await r.undo(); await loadDay(); drawToday(); };
  const actToday = {
    goDate: async d => { S.date = d; S.q = null; if (S.mode === 'end') await end.syncAuto(d); await loadDay(); drawToday(); },
    setMode: async m => { S.mode = m; if (m === 'end') { await end.syncAuto(S.date); await loadDay(); } drawToday(); },
    typing: async v => { S.qText = v; S.q = v.trim() ? await feat.preview(v, S.date, S.q && S.q.user ? S.q.kind : '') : null; paintQ(); },
    setKind: async k => { S.q = await feat.preview(S.qText, S.date, k); paintQ(); },
    submitQuick: async v => {
      const r = S.q && S.q.raw === v.trim() ? S.q : await feat.preview(v, S.date, '');
      if (r.kind === 'task') { const x = await plan.addFromQuick(r); S.q = null; S.qText = ''; toast(`할 일에 넣었습니다 · ${x.task.title}${x.task.due ? ' (' + x.task.due.slice(5).replace('-', '.') + ')' : ''}`, { label: '되돌리기', fn: () => x.undo() }); drawToday(); return { ok: true }; }
      const res = await feat.apply(r, S.date);
      if (!res.ok) { toast(res.msg); return res; }
      S.q = null; S.qText = '';
      if (res.date && res.date !== S.date && r.kind === 'plan') { toast(res.msg, { label: '되돌리기', fn: () => res.undo() }); }
      else toast(res.msg, { label: '되돌리기', fn: () => undoable(res) });
      await loadDay(); drawToday(); return res;
    },
    add: async (kind, f) => { const r = await feat.addBlock(S.date, kind, f); await loadDay(); drawToday(); return wrapUndo(r); },
    edit: async (kind, id, f) => { const r = await feat.editBlock(S.date, kind, id, f); await loadDay(); drawToday(); return wrapUndo(r); },
    del: async (kind, id) => { const r = await feat.deleteBlock(S.date, kind, id); await loadDay(); drawToday(); return wrapUndo(r); },
    move: async (kind, id, s) => { const r = await feat.moveBlock(S.date, kind, id, s); await loadDay(); drawToday(); return wrapUndo(r); },
    resize: async (kind, id, e) => { const r = await feat.resizeBlock(S.date, kind, id, e); await loadDay(); drawToday(); return wrapUndo(r); },
    planDone: async ids => { const r = await feat.planDone(S.date, ids); await loadDay(); drawToday(); return { ...wrapUndo(r), added: r.added }; },
    planUndo: async id => { const r = await feat.planUndo(S.date, id); await loadDay(); drawToday(); return wrapUndo(r); },
    setPri: async (i, patch) => { await feat.setPriority(S.date, i, patch); await loadDay(); },
    bumpScore: async (k, dl) => { const r = await end.bumpScore(S.date, k, dl); await loadDay(); drawToday(); return wrapUndo(r); },
    setScore: async (k, v) => { const r = await end.setScore(S.date, k, v); await loadDay(); drawToday(); return wrapUndo(r); },
    setEval: async (f, v, i) => { await end.setEval(S.date, f, v, i); await loadDay(); },
    addNote: async f => { const r = await end.addNote(S.date, f); await loadDay(); drawToday(); return wrapUndo(r); },
    editNote: async (id, f) => { const r = await end.editNote(S.date, id, f); await loadDay(); drawToday(); return wrapUndo(r); },
    delNote: async id => { const r = await end.deleteNote(S.date, id); await loadDay(); drawToday(); return wrapUndo(r); },
    toggleRule: async id => { const r = await pil.toggleRule(S.date, id); await loadDay(); drawToday(); return wrapUndo(r); },
    undo: r => undoable(r),
  };
  const wrapUndo = r => ({ undo: r.undo });
  const redoWeek = async r => { await r.undo(); await refreshDocs(); drawWeek(); };
  const afterW = async r => { await refreshDocs(); recompute(); await drawWeek(); return wrapUndo(r); };
  const afterP = async r => { await refreshDocs(); recompute(); await drawPillar(); return wrapUndo(r); };
  const redoPillar = async r => { await r.undo(); await refreshDocs(); drawPillar(); };
  const actPillar = {
    openRoom: k => { S.room = k; drawPillar(); },
    setFocus: async (d, k) => afterP(await plan.setFocus(d, k)),
    addGoal: async f => { const x = await pil.addGoal(f); await afterP(x); return wrapUndo(x); },
    editGoal: async (id, f) => afterP(await pil.editGoal(id, f)),
    deleteGoal: async id => afterP(await pil.deleteGoal(id)),
    addStep: async (id, t) => afterP(await pil.addStep(id, t)),
    toggleStep: async (id, sid) => afterP(await pil.toggleStep(id, sid)),
    removeStep: async (id, sid) => afterP(await pil.removeStep(id, sid)),
    addRule: async f => { const x = await pil.addRule(f); await afterP(x); return wrapUndo(x); },
    editRule: async (id, f) => afterP(await pil.editRule(id, f)),
    deleteRule: async id => afterP(await pil.deleteRule(id)),
    toggleRule: async id => { const r = await pil.toggleRule(today(), id); S.day = null; await pending; return afterP(r); },
    undo: r => redoPillar(r),
  };
  const afterR = async r => { await refreshDocs(); await drawLog(); return wrapUndo(r); };
  const actLog = {
    setLog: (p, partial) => { Object.assign(S.log, p); drawLog(!!partial); },
    openDay: async d => { S.tab = 'today'; S.date = d; S.q = null; await loadDay(); drawPane(); },
    addBook: async f => afterR(await rec.addBook(f)),
    editBook: async (id, f) => afterR(await rec.editBook(id, f)),
    deleteBook: async id => afterR(await rec.deleteBook(id)),
    undo: async r => { await r.undo(); await refreshDocs(); drawLog(); },
  };
  const actWeek = {
    goWeek: ws => { S.ws = ws; drawWeek(); },
    setFocus: async (d, k) => afterW(await plan.setFocus(d, k)),
    openDay: async d => { S.tab = 'today'; S.date = d; S.q = null; await loadDay(); drawPane(); },
    editTask: async (id, p) => afterW(await plan.editTask(id, p)),
    toggleTask: async id => afterW(await plan.toggleTask(id)),
    deleteTask: async id => afterW(await plan.deleteTask(id)),
    planTask: async (id, date, s, e) => {
      const t = S.tasks.items.find(x => x.id === id), r = await feat.addBlock(date, 'plan', { s, e, act: t.title || t.text || '', tid: id });
      if (date === S.date) await loadDay(); await drawWeek(); return wrapUndo(r);
    },
    addTaskText: async v => { const x = await plan.addFromQuick({ t: v, raw: v }); await afterW(x); return { undo: () => redoWeek(x), msg: `할 일에 넣었습니다 · ${x.task.title}${x.task.due ? ' (' + x.task.due.slice(5).replace('-', '.') + ')' : ''}` }; },
    setWrap: async (d, f, v) => { await plan.setWrap(d, f, v); S.weeks = await plan.loadWeeks(); },
    undo: r => redoWeek(r),
  };
  function paintQ() { renderToday(panes.today, vmToday(), actToday); const i = panes.today.querySelector('#qin'); if (i) { i.focus(); } }

  /* 나 탭(진단) */
  const sumOf = days => summarize(days, diag.focus || {}, today());
  const showTry = (v4, label) => {
    const { docs, report } = migrate(v4), days = new Map();
    Object.keys(docs).filter(k => k.startsWith(K.dayPrefix)).forEach(k => days.set(k.slice(K.dayPrefix.length), docs[k]));
    diag.focus = docs[K.prefs].focus; diag.report = report; diag.fromSample = true; diag.sum = sumOf(days);
    diag.msg = `${label}: 일지 ${report.days}일을 변환했습니다. 저장하지 않았습니다.`; drawMe();
  };
  const vmMe = () => ({ sum, prefs: S.prefs, tx: S.tx, peopleList: S.peopleList, msg: '', native: dev.available(), dev: { widget: deviceOn(S.prefs, 'widget'), remind: deviceOn(S.prefs, 'remind') } });
  async function drawMe() { await pending; renderMe(panes.me, vmMe(), actMe); renderDiag(panes.me.querySelector('[data-diagbox]'), diag, actDiag); }
  const afterM = async r => { await refreshDocs(); recompute(); await drawMe(); return wrapUndo(r); };
  const applyTheme = () => { const t = S.prefs.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  const actMe = {
    setTheme: async t => afterM(await cfg.setTheme(t)),
    setDevice: async (k, on) => { const r = await cfg.setDevice(k, on); await afterM(r); syncDevices(); },
    saveCat: async (o, f) => afterM(await cfg.saveCat(o, f)),
    deleteCat: async n => afterM(await cfg.deleteCat(n)),
    addPerson: async n => afterM(await cfg.addPerson(n)),
    deletePerson: async id => afterM(await cfg.deletePerson(id)),
    exportBackup: async () => sink(await cfg.exportText()),
    parse: t => cfg.parse(t),
    applyImport: async (parsed, mode) => {
      const sum = await cfg.applyImport(parsed, mode, sink);
      all.clear(); (await store.allDays()).forEach((d, k) => all.set(k, d)); await refreshDocs(); recompute(); S.day = null; await drawMe(); return sum;
    },
    undo: async r => { await r.undo(); await refreshDocs(); recompute(); drawMe(); },
  };
  const actDiag = {
    sample: () => showTry(sampleV4(), '샘플'),
    file: async f => { try { showTry(parseBackup(await f.text()), f.name); } catch (e) { diag.msg = '시험하지 못했습니다: ' + e.message; drawMe(); } },
  };

  root.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; drawPane(); });

  /* 시작: 변환 → 문서 읽기 → (시험판이고 비어 있으면) 샘플 하루 */
  try {
    const res = await runMigration({ adapter, backupSink: makeBackupSink() });
    const meta = await adapter.get(K.meta);
    diag.migrated = !!meta; diag.report = res.report || (meta && meta.report && !meta.report.empty ? meta.report : null);
    diag.focus = ((await adapter.get(K.prefs)) || {}).focus || {};
    diag.sum = sumOf(await store.allDays());
  } catch (e) { diag.msg = '시작하지 못했습니다: ' + e.message; diag.sum = sumOf(new Map()); toast(diag.msg); }
  await refreshDocs(); applyTheme();
  if (BUILD === 'dev' && !(await store.dayKeys()).length) { await seedSample(store, today()); S.sample = true; await refreshDocs(); }
  const recompute = () => { sum = summarize(all, S.prefs.focus || {}, today()); };
  (await store.allDays()).forEach((d, k) => all.set(k, d)); recompute();
  bus.on('change', ({ key }) => {
    if (key === K.prefs || key === K.taxonomy || key === K.people || key === K.tasks || key === K.weeks || key === K.goals || key === K.rules || key === K.books) { if (key === K.prefs || key === K.tasks || key === K.rules) syncDevices(); pending = pending.then(async () => { await refreshDocs(); applyTheme(); recompute(); }); }
    else if (key.startsWith(K.dayPrefix)) { syncDevices(); pending = pending.then(async () => {
      const date = key.slice(K.dayPrefix.length), prev = sum;
      all.set(date, await store.loadDay(date)); recompute();
      const ups = levelUps(prev, sum);
      S.up = ups.length ? '🎉 레벨 업 — ' + ups.map(u => (u.kind === 'total' ? `전체 Lv.${u.level}` : `${PILLARS.find(p => p[0] === u.key)[1]} Lv.${u.level}`)).join(' · ') : '';
    }); }
  });
  /* 앱이 다시 앞으로 오면(날짜가 넘어갔을 수 있음) 오늘로 맞추고 기기 연동도 다시 맞춘다. 뒤로가기는 시트 → 오늘 탭 → 종료 순. */
  onResume(() => { if (S.tab === 'today' && !document.querySelector('.sheet-back')) drawPane(); syncDevices(); });
  onBack(() => { if (document.querySelector('.sheet-back')) { closeSheet(); return true; } if (S.tab !== 'today') { S.tab = 'today'; drawPane(); return true; } return false; });
  syncDevices();
  await loadDay();
  drawPane();
  /* 1분마다 지금 줄·지금 카드만 새로 그린다(시트가 열려 있거나 끌고 있으면 건너뜀) */
  const tick = () => { if (S.tab === 'today' && S.date === today() && !document.querySelector('.sheet-back') && !panes.today.querySelector('.blk.drag')) drawToday(); setTimeout(tick, 60000); };
  setTimeout(tick, 60000);
}

async function seedSample(store, T) {
  const mk = (s, e, act, cat, extra) => ({ id: newId(), s, e, act, cat, who: '', ...extra });
  const d = await store.loadDay(T);
  d.plan = [mk('07:00', '08:00', '운동', '운동'), mk('09:00', '12:00', '보고서 작성', '업무'), mk('12:00', '13:00', '점심', '식사'), mk('14:00', '15:30', '팀 회의', '업무'), mk('19:00', '20:30', '독서', '자기계발')];
  const p0 = d.plan[0], p1 = d.plan[1];
  d.actual = [mk('07:10', '08:00', '운동', '운동', { from: p0.id }), mk('09:20', '11:40', '보고서 작성', '업무', { from: p1.id }), mk('12:10', '13:00', '점심', '식사', { amt: '9000' })];
  d.pri = [{ text: '보고서 마무리', link: '', done: false }, { text: '운동', link: '', done: true }, { text: '', link: '', done: false }];
  await store.saveDay(d);
  /* 지난 며칠(균형판·일곱 날 시험용) */
  for (let i = 1; i <= 8; i++) {
    const x = await store.loadDay(addD(T, -i));
    if (i === 1) { x.notes = [{ id: 'sn1', ts: 1, hm: '09:10', k: 'work', c: '보고', s: '개요', title: '개요 정리', txt: '첫 문단 구상', ln: null }, { id: 'sn2', ts: 2, hm: '21:00', k: 'grow', c: '독서', s: '', title: '책 한 줄', txt: '인상 깊은 문장', ln: null }]; x.fin = [{ id: 'sf1', type: '지출', item: '점심', amt: 9000, cat: '식비' }, { id: 'sf2', type: '지출', item: '교통', amt: 2500, cat: '교통' }]; x.meet = [{ id: 'sm1', who: '김대리', what: '식사', learn: '일정 조율', follow: true, kind: '교제' }]; }
    x.scUser = { work: 4 + (i % 5), body: i % 3 ? 6 : 3, grow: i % 2 ? 5 : 0, rel: i === 2 ? 8 : 0 }; await store.saveDay(x);
  }
  await store.put(K.rules, { list: [
    { id: 'habit:h1', kind: 'habit', name: '운동', hid: 'h1', pillar: 'body', every: { unit: 'd', n: 1 } },
    { id: 'habit:h2', kind: 'habit', name: '독서', hid: 'h2', pillar: 'grow', every: { unit: 'd', n: 1 } },
    { id: 'habit:h3', kind: 'habit', name: '일찍 자기', hid: 'h3', every: { unit: 'd', n: 1 } }] });
  await store.put(K.goals, { list: [
    { id: 'g1', lv: 'w', per: weekStart(T), title: '보고서 완성', parent: null, tasks: [{ id: 's1', title: '개요', done: true }, { id: 's2', title: '초안', done: false }], area: 'work', kind: 'proj' },
    { id: 'g2', lv: 'm', per: T.slice(0, 7), title: '체중 70kg', parent: null, tasks: [], area: 'body', kind: 'num', n0: '75', tgt: '70', cur: '73' }] });
  await store.put(K.books, { items: [{ id: 'bk1', title: '내적 지휘 핸드북', author: '', st: 'read', rate: 0, created: 1, updated: 1 }, { id: 'bk2', title: '손자병법', author: '', st: 'want', rate: 0, created: 2, updated: 2 }] });
  await store.put(K.tasks, { lists: [{ id: 'l1', name: '할 일' }], items: [
    { id: 't1', title: '서류 제출', list: 'l1', due: addD(T, -1), done: false, created: 1 },
    { id: 't2', title: '치과 예약', list: 'l1', due: T, done: false, created: 2 },
    { id: 't3', title: '보고서 검토', list: 'l1', due: addD(T, 2), done: false, created: 3 },
    { id: 't4', title: '독서 계획', list: 'l1', due: '', done: false, created: 4 }] });
}

boot();
