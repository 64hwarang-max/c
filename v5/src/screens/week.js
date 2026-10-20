/* screens/week — 주 화면: 중점 기둥, 기둥 균형판, 일곱 날, 할 일, 주 마무리. 그리기·입력만 한다. */
import { esc } from '../ui/html.js';
import { openSheet, toast } from '../ui/sheet.js';
import { PILLARS } from '../core/schema.js';
import { addD } from '../core/date.js';
import { weekDates, daySummary, weakest } from '../domain/week.js';
import { taskTitle, BUCKETS } from '../domain/tasks.js';
import { addMin } from '../domain/blocks.js';

const WKD = '일월화수목금토';
const md = d => `${+d.slice(5, 7)}월 ${+d.slice(8)}일`;
const PRIO = ['', '중요', '매우 중요'];

export function renderWeek(root, vm, act) {
  if (!root.querySelector('[data-week]')) { root.innerHTML = '<div data-week></div>'; bindWeek(root, act); }
  root.__vm = vm;
  root.querySelector('[data-week]').innerHTML = html(vm);
}

function html(vm) {
  const dates = weekDates(vm.ws), isNow = vm.ws === vm.thisWs, fk = (vm.prefs.focus || {})[vm.ws] || '', nk = (vm.prefs.focus || {})[addD(vm.ws, 7)] || '';
  const wrap = vm.wrap || {};
  const bal = PILLARS.map(([k, n]) => {
    const b = vm.bal.per[k], mx = 10, d = b.delta;
    return `<li class="br"><span class="bn">${esc(n)}${k === fk ? ' <span class="tag">중점</span>' : ''}</span>
      <div class="bb" role="img" aria-label="${esc(n)} 일평균 ${b.avg}점, 지난주 ${b.prev}점"><i class="b1" style="width:${b.avg / mx * 100}%"></i><i class="b0" style="left:${b.prev / mx * 100}%"></i></div>
      <span class="bv">${b.avg}<small class="${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '–'}</small></span></li>`;
  }).join('');
  const strip = dates.map(d => {
    const s = daySummary(vm.all.get(d), vm.prefs.focus), fut = d > vm.today;
    return `<button type="button" class="dc${d === vm.today ? ' now' : ''}${fut ? ' fut' : ''}" data-day="${d}" aria-label="${md(d)} ${WKD[new Date(d + 'T00:00').getDay()]}요일 열기">
      <b>${WKD[new Date(d + 'T00:00').getDay()]}</b><span>${+d.slice(8)}</span><small>${s.plan ? `${s.done}/${s.plan}` : '·'}</small>${s.xp ? `<small class="xp">+${s.xp}</small>` : ''}</button>`;
  }).join('');
  const t = vm.groups, open = BUCKETS.map(([k, l]) => (t[k].length ? `<h3 class="gh">${l} <span class="muted">${t[k].length}</span></h3><ul class="tl2">${t[k].map(taskRow).join('')}</ul>` : '')).join('');
  const done = t.done.slice(0, 5);
  return `<div class="datebar"><button type="button" class="ico" data-wk="-1" aria-label="지난주">‹</button><div class="dlabel">${md(vm.ws)} ~ ${md(addD(vm.ws, 6))}</div><button type="button" class="ico" data-wk="1" aria-label="다음주">›</button>${isNow ? '' : '<button type="button" class="pill" data-wk="0">이번 주</button>'}</div>
  <section class="card" aria-labelledby="w-f"><h2 id="w-f">이번 주 중점 기둥</h2><p class="muted">고른 기둥의 하루 점수가 경험치에 ×1.5로 들어갑니다. 한 주에 하나만 고릅니다.</p>
    <div class="chips" role="group" aria-label="중점 기둥">${PILLARS.map(([k, n]) => `<button type="button" class="chip${k === fk ? ' on' : ''}" data-focus="${k}" aria-pressed="${k === fk}">${esc(n)}</button>`).join('')}<button type="button" class="chip${fk ? '' : ' on'}" data-focus="" aria-pressed="${!fk}">없음</button></div></section>
  <section class="card" aria-labelledby="w-b"><h2 id="w-b">기둥 균형</h2><p class="muted">하루 점수의 일평균(기록 없는 날은 0점) · 막대 이번 주, 눈금 지난주</p><ul class="bal">${bal}</ul></section>
  <section class="card" aria-labelledby="w-d"><h2 id="w-d">일곱 날</h2><div class="strip">${strip}</div><p class="muted">칸 안 숫자는 한 계획/전체 계획, 아래는 경험치입니다. 누르면 그 날의 오늘 화면으로 갑니다.</p></section>
  <section class="card" aria-labelledby="w-t"><h2 id="w-t">할 일</h2>
    <form class="qbox" data-tadd autocomplete="off"><input type="text" id="tin" placeholder="예: 금요일까지 서류 제출" aria-label="할 일 입력" enterkeyhint="done"><button class="btn" type="submit">넣기</button></form>
    ${open || '<p class="muted">열려 있는 할 일이 없습니다.</p>'}
    ${done.length ? `<h3 class="gh">최근 완료 <span class="muted">${t.done.length}</span></h3><ul class="tl2">${done.map(taskRow).join('')}</ul>` : ''}</section>
  <section class="card" aria-labelledby="w-w"><h2 id="w-w">주 마무리${vm.thisWs === vm.ws && vm.today >= addD(vm.ws, 6) ? ' <span class="tag">오늘 일요일</span>' : ''}</h2>
    <label class="f">이번 주 잘한 것<textarea data-wrap="good" rows="2">${esc(wrap.good || '')}</textarea></label>
    <label class="f">이번 주 아쉬운 것<textarea data-wrap="bad" rows="2">${esc(wrap.bad || '')}</textarea></label>
    <label class="f">다음 주 첫 계획<textarea data-wrap="next" rows="2">${esc(wrap.next || '')}</textarea></label>
    <p class="muted">다음 주 중점 기둥 ${vm.today >= vm.ws ? `· 이번 주 가장 낮은 기둥: <b>${esc(PILLARS.find(p => p[0] === weakest(vm.bal))[1])}</b>` : ''}</p>
    <div class="chips" role="group" aria-label="다음 주 중점 기둥">${PILLARS.map(([k, n]) => `<button type="button" class="chip${k === nk ? ' on' : ''}" data-nfocus="${k}" aria-pressed="${k === nk}">${esc(n)}</button>`).join('')}<button type="button" class="chip${nk ? '' : ' on'}" data-nfocus="" aria-pressed="${!nk}">없음</button></div></section>`;
}
function taskRow(t) {
  return `<li class="tr${t.done ? ' dn' : ''}"><input type="checkbox" data-tdone="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="${esc(taskTitle(t))} 완료"><button type="button" class="tt" data-task="${esc(t.id)}"><b>${esc(taskTitle(t))}</b><small>${[t.due ? md(t.due) : '', t.time || '', PRIO[t.prio] || ''].filter(Boolean).join(' · ')}</small></button></li>`;
}

function openTask(vm, act, id) {
  const t = vm.tasks.items.find(x => x.id === id); if (!t) return;
  const sched = vm.today;
  openSheet({
    title: '할 일', html: `<form class="ed" data-ted novalidate>
      <label class="f">할 일<input id="tk-title" type="text" value="${esc(taskTitle(t))}" autocomplete="off"></label>
      <div class="g2"><label class="f">마감일<input id="tk-due" type="date" value="${esc(t.due || '')}"></label><label class="f">시각<input id="tk-time" type="time" value="${esc(t.time || '')}"></label></div>
      <label class="f">중요도<select id="tk-prio">${PRIO.map((l, i) => `<option value="${i}" ${(t.prio || 0) === i ? 'selected' : ''}>${l || '보통'}</option>`).join('')}</select></label>
      <fieldset class="fs"><legend>시간표에 넣기</legend><div class="g2"><label class="f">날짜<input id="tk-sd" type="date" value="${esc(t.due && t.due >= sched ? t.due : sched)}"></label><label class="f">시작<input id="tk-ss" type="time" value="${esc(t.time || '09:00')}"></label></div>
      <button type="button" class="btn ghost" data-tk-plan>계획 블록으로 넣기</button></fieldset>
      <p class="err" id="tk-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">저장</button><button type="button" class="btn ghost danger" data-tk-del>삭제</button></div></form>`,
    onMount(el, close) {
      const $ = q => el.querySelector(q);
      $('[data-ted]').onsubmit = async ev => { ev.preventDefault(); const title = $('#tk-title').value.trim(); if (!title) { $('#tk-err').textContent = '할 일을 적어 주십시오.'; $('#tk-err').hidden = false; return; }
        const r = await act.editTask(id, { title, due: $('#tk-due').value, time: $('#tk-time').value, prio: +$('#tk-prio').value }); close(); toast('저장했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
      $('[data-tk-del]').onclick = async () => { const r = await act.deleteTask(id); close(); toast('삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
      $('[data-tk-plan]').onclick = async () => { const d = $('#tk-sd').value, s = $('#tk-ss').value; if (!d || !s) { $('#tk-err').textContent = '날짜와 시작 시각을 넣어 주십시오.'; $('#tk-err').hidden = false; return; }
        const r = await act.planTask(id, d, s, addMin(s, 60)); close(); toast(`${md(d)} ${s} 계획에 넣었습니다.`, { label: '되돌리기', fn: () => act.undo(r) }); };
    },
  });
}

function bindWeek(root, act) {
  const vm = new Proxy({}, { get: (_, k) => root.__vm[k] });
  root.addEventListener('click', e => {
    const t = e.target;
    const wk = t.closest('[data-wk]'); if (wk) { const n = +wk.dataset.wk; return act.goWeek(n === 0 ? vm.thisWs : addD(vm.ws, 7 * n)); }
    const f = t.closest('[data-focus]'); if (f) return act.setFocus(vm.ws, f.dataset.focus);
    const nf = t.closest('[data-nfocus]'); if (nf) return act.setFocus(addD(vm.ws, 7), nf.dataset.nfocus);
    const dc = t.closest('[data-day]'); if (dc) return act.openDay(dc.dataset.day);
    const tk = t.closest('[data-task]'); if (tk) return openTask(vm, act, tk.dataset.task);
  });
  root.addEventListener('change', e => {
    const d = e.target.closest('[data-tdone]'); if (d) return act.toggleTask(d.dataset.tdone);
    const w = e.target.closest('[data-wrap]'); if (w) return act.setWrap(vm.ws, w.dataset.wrap, w.value);
  });
  root.addEventListener('submit', async e => {
    if (!e.target.matches('[data-tadd]')) return; e.preventDefault();
    const inp = e.target.querySelector('#tin'), v = inp.value.trim(); if (!v) return;
    const r = await act.addTaskText(v); if (r) { toast(r.msg, { label: '되돌리기', fn: () => act.undo(r) }); }
  });
}
