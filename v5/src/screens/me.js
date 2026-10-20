/* screens/me — 나 탭: 레벨 요약, 테마, 분류, 사람, 백업(내보내기·가져오기), 이전 점검. 그리기·입력만 한다. */
import { esc, num } from '../ui/html.js';
import { openSheet, toast } from '../ui/sheet.js';
import { PILLARS } from '../core/schema.js';
import { THEMES } from '../features/settings.js';

export function renderMe(root, vm, act) {
  if (!root.querySelector('[data-me]')) { root.innerHTML = '<div data-me></div><div data-diag></div>'; bindMe(root, act); }
  root.__vm = vm;
  const prev = root.querySelector('details.card'), keepOpen = !!(prev && prev.open);   // 다시 그려도 펼친 상태 유지
  const lv = vm.sum.level, theme = vm.prefs.theme || '', cats = vm.tx.cats || [];
  root.querySelector('[data-me]').innerHTML = `
  <section class="card" aria-labelledby="m-lv"><h2 id="m-lv">나의 성장</h2>
    <div class="lvl"><b>Lv.${lv.level}</b><div class="bar" role="img" aria-label="다음 레벨까지 ${lv.pct}%"><i style="width:${lv.pct}%"></i></div><small>${num(lv.into)} / ${num(lv.span)} XP · 누적 ${num(vm.sum.total)}</small></div>
    <p class="muted">연속 ${vm.sum.streak}일 (최고 ${vm.sum.best}일)</p>
    <ul class="pil">${PILLARS.map(([k, n]) => { const p = vm.sum.pillars[k]; return `<li><span>${esc(n)}</span><b>Lv.${p.level}</b><div class="bar"><i style="width:${p.pct}%"></i></div><small>${num(p.xp)}</small></li>`; }).join('')}</ul></section>
  <section class="card" aria-labelledby="m-th"><h2 id="m-th">화면</h2><label class="f">테마<select data-pick-theme>${THEMES.map(([v, l]) => `<option value="${v}" ${v === theme ? 'selected' : ''}>${l}</option>`).join('')}</select></label></section>
  <section class="card" aria-labelledby="m-dv"><h2 id="m-dv">기기 연동</h2>
    <p class="muted">${vm.native ? '이 기기에서 켜고 끌 수 있습니다.' : '앱(APK)에서만 동작합니다. 지금은 웹 화면이라 아무 일도 하지 않습니다.'}</p>
    <label class="chk"><input type="checkbox" data-dev="widget" ${vm.dev.widget ? 'checked' : ''}> 오늘 위젯을 기록에 맞춰 갱신</label>
    <label class="chk"><input type="checkbox" data-dev="remind" ${vm.dev.remind ? 'checked' : ''}> 계획·할 일·루틴 알림 (앞으로 이틀치)</label></section>
  <section class="card" aria-labelledby="m-c"><h2 id="m-c">분류 <button type="button" class="pill" data-cat-add>＋ 분류</button></h2>
    <p class="muted">시간 블록의 분류입니다. 기둥을 정해 두면 시간이 그 기둥으로 집계됩니다.</p>
    <ul class="tl2">${cats.map(c => `<li class="tr"><span class="dot" style="background:${esc(c.color || '#8a919c')}" aria-hidden="true"></span><button type="button" class="tt" data-cat="${esc(c.name)}"><b>${esc(c.name)}</b><small>${esc((PILLARS.find(p => p[0] === c.area) || ['', '기둥 없음'])[1])}${(c.subs || []).length ? ' · ' + esc(c.subs.join(', ')) : ''}</small></button></li>`).join('')}</ul></section>
  <section class="card" aria-labelledby="m-p"><h2 id="m-p">사람 ${vm.peopleList.length}명</h2>
    <form class="qbox" data-padd autocomplete="off"><input type="text" id="pn" placeholder="이름" aria-label="사람 이름"><button class="btn" type="submit">넣기</button></form>
    <ul class="tl2">${vm.peopleList.map(p => `<li class="tr"><span class="tt"><b>${esc(p.name)}</b></span><button type="button" class="pill sm" data-pdel="${esc(p.id)}" aria-label="${esc(p.name)} 삭제">✕</button></li>`).join('')}</ul>
    <p class="muted">이름을 시간 블록에 쓰면 ‘함께한 사람’이 자동으로 붙습니다.</p></section>
  <section class="card" aria-labelledby="m-b"><h2 id="m-b">백업</h2>
    <p class="muted">모든 기록을 파일 하나로 내보내고, 다시 가져올 수 있습니다. 예전(v6) 백업 파일도 가져옵니다. 가져오기 전에 지금 상태를 먼저 내보냅니다.</p>
    <div class="row"><button type="button" class="btn" data-export>내보내기</button><label class="btn ghost">가져오기<input type="file" accept=".json,.txt,application/json,text/plain" hidden data-import></label></div>
    <p class="muted" role="status" data-bmsg>${esc(vm.msg || '')}</p></section>
  <details class="card" ${keepOpen ? 'open' : ''}><summary><b>이전 점검(고급)</b></summary><div data-diagbox></div></details>`;
}

function catSheet(vm, act, name) {
  const c = name ? (vm.tx.cats || []).find(x => x.name === name) : { name: '', area: '', color: '#3949ab', subs: [], kw: '' }; if (!c) return;
  openSheet({
    title: name ? '분류' : '새 분류', html: `<form class="ed" data-ced novalidate>
      <label class="f">이름<input id="c-name" type="text" value="${esc(c.name)}" autocomplete="off"></label>
      <div class="g2"><label class="f">기둥<select id="c-area"><option value="">(기둥 없음)</option>${PILLARS.map(([k, n]) => `<option value="${k}" ${k === c.area ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label><label class="f">색<input id="c-color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : '#8a919c')}"></label></div>
      <label class="f">소분류(쉼표로 구분)<input id="c-subs" type="text" value="${esc((c.subs || []).join(', '))}"></label>
      <label class="f">자동 분류 낱말(쉼표로 구분)<input id="c-kw" type="text" value="${esc(c.kw || '')}" placeholder="예: 회의, 보고"></label>
      <p class="err" id="c-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">저장</button>${name ? '<button type="button" class="btn ghost danger" data-c-del>삭제</button>' : ''}</div></form>`,
    onMount(el, close) {
      const $ = q => el.querySelector(q);
      $('[data-ced]').onsubmit = async ev => {
        ev.preventDefault(); const nm = $('#c-name').value.trim(), dup = (vm.tx.cats || []).some(x => x.name === nm && x.name !== name);
        if (!nm || dup) { $('#c-err').textContent = !nm ? '이름을 적어 주십시오.' : '같은 이름의 분류가 있습니다.'; $('#c-err').hidden = false; return; }
        const r = await act.saveCat(name, { name: nm, area: $('#c-area').value, color: $('#c-color').value, subs: $('#c-subs').value, kw: $('#c-kw').value });
        close(); toast('저장했습니다.', { label: '되돌리기', fn: () => act.undo(r) });
      };
      const d = $('[data-c-del]'); if (d) d.onclick = async () => { const r = await act.deleteCat(name); close(); toast('삭제했습니다. 이 분류로 적은 지난 블록은 그대로 남습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
    },
  });
}

function importSheet(parsed, name, act) {
  const days = Object.keys(parsed.docs).filter(k => k.startsWith('v5/day:')).length;
  openSheet({
    title: '가져오기', html: `<form class="ed" data-ied><p><b>${esc(name)}</b><br>${parsed.kind === 'v5' ? '성장일지 v5 백업' : '예전(v6) 백업을 v5로 바꾼 결과'} · 일지 ${days}일${parsed.report && parsed.report.spiritScores ? ' · 영성 기록은 옮기지 않습니다' : ''}</p>
      <fieldset class="fs"><legend>어떻게 가져올까요</legend>
        <label><input type="radio" name="im" value="merge" checked> 합치기 — 지금 기록은 그대로 두고, 없는 날과 없는 항목만 더합니다</label>
        <label><input type="radio" name="im" value="replace"> 바꾸기 — 지금 기록을 지우고 파일 내용으로 바꿉니다</label></fieldset>
      <p class="muted">적용 전에 지금 상태를 파일로 내보냅니다. 내보내지 못하면 가져오지 않습니다.</p>
      <p class="err" id="i-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">가져오기</button></div></form>`,
    onMount(el, close) {
      el.querySelector('[data-ied]').onsubmit = async ev => {
        ev.preventDefault(); const mode = el.querySelector('input[name=im]:checked').value;
        try { const sum = await act.applyImport(parsed, mode); close(); toast(mode === 'merge' ? `가져왔습니다 · 새 날 ${sum.daysNew}일, 그대로 둔 날 ${sum.daysKept}일` : `바꿨습니다 · ${sum.daysReplaced}일`); }
        catch (e) { const x = el.querySelector('#i-err'); x.textContent = '가져오지 못했습니다: ' + e.message; x.hidden = false; }
      };
    },
  });
}

function bindMe(root, act) {
  const vm = new Proxy({}, { get: (_, k) => root.__vm[k] });
  root.addEventListener('click', async e => {
    const t = e.target;
    if (t.closest('[data-cat-add]')) return catSheet(vm, act, '');
    const c = t.closest('[data-cat]'); if (c) return catSheet(vm, act, c.dataset.cat);
    const pd = t.closest('[data-pdel]'); if (pd) { const r = await act.deletePerson(pd.dataset.pdel); return toast('삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); }
    if (t.closest('[data-export]')) { try { const where = await act.exportBackup(); toast('내보냈습니다 · ' + where); } catch (er) { toast('내보내지 못했습니다: ' + er.message); } }
  });
  root.addEventListener('change', async e => {
    if (e.target.matches('[data-dev]')) return act.setDevice(e.target.dataset.dev, e.target.checked);
    if (e.target.matches("[data-pick-theme]")) return act.setTheme(e.target.value);
    if (e.target.matches('[data-import]')) { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { importSheet(act.parse(await f.text()), f.name, act); } catch (er) { toast(er.message); } }
  });
  root.addEventListener('submit', async e => {
    if (!e.target.matches('[data-padd]')) return; e.preventDefault();
    const i = e.target.querySelector('#pn'), v = i.value.trim(); if (!v) return; const r = await act.addPerson(v); i.value = ''; toast('넣었습니다.', { label: '되돌리기', fn: () => act.undo(r) });
  });
}
