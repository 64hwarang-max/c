/* screens/pillar — 기둥 탭: 일곱 기둥 한눈에 보기와 기둥 방(레벨·목표·반복). 그리기·입력만 한다. */
import { esc } from '../ui/html.js';
import { openSheet, toast } from '../ui/sheet.js';
import { PILLARS } from '../core/schema.js';
import { LV, goalTitle, goalsOf, isCurrent, perLabel, progress, pct } from '../domain/goals.js';
import { KIND_LABEL, pillarOfRule, isDone, streakOf } from '../domain/rules.js';

const pName = k => (PILLARS.find(p => p[0] === k) || [k, k])[1];
const GKIND = { proj: '단계', once: '달성', num: '수치', habit: '습관' };

export function renderPillar(root, vm, act) {
  if (!root.querySelector('[data-pil]')) { root.innerHTML = '<div data-pil></div>'; bindPillar(root, act); }
  root.__vm = vm;
  root.querySelector('[data-pil]').innerHTML = vm.room ? roomHTML(vm) : listHTML(vm);
}

function listHTML(vm) {
  const fk = (vm.prefs.focus || {})[vm.ws] || '';
  return `<h2 class="ph">기둥</h2><p class="muted">기둥을 누르면 그 기둥의 목표와 반복을 봅니다.</p>
  <div class="pgrid">${PILLARS.map(([k, n]) => {
    const p = vm.sum.pillars[k], b = vm.bal.per[k], gs = goalsOf(vm.goals).filter(g => g.area === k && isCurrent(g, vm.today) && !g.done).length, rs = vm.rules.filter(r => pillarOfRule(r) === k).length;
    return `<button type="button" class="pc" data-room="${k}"><b>${esc(n)}${k === fk ? ' <span class="tag">중점</span>' : ''}</b><span class="lv">Lv.${p.level}</span>
      <div class="bar" aria-hidden="true"><i style="width:${p.pct}%"></i></div><small>이번 주 ${b.avg}점 · 목표 ${gs} · 반복 ${rs}</small></button>`;
  }).join('')}</div>`;
}

function roomHTML(vm) {
  const k = vm.room, n = pName(k), p = vm.sum.pillars[k], b = vm.bal.per[k], fk = (vm.prefs.focus || {})[vm.ws] || '';
  const gl = goalsOf(vm.goals), mine = gl.filter(g => g.area === k && isCurrent(g, vm.today));
  const order = LV.map(x => x[0]);
  mine.sort((a, c) => order.indexOf(a.lv) - order.indexOf(c.lv));
  const gRow = g => { const pr = pct(progress(g, gl, vm.all, vm.today)); return `<li class="gr${g.done ? ' dn' : ''}"><input type="checkbox" data-gdone="${esc(g.id)}" ${g.done ? 'checked' : ''} aria-label="${esc(goalTitle(g))} 달성"><button type="button" class="tt" data-goal="${esc(g.id)}"><b>${esc(goalTitle(g))}</b><small>${esc(perLabel(g.lv, g.per))} · ${GKIND[g.kind || 'proj']} · ${pr}%</small><span class="bar" aria-hidden="true"><i style="width:${pr}%"></i></span></button></li>`; };
  const rules = vm.rules.filter(r => pillarOfRule(r) === k);
  const rRow = r => { const done = isDone(vm.dayToday, r.id), st = r.kind === 'habit' ? streakOf(vm.all, r.id, vm.today) : 0; return `<li class="tr${done ? ' dn' : ''}"><input type="checkbox" data-rule="${esc(r.id)}" ${done ? 'checked' : ''} aria-label="${esc(r.name)} 오늘 했다"><button type="button" class="tt" data-ruleedit="${esc(r.id)}"><b>${esc(r.name)}</b><small>${KIND_LABEL[r.kind] || r.kind}${st ? ` · 연속 ${st}일` : ''}</small></button></li>`; };
  return `<div class="datebar"><button type="button" class="ico" data-back aria-label="기둥 목록">‹</button><div class="dlabel">${esc(n)}</div></div>
  <section class="card" aria-labelledby="r-h"><h2 id="r-h">${esc(n)} Lv.${p.level}</h2>
    <div class="bar" role="progressbar" aria-valuenow="${p.pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p.pct}%"></i></div>
    <p class="muted">누적 ${p.xp} XP · 다음 레벨까지 ${p.toNext} XP · 이번 주 일평균 ${b.avg}점(지난주 ${b.prev}점)</p>
    <div class="row"><button type="button" class="chip${k === fk ? ' on' : ''}" data-rfocus="${k}" aria-pressed="${k === fk}">${k === fk ? '이번 주 중점 기둥' : '이번 주 중점으로'}</button></div></section>
  <section class="card" aria-labelledby="r-g"><h2 id="r-g">목표 <button type="button" class="pill" data-goal-add>＋ 목표</button></h2>
    ${mine.length ? `<ul class="tl2">${mine.map(gRow).join('')}</ul>` : '<p class="muted">지금 기간의 목표가 없습니다.</p>'}</section>
  <section class="card" aria-labelledby="r-r"><h2 id="r-r">반복 <button type="button" class="pill" data-rule-add>＋ 습관</button></h2>
    ${rules.length ? `<ul class="tl2">${rules.map(rRow).join('')}</ul>` : '<p class="muted">이 기둥에 묶인 반복이 없습니다.</p>'}</section>`;
}

function openGoal(vm, act, id) {
  const gl = goalsOf(vm.goals), g0 = id ? gl.find(x => x.id === id) : null; if (id && !g0) return;
  const g = g0 || { title: '', lv: 'm', kind: 'proj', area: vm.room, tasks: [] };
  const habits = vm.rules.filter(r => r.kind === 'habit');
  openSheet({
    title: id ? '목표' : '새 목표', html: `<form class="ed" data-ged novalidate>
      <label class="f">목표<input id="g-title" type="text" value="${esc(goalTitle(g))}" autocomplete="off"></label>
      <div class="g2"><label class="f">기간<select id="g-lv" ${id ? 'disabled' : ''}>${LV.map(([v, l]) => `<option value="${v}" ${v === g.lv ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">재는 방식<select id="g-kind">${Object.entries(GKIND).map(([v, l]) => `<option value="${v}" ${v === (g.kind || 'proj') ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <div id="g-num" class="g2" ${g.kind === 'num' ? '' : 'hidden'}><label class="f">시작값<input id="g-n0" type="text" inputmode="decimal" value="${esc(g.n0 ?? '')}"></label><label class="f">목표값<input id="g-tgt" type="text" inputmode="decimal" value="${esc(g.tgt ?? '')}"></label><label class="f">현재값<input id="g-cur" type="text" inputmode="decimal" value="${esc(g.cur ?? '')}"></label></div>
      <label class="f" id="g-hab" ${g.kind === 'habit' ? '' : 'hidden'}>연결할 습관<select id="g-hid"><option value="">(고르기)</option>${habits.map(h => `<option value="${esc(h.hid || h.id.replace(/^habit:/, ''))}" ${(h.hid || h.id.replace(/^habit:/, '')) === g.hid ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>
      ${id ? `<div id="g-steps"><b class="muted">단계</b><ul class="tl2">${(g.tasks || []).map(s => `<li class="tr${s.done ? ' dn' : ''}"><input type="checkbox" data-sdone="${esc(s.id)}" ${s.done ? 'checked' : ''} aria-label="${esc(s.title || s.text || '')} 완료"><span class="tt"><b>${esc(s.title || s.text || '')}</b></span><button type="button" class="pill sm" data-sdel="${esc(s.id)}" aria-label="단계 삭제">✕</button></li>`).join('')}</ul>
        <div class="qbox"><input id="g-step" type="text" placeholder="단계 추가" aria-label="단계 추가"><button type="button" class="btn" data-sadd>추가</button></div></div>` : ''}
      <p class="err" id="g-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">저장</button>${id ? '<button type="button" class="btn ghost danger" data-g-del>삭제</button>' : ''}</div></form>`,
    onMount(el, close) {
      const $ = q => el.querySelector(q), err = m => { $('#g-err').textContent = m; $('#g-err').hidden = !m; };
      $('#g-kind').onchange = () => { $('#g-num').hidden = $('#g-kind').value !== 'num'; $('#g-hab').hidden = $('#g-kind').value !== 'habit'; };
      $('[data-ged]').onsubmit = async ev => {
        ev.preventDefault(); const title = $('#g-title').value.trim(); if (!title) return err('목표를 적어 주십시오.');
        const f = { title, kind: $('#g-kind').value, n0: $('#g-n0').value, tgt: $('#g-tgt').value, cur: $('#g-cur').value, hid: $('#g-hid').value };
        if (f.kind === 'habit' && !f.hid) return err('연결할 습관을 고르십시오.');
        const r = id ? await act.editGoal(id, f) : await act.addGoal({ ...f, area: vm.room, lv: $('#g-lv').value });
        close(); toast('저장했습니다.', { label: '되돌리기', fn: () => act.undo(r) });
      };
      const del = $('[data-g-del]'); if (del) del.onclick = async () => { const r = await act.deleteGoal(id); close(); toast('삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
      if (id) {
        const again = async fn => { await fn(); close(); openGoal(vm, act, id); };   // vm은 항상 최신 상태를 읽는다
        el.addEventListener('change', async e => { const s = e.target.closest('[data-sdone]'); if (s) { await act.toggleStep(id, s.dataset.sdone); close(); openGoal(vm, act, id); } });
        el.addEventListener('click', async e => {
          const d = e.target.closest('[data-sdel]'); if (d) return again(() => act.removeStep(id, d.dataset.sdel));
          if (e.target.closest('[data-sadd]')) { const v = $('#g-step').value.trim(); if (v) return again(() => act.addStep(id, v)); }
        });
      }
    },
  });
}

function openRule(vm, act, id) {
  const r0 = id ? vm.rules.find(x => x.id === id) : null; if (id && !r0) return;
  const r = r0 || { name: '', pillar: vm.room, kind: 'habit' };
  openSheet({
    title: id ? '반복' : '새 습관', html: `<form class="ed" data-red novalidate>
      <label class="f">이름<input id="ru-name" type="text" value="${esc(r.name || '')}" autocomplete="off"></label>
      <label class="f">기둥<select id="ru-pil">${PILLARS.map(([k, n]) => `<option value="${k}" ${k === pillarOfRule(r) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <p class="err" id="ru-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">저장</button>${id ? '<button type="button" class="btn ghost danger" data-ru-del>삭제</button>' : ''}</div></form>`,
    onMount(el, close) {
      const $ = q => el.querySelector(q);
      $('[data-red]').onsubmit = async ev => { ev.preventDefault(); const name = $('#ru-name').value.trim(); if (!name) { $('#ru-err').textContent = '이름을 적어 주십시오.'; $('#ru-err').hidden = false; return; }
        const res = id ? await act.editRule(id, { name, pillar: $('#ru-pil').value }) : await act.addRule({ name, pillar: $('#ru-pil').value }); close(); toast('저장했습니다.', { label: '되돌리기', fn: () => act.undo(res) }); };
      const del = $('[data-ru-del]'); if (del) del.onclick = async () => { const res = await act.deleteRule(id); close(); toast('삭제했습니다. 지난 체크 기록은 남아 있습니다.', { label: '되돌리기', fn: () => act.undo(res) }); };
    },
  });
}

function bindPillar(root, act) {
  const vm = new Proxy({}, { get: (_, k) => root.__vm[k] });
  root.addEventListener('click', e => {
    const t = e.target;
    const rm = t.closest('[data-room]'); if (rm) return act.openRoom(rm.dataset.room);
    if (t.closest('[data-back]')) return act.openRoom('');
    const f = t.closest('[data-rfocus]'); if (f) return act.setFocus(vm.ws, vm.prefs.focus && vm.prefs.focus[vm.ws] === f.dataset.rfocus ? '' : f.dataset.rfocus);
    if (t.closest('[data-goal-add]')) return openGoal(vm, act, '');
    const g = t.closest('[data-goal]'); if (g) return openGoal(vm, act, g.dataset.goal);
    if (t.closest('[data-rule-add]')) return openRule(vm, act, '');
    const re = t.closest('[data-ruleedit]'); if (re) return openRule(vm, act, re.dataset.ruleedit);
  });
  root.addEventListener('change', e => {
    const gd = e.target.closest('[data-gdone]'); if (gd) return act.editGoal(gd.dataset.gdone, { done: gd.checked });
    const ru = e.target.closest('[data-rule]'); if (ru) return act.toggleRule(ru.dataset.rule);
  });
}
