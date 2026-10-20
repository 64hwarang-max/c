/* screens/today — 오늘 화면: 날짜 줄, 빠른 입력, 모드(계획·실행·마감), 계획/실제 타임라인, 하루 요약.
   그리기와 입력만 한다. 데이터는 vm으로 받고, 바꾸는 일은 act(액션)로만 한다. */
import { esc, num } from '../ui/html.js';
import { openSheet, toast } from '../ui/sheet.js';
import { PILLARS } from '../core/schema.js';
import { addD } from '../core/date.js';
import { nowNext, doneIds, span, sortBlocks, layoutLanes, toMin, compareDay, hm, addMin, nextSlot, snap } from '../domain/blocks.js';
import { colorOf, catNames, catByName, blockArea } from '../domain/taxonomy.js';
import { KINDS } from '../domain/quick.js';
import { dayScores, focusOf, FOCUS_MULT } from '../domain/score.js';
import { basis } from '../domain/evaluate.js';
import { EVAL_LISTS, EVAL_LINES } from '../features/dayend.js';

const WD = '일월화수목금토';
const PX = 0.8;                       // 1분당 높이(px): 1시간 = 48px
const MODES = [['plan', '계획'], ['run', '실행'], ['end', '마감']];
const labelDate = d => { const [, m, dd] = d.split('-'); return `${+m}월 ${+dd}일 (${WD[new Date(d + 'T00:00').getDay()]})`; };

export function renderToday(root, vm, act) {
  if (!root.querySelector('[data-today]')) {
    root.innerHTML = `<div data-today>
      <div class="datebar"><button type="button" class="ico" data-go="-1" aria-label="전날">‹</button>
        <label class="dlabel"><span data-dlabel></span><input type="date" data-dpick aria-label="날짜 선택"></label>
        <button type="button" class="ico" data-go="1" aria-label="다음날">›</button><button type="button" class="pill" data-go="0">오늘</button></div>
      <form class="qbox" data-q autocomplete="off"><input type="text" id="qin" placeholder="예: 2시 회의 · 점심 9000원 · 감사: 가족" enterkeyhint="done" aria-label="빠른 입력"><button class="btn" type="submit">넣기</button></form>
      <div data-qpv class="qpv" hidden></div>
      <div class="seg" role="tablist" data-modes>${MODES.map(([k, l]) => `<button type="button" role="tab" data-mode="${k}">${l}</button>`).join('')}</div>
      <div data-body></div></div>`;
    bind(root, act);
  }
  root.__vm = vm;   // 입력 처리는 항상 가장 최근 상태를 읽는다
  paint(root, vm);
}

/* ---------- 그리기 ---------- */
function paint(root, vm) {
  root.querySelector('[data-dlabel]').textContent = labelDate(vm.date) + (vm.date === vm.today ? ' · 오늘' : '');
  root.querySelector('[data-dpick]').value = vm.date;
  root.querySelectorAll('[data-mode]').forEach(b => { const on = b.dataset.mode === vm.mode; b.setAttribute('aria-selected', on); b.classList.toggle('on', on); });
  paintPreview(root, vm);
  const body = root.querySelector('[data-body]');
  body.innerHTML = vm.mode === 'end' ? endHTML(vm) + notesHTML(vm) : (vm.mode === 'run' ? runTop(vm) : priHTML(vm)) + dueHTML(vm) + timelineHTML(vm) + (vm.mode === 'run' ? notesHTML(vm) : '') + summaryHTML(vm);
}

function paintPreview(root, vm) {
  const box = root.querySelector('[data-qpv]'), r = vm.q;
  if (!r || !r.raw) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = `<div class="chips" role="group" aria-label="종류">${Object.entries(KINDS).map(([k, [e, l]]) => `<button type="button" class="chip${k === r.kind ? ' on' : ''}" data-qk="${k}">${e} ${l}</button>`).join('')}</div><p class="qd">→ ${KINDS[r.kind][0]} <b>${KINDS[r.kind][1]}</b> ${esc(describe(r))}</p>`;
}
function describe(r) {
  const t = r.t || r.raw;
  if (r.kind === 'plan' || r.kind === 'done') return `${r.date ? r.date.slice(5).replace('-', '.') + ' ' : ''}${r.s}~${r.e}${r.notime ? '(시간 미정)' : ''} ‘${t}’${r.amt && r.kind === 'done' ? ' · 💳' + r.amt : ''}`;
  if (r.kind === 'fin') return `${r.income ? '수입' : r.give ? '나눔' : '지출'} ${r.amtN ? r.amtN.toLocaleString('ko-KR') + '원' : r.amt || ''} · ‘${t}’`;
  if (r.kind === 'task') return `‘${t}’ · 할 일은 계획 탭(다음 단계)에서 입력합니다`;
  return `‘${t.slice(0, 40)}${t.length > 40 ? '…' : ''}’`;
}

function dueHTML(vm) {
  if (!vm.due.length) return '';
  const left = vm.due.filter(r => !r.done).length;
  return `<section class="card" aria-labelledby="h-due"><h2 id="h-due">오늘 반복 <span class="tag">${vm.due.length - left}/${vm.due.length}</span></h2><ul class="tl2">${vm.due.map(r => `<li class="tr${r.done ? ' dn' : ''}"><input type="checkbox" data-rdone="${esc(r.id)}" ${r.done ? 'checked' : ''} aria-label="${esc(r.name)} 했다"><span class="tt"><b>${esc(r.name)}</b><small>${r.streak ? '연속 ' + r.streak + '일' : ''}</small></span></li>`).join('')}</ul></section>`;
}
function priHTML(vm) {
  const pri = [0, 1, 2].map(i => (vm.day.pri || [])[i] || { text: '', done: false });
  return `<section class="card" aria-labelledby="h-pri"><h2 id="h-pri">오늘 우선순위</h2><ul class="pri">${pri.map((p, i) => `<li><input type="checkbox" data-pri-done="${i}" ${p.done ? 'checked' : ''} aria-label="${i + 1}번 완료"><input type="text" data-pri-text="${i}" value="${esc(p.text)}" placeholder="${i + 1}순위" aria-label="${i + 1}순위"></li>`).join('')}</ul></section>`;
}

function runTop(vm) {
  const { cur, next } = nowNext(vm.day.plan || [], vm.now.hm);
  const left = (vm.day.plan || []).filter(p => p.s && p.e && !doneIds(vm.day).has(p.id)).length;
  const line = b => `${b.s}~${b.e} ${esc(b.act || b.cat || '')}`;
  return `<section class="card" aria-labelledby="h-now"><h2 id="h-now">지금</h2>
    ${vm.date !== vm.today ? '<p class="muted">오늘이 아닌 날을 보고 있습니다.</p>' : `<p class="now">${cur ? `▶ ${line(cur)}` : '진행 중인 계획이 없습니다.'}</p>${next ? `<p class="muted">다음 ${line(next)}</p>` : ''}`}
    <div class="row"><button type="button" class="btn" data-plan-all ${left ? '' : 'disabled'}>계획대로 했다${left ? ` (남은 ${left}개 전부)` : ''}</button></div></section>`;
}

function timelineHTML(vm) {
  const { day, tx, prefs } = vm, single = vm.mode === 'plan';
  const all = [...(day.plan || []), ...(day.actual || [])].map(span).filter(Boolean);
  let lo = 6 * 60, hi = 23 * 60;
  all.forEach(([s, e]) => { lo = Math.min(lo, Math.floor(s / 60) * 60); hi = Math.max(hi, Math.min(1440, Math.ceil(e / 60) * 60)); });
  const H = (hi - lo) * PX, done = doneIds(day);
  const hours = []; for (let m = lo; m < hi; m += 60) hours.push(m);
  const col = (kind, list) => {
    const L = layoutLanes(list);
    return `<div class="tcol" data-col="${kind}" style="height:${H}px">${hours.map(m => `<i class="hl" style="top:${(m - lo) * PX}px"></i>`).join('')}${list.map(b => blockHTML(b, kind, L.get(b.id) || { lane: 0, lanes: 1 }, lo, vm, done.has(b.id))).join('')}${vm.date === vm.today && toMin(vm.now.hm) >= lo && toMin(vm.now.hm) < hi ? `<i class="nowl" style="top:${(toMin(vm.now.hm) - lo) * PX}px"></i>` : ''}</div>`;
  };
  const plan = sortBlocks((day.plan || []).filter(b => b.s)), act = sortBlocks((day.actual || []).filter(b => b.s));
  return `<section class="card tl" aria-labelledby="h-tl"><h2 id="h-tl">시간표</h2>
    <div class="tlhead"><span></span><div class="tlh"><b>계획</b><button type="button" class="pill" data-add="plan">＋ 계획</button></div>${single ? '' : '<div class="tlh"><b>실제</b><button type="button" class="pill" data-add="actual">＋ 실제</button></div>'}</div>
    <div class="tlbody ${single ? 'one' : ''}" data-lo="${lo}"><div class="haxis" style="height:${H}px">${hours.map(m => `<span style="top:${(m - lo) * PX}px">${String(m / 60 % 24).padStart(2, '0')}</span>`).join('')}</div>${col('plan', plan)}${single ? '' : col('actual', act)}</div>
    ${!plan.length && !act.length ? `<p class="muted empty">아직 블록이 없습니다. 위 입력칸에 “2시 회의”처럼 쓰거나 ＋ 단추를 누르십시오.</p>` : ''}</section>`;
}
function blockHTML(b, kind, ln, lo, vm, isDone) {
  const p = span(b); if (!p) return '';
  const top = (p[0] - lo) * PX, h = Math.max((p[1] - p[0]) * PX, 22), color = colorOf(vm.tx, vm.prefs, b.cat);
  const tag = kind === 'plan' ? (isDone ? '✓ ' : '') : (b.from ? '↳ ' : '');
  return `<div class="blk${isDone ? ' done' : ''}" data-blk="${esc(b.id)}" data-kind="${kind}" tabindex="0" role="button" aria-label="${esc((b.act || b.cat || '블록') + ' ' + b.s + '부터 ' + b.e + '까지')}"
    style="top:${top}px;height:${h}px;left:${ln.lane / ln.lanes * 100}%;width:${100 / ln.lanes}%;--c:${color}"><span class="bt">${tag}${esc(b.act || b.cat || '(제목 없음)')}</span><span class="bm">${b.s}~${b.e}${b.who ? ' · ' + esc(b.who) : ''}</span><i class="grip" data-grip aria-hidden="true"></i></div>`;
}

function summaryHTML(vm) {
  const c = compareDay(vm.day, vm.tx), P = c.plan, A = c.actual;
  const max = Math.max(60, ...PILLARS.map(([k]) => Math.max(P.pil[k], A.pil[k])), P.other, A.other);
  const row = (name, p, a) => (p || a) ? `<tr><th scope="row">${esc(name)}</th><td><div class="two"><i class="bp" style="width:${p / max * 100}%"></i><i class="ba" style="width:${a / max * 100}%"></i></div></td><td class="n">${p ? hm(p) : '–'}</td><td class="n">${a ? hm(a) : '–'}</td></tr>` : '';
  const rows = PILLARS.map(([k, n]) => row(n, P.pil[k], A.pil[k])).join('') + row('기둥 없음', P.other, A.other);
  return `<section class="card" aria-labelledby="h-sum"><h2 id="h-sum">하루 시간</h2>
    <p class="muted">계획 ${hm(P.total)} · 실제 ${hm(A.total)} <span class="lg bp"></span>계획 <span class="lg ba"></span>실제</p>
    ${rows ? `<div class="tw"><table class="cmp"><thead><tr><th>기둥</th><th></th><th class="n">계획</th><th class="n">실제</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">시간이 적힌 블록이 없습니다.</p>'}</section>`;
}
const SRC = { user: '직접', save: '저장', auto: '자동' };
function endHTML(vm) {
  const { day } = vm, fin = dayScores(day), bs = basis(day, vm.tx, vm.rules), fk = focusOf(vm.prefs.focus, vm.date);
  const src = k => ((day.scUser || {})[k] > 0 || (day.scUser || {})[k] === 0 && k in (day.scUser || {}) ? 'user' : (day.score || {})[k] > 0 ? 'save' : (day.scAuto || {})[k] > 0 ? 'auto' : '');
  const rows = PILLARS.map(([k, n]) => {
    const v = fin[k] || 0, so = src(k), b = bs[k];
    const why = b.plan || b.actual ? `계획 ${hm(b.plan) || '0분'} · 실제 ${hm(b.actual) || '0분'}` : '시간 기록 없음';
    return `<li class="sr"><div class="sn"><b>${esc(n)}</b>${k === fk ? `<span class="tag">중점 ×${FOCUS_MULT}</span>` : ''}<small>${why}</small></div>
      <div class="ss"><button type="button" class="ico sm" data-sc="${k}:-1" aria-label="${esc(n)} 점수 내리기">−</button><output aria-label="${esc(n)} 점수">${v || '–'}</output><button type="button" class="ico sm" data-sc="${k}:1" aria-label="${esc(n)} 점수 올리기">＋</button></div>
      <div class="sx">${so ? `<span class="tag">${SRC[so]}</span>` : ''}${so === 'user' ? `<button type="button" class="pill sm" data-sc-auto="${k}">자동으로</button>` : ''}</div></li>`;
  }).join('');
  const t = vm.sum ? vm.sum.today : { xp: 0, per: {} }, L = vm.sum ? vm.sum.level : null;
  const ev = day.eval || {};
  const list = f => [0, 1, 2].map(i => `<input type="text" data-ev="${f}:${i}" value="${esc((Array.isArray(ev[f]) ? ev[f][i] : '') || '')}" aria-label="${EVAL_LISTS[f]} ${i + 1}" placeholder="${EVAL_LISTS[f]} ${i + 1}">`).join('');
  return `<section class="card" aria-labelledby="h-sc"><h2 id="h-sc">오늘 점수</h2>
    <p class="muted">시간표(계획 대비 실제)로 자동 초안을 냅니다. 시간으로 재기 어려운 기둥은 직접 매기십시오. 0~10점.</p><ul class="sc">${rows}</ul></section>
    <section class="card" aria-labelledby="h-xp"><h2 id="h-xp">오늘 경험치</h2>
      <p class="now">+${t.xp} XP${fk ? ` <small class="muted">(중점 기둥 ×${FOCUS_MULT} 포함)</small>` : ''}</p>
      ${L ? `<p class="muted">전체 Lv.${L.level} · 다음 레벨까지 ${L.toNext} XP${vm.sum.streak ? ` · 연속 ${vm.sum.streak}일` : ''}</p><div class="bar" role="progressbar" aria-valuenow="${L.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${L.pct}%"></i></div>` : ''}</section>
    <section class="card" aria-labelledby="h-ev"><h2 id="h-ev">돌아봄</h2>
      <div class="evg"><b>${EVAL_LISTS.mgrat}</b>${list('mgrat')}</div><div class="evg"><b>${EVAL_LISTS.great}</b>${list('great')}</div>
      ${Object.entries(EVAL_LINES).map(([f, l]) => `<label class="f">${l}<input type="text" data-ev="${f}" value="${esc(ev[f] || '')}"></label>`).join('')}</section>`;
}

/* 하루 노트: 하루에 쓴 모든 기록의 유일한 입력 자리 */
function noteTitle(n) { return (n.title || String(n.txt || '').split('\n')[0] || '(제목 없음)').slice(0, 40); }
function notePath(vm, n) { const p = PILLARS.find(x => x[0] === n.k); return [p ? p[1] : '', n.c, n.s].filter(Boolean).join(' › '); }
function notesHTML(vm) {
  const list = (vm.day.notes || []).slice().sort((a, b) => String(a.hm || '').localeCompare(String(b.hm || '')) || (a.ts || 0) - (b.ts || 0));
  return `<section class="card" aria-labelledby="h-nt"><h2 id="h-nt">하루 노트 <button type="button" class="pill" data-note-add>＋ 노트</button></h2>
    ${list.length ? `<ul class="nl">${list.map(n => `<li><button type="button" class="nb" data-note="${esc(n.id)}"><span class="nt">${esc(n.hm || '')}</span><span class="nm"><b>${esc(noteTitle(n))}</b>${notePath(vm, n) ? `<small>${esc(notePath(vm, n))}</small>` : ''}</span></button></li>`).join('')}</ul>` : '<p class="muted">아직 노트가 없습니다. 위 입력칸에 “메모: …”라고 쓰거나 ＋ 노트를 누르십시오.</p>'}</section>`;
}

function openNote(vm, act, id) {
  const isNew = !id, n = isNew ? { hm: vm.now.hm, k: '', c: '', s: '', title: '', txt: '', ln: null } : { ...vm.day.notes.find(x => x.id === id) };
  if (!n) return;
  const blocks = [...(vm.day.plan || []).map(b => ({ ...b, kd: '계획' })), ...(vm.day.actual || []).map(b => ({ ...b, kd: '실제' }))].filter(b => b.s);
  const cs = [...new Set((vm.day.notes || []).map(x => x.c).filter(Boolean))];
  const html = `<form class="ed" data-ned novalidate>
    <label class="f">제목<input id="nd-title" type="text" value="${esc(n.title || '')}" autocomplete="off"></label>
    <label class="f">내용<textarea id="nd-txt" rows="5">${esc(n.txt || '')}</textarea></label>
    <div class="g2"><label class="f">시각<input id="nd-hm" type="time" value="${esc(n.hm || '')}"></label>
      <label class="f">대분류<select id="nd-k"><option value="">(없음)</option>${PILLARS.map(([k, nm]) => `<option value="${k}" ${k === n.k ? 'selected' : ''}>${esc(nm)}</option>`).join('')}</select></label></div>
    <div class="g2"><label class="f">중분류<input id="nd-c" type="text" list="nd-cs" value="${esc(n.c || '')}"><datalist id="nd-cs">${cs.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
      <label class="f">소분류<input id="nd-s" type="text" value="${esc(n.s || '')}"></label></div>
    <label class="f">연결한 시간 블록<select id="nd-ln"><option value="">(연결 없음)</option>${blocks.map(b => `<option value="${esc(b.id)}" ${b.id === n.ln ? 'selected' : ''}>${b.kd} ${b.s}~${b.e} ${esc(b.act || b.cat || '')}</option>`).join('')}</select></label>
    <div class="row sp"><button class="btn" type="submit">저장</button>${!isNew ? '<button type="button" class="btn ghost danger" data-nd-del>삭제</button>' : ''}</div></form>`;
  openSheet({
    title: `하루 노트 · ${labelDate(vm.date)}`, html,
    onMount(el, close) {
      const $ = q => el.querySelector(q);
      $('[data-ned]').onsubmit = async ev => {
        ev.preventDefault();
        const f = { title: $('#nd-title').value, txt: $('#nd-txt').value, hm: $('#nd-hm').value, k: $('#nd-k').value, c: $('#nd-c').value, s: $('#nd-s').value, ln: $('#nd-ln').value || null };
        if (!f.title.trim() && !f.txt.trim()) { $('#nd-title').focus(); return; }
        const r = isNew ? await act.addNote(f) : await act.editNote(id, f);
        close(); toast('노트를 저장했습니다.', { label: '되돌리기', fn: () => act.undo(r) });
      };
      const d = $('[data-nd-del]'); if (d) d.onclick = async () => { const r = await act.delNote(id); close(); toast('노트를 삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
    },
  });
}

/* ---------- 편집 시트 ---------- */
function openEditor(vm, act, kind, id) {
  const list = kind === 'plan' ? vm.day.plan : vm.day.actual;
  const isNew = !id;
  const slot = nextSlot(vm.day.plan || [], vm.now.hm);
  const b = isNew ? { s: slot.s, e: slot.e, act: '', cat: '', sub: '', who: '', loc: '', memo: '', amt: '' } : { ...list.find(x => x.id === id) };
  if (!b) return;
  const done = kind === 'plan' && !isNew && doneIds(vm.day).has(id);
  const cats = catNames(vm.tx), cur = catByName(vm.tx, b.cat);
  const html = `<form class="ed" data-ed novalidate>
    <label class="f">무엇을<input id="ed-act" type="text" value="${esc(b.act)}" placeholder="예: 보고서 작성" autocomplete="off"></label>
    <div class="g2"><label class="f">시작<input id="ed-s" type="time" value="${esc(b.s || '')}"></label><label class="f">끝<input id="ed-e" type="time" value="${esc(b.e || '')}"></label></div>
    <div class="g2"><label class="f">분류<select id="ed-cat"><option value="">(분류 없음)</option>${cats.map(n => `<option ${n === b.cat ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="f">소분류<input id="ed-sub" type="text" list="ed-subs" value="${esc(b.sub || '')}"><datalist id="ed-subs">${((cur && cur.subs) || []).map(s => `<option value="${esc(s)}">`).join('')}</datalist></label></div>
    <label class="f">함께한 사람<input id="ed-who" type="text" list="ed-ppl" value="${esc(b.who || '')}" placeholder="여러 명은 쉼표로"><datalist id="ed-ppl">${vm.people.map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
    <label class="f">장소<input id="ed-loc" type="text" value="${esc(b.loc || '')}"></label>
    ${kind === 'actual' ? `<label class="f">지출 금액<input id="ed-amt" type="text" inputmode="numeric" value="${esc(b.amt || '')}" placeholder="예: 9000"></label>` : ''}
    <label class="f">메모<textarea id="ed-memo" rows="2">${esc(b.memo || '')}</textarea></label>
    <p class="err" id="ed-err" role="alert" hidden></p>
    <div class="row sp"><button class="btn" type="submit">저장</button>
      ${kind === 'plan' && !isNew ? `<button type="button" class="btn ghost" data-ed-done>${done ? '↩ 계획대로 취소' : '✓ 계획대로 했다'}</button>` : ''}
      ${!isNew ? '<button type="button" class="btn ghost danger" data-ed-del>삭제</button>' : ''}</div></form>`;
  openSheet({
    title: `${kind === 'plan' ? '계획' : '실제로 한 일'} · ${labelDate(vm.date)}`, html,
    onMount(el, close) {
      const $ = s => el.querySelector(s), err = m => { const e = $('#ed-err'); e.textContent = m; e.hidden = !m; };
      $('[data-ed]').onsubmit = async ev => {
        ev.preventDefault();
        const s = $('#ed-s').value, e = $('#ed-e').value;
        if (!s) return err('시작 시각을 넣어 주십시오.');
        if (e && e === s) return err('시작과 끝이 같습니다.');
        const f = { act: $('#ed-act').value, s, e: e || addMin(s, 60), cat: $('#ed-cat').value, sub: $('#ed-sub').value, who: $('#ed-who').value, loc: $('#ed-loc').value, memo: $('#ed-memo').value };
        if (kind === 'actual') f.amt = $('#ed-amt').value.trim();
        const r = isNew ? await act.add(kind, f) : await act.edit(kind, id, f);
        close(); toast(isNew ? '블록을 넣었습니다.' : '저장했습니다.', r && r.undo ? { label: '되돌리기', fn: () => act.undo(r) } : null);
      };
      const del = $('[data-ed-del]'); if (del) del.onclick = async () => { const r = await act.del(kind, id); close(); toast('삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
      const dn = $('[data-ed-done]'); if (dn) dn.onclick = async () => { const r = done ? await act.planUndo(id) : await act.planDone([id]); close(); toast(done ? '계획대로 한 기록을 취소했습니다.' : '실제 시간표에 넣었습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
    },
  });
}

/* ---------- 입력 연결 ---------- */
function bind(root, act) {
  const vm = new Proxy({}, { get: (_, k) => root.__vm[k] });
  const $ = s => root.querySelector(s);
  root.addEventListener('click', e => {
    const t = e.target;
    const go = t.closest('[data-go]'); if (go) { const n = +go.dataset.go; return act.goDate(n === 0 ? vm.today : addD(vm.date, n)); }
    const m = t.closest('[data-mode]'); if (m) return act.setMode(m.dataset.mode);
    const add = t.closest('[data-add]'); if (add) return openEditor(vm, act, add.dataset.add, '');
    if (t.closest('[data-plan-all]')) return act.planDone().then(r => toast(r.added ? `${r.added}개를 실제 시간표에 넣었습니다.` : '넣을 계획이 없습니다.', r.added ? { label: '되돌리기', fn: () => act.undo(r) } : null));
    const sc = t.closest('[data-sc]'); if (sc) { const [k, dl] = sc.dataset.sc.split(':'); return act.bumpScore(k, +dl); }
    const sa = t.closest('[data-sc-auto]'); if (sa) return act.setScore(sa.dataset.scAuto, null);
    if (t.closest('[data-note-add]')) return openNote(vm, act, '');
    const nb = t.closest('[data-note]'); if (nb) return openNote(vm, act, nb.dataset.note);
    const qk = t.closest('[data-qk]'); if (qk) return act.setKind(qk.dataset.qk);
    const blk = t.closest('[data-blk]'); if (blk && !t.closest('[data-grip]')) { if (drag.moved) { drag.moved = false; return; } return openEditor(vm, act, blk.dataset.kind, blk.dataset.blk); }
  });
  root.addEventListener('keydown', e => { const blk = e.target.closest && e.target.closest('[data-blk]'); if (blk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEditor(vm, act, blk.dataset.kind, blk.dataset.blk); } });
  $('[data-dpick]').onchange = e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) act.goDate(e.target.value); };
  $('#qin').addEventListener('input', e => act.typing(e.target.value));
  $('[data-q]').onsubmit = async e => { e.preventDefault(); const v = $('#qin').value.trim(); if (!v) return; const r = await act.submitQuick(v); if (r && r.ok) { $('#qin').value = ''; } };
  root.addEventListener('change', e => {
    const d = e.target.closest('[data-pri-done]'); if (d) return act.setPri(+d.dataset.priDone, { done: d.checked });
    const rd = e.target.closest('[data-rdone]'); if (rd) return act.toggleRule(rd.dataset.rdone);
    const ev = e.target.closest('[data-ev]'); if (ev) { const [f, i] = ev.dataset.ev.split(':'); return act.setEval(f, ev.value, i === undefined ? undefined : +i); }
    const t = e.target.closest('[data-pri-text]'); if (t) return act.setPri(+t.dataset.priText, { text: t.value });
  });
  bindDrag(root, vm, act);
}

/* 끌어서 옮기기(길게 눌러 잡기) · 아래 손잡이로 길이 조절 */
const drag = { moved: false };
function bindDrag(root, vm, act) {
  let st = null, timer = 0;
  const lo = () => +root.querySelector('.tlbody').dataset.lo;
  const stop = () => { clearTimeout(timer); timer = 0; st = null; };
  root.addEventListener('touchmove', e => { if (st && st.armed) e.preventDefault(); }, { passive: false });
  root.addEventListener('pointerdown', e => {
    const blk = e.target.closest('[data-blk]'); if (!blk || e.button > 0) return;
    const grip = !!e.target.closest('[data-grip]'), kind = blk.dataset.kind, id = blk.dataset.blk;
    const list = kind === 'plan' ? vm.day.plan : vm.day.actual, b = list.find(x => x.id === id); if (!b) return;
    const p = span(b); st = { blk, kind, id, y0: e.clientY, s0: p[0], e0: p[1], grip, armed: grip, pid: e.pointerId, moved: false };
    if (grip) { blk.setPointerCapture(e.pointerId); blk.classList.add('drag'); e.preventDefault(); }
    else timer = setTimeout(() => { if (st) { st.armed = true; blk.setPointerCapture(st.pid); blk.classList.add('drag'); if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) { /* 무시 */ } } } }, 350);
  });
  root.addEventListener('pointermove', e => {
    if (!st) return;
    if (!st.armed) { if (Math.abs(e.clientY - st.y0) > 8) stop(); return; }
    const dm = snap((e.clientY - st.y0) / PX), L = lo();
    if (Math.abs(e.clientY - st.y0) > 4) st.moved = true;
    if (st.grip) { const end = Math.max(st.s0 + 10, st.e0 + dm); st.blk.style.height = Math.max((end - st.s0) * PX, 22) + 'px'; st.val = end; }
    else { const s = Math.max(0, Math.min(1440 - (st.e0 - st.s0), st.s0 + dm)); st.blk.style.top = (s - L) * PX + 'px'; st.val = s; }
  });
  const end = async e => {
    if (!st) return; const s = st; stop();
    s.blk.classList.remove('drag');
    if (!s.armed || !s.moved || s.val == null) return;
    drag.moved = true; setTimeout(() => { drag.moved = false; }, 400);
    const r = s.grip ? await act.resize(s.kind, s.id, s.val) : await act.move(s.kind, s.id, s.val);
    toast(s.grip ? '길이를 바꿨습니다.' : '옮겼습니다.', { label: '되돌리기', fn: () => act.undo(r) });
  };
  root.addEventListener('pointerup', end); root.addEventListener('pointercancel', () => { if (st) { st.blk.classList.remove('drag'); } stop(); });
}
