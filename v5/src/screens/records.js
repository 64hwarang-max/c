/* screens/records — 기록 탭: 노트(읽기 전용 모음)·재정·독서·만남. 노트·거래·만남은 오늘 화면에서만 쓰고 여기서는 보기만 한다. */
import { esc } from '../ui/html.js';
import { openSheet, toast } from '../ui/sheet.js';
import { PILLARS } from '../core/schema.js';
import { filterNotes, groupNotes, groupNotesByDate, monthFin, addMonth, meetStats, bookGroups, BOOK_ST } from '../domain/records.js';

const SUBS = [['notes', '노트'], ['fin', '재정'], ['books', '독서'], ['meet', '만남']];
const won = n => n.toLocaleString('ko-KR') + '원';
const mdR = d => `${+d.slice(5, 7)}월 ${+d.slice(8)}일`;

export function renderRecords(root, vm, act, partial) {
  if (!root.querySelector('[data-rec]')) { root.innerHTML = '<div data-rec><div class="seg" role="tablist" data-subs></div><div data-recbody></div></div>'; bindRec(root, act); partial = false; }
  root.__vm = vm;
  if (!partial) root.querySelector('[data-subs]').innerHTML = SUBS.map(([k, l]) => `<button type="button" role="tab" data-sub="${k}" aria-selected="${k === vm.log.sub}" class="${k === vm.log.sub ? 'on' : ''}">${l}</button>`).join('');
  const body = root.querySelector('[data-recbody]'), L = vm.log;
  if (partial && L.sub === 'notes') { const t = root.querySelector('[data-notelist]'); if (t) { t.innerHTML = notesListR(vm); return; } }
  body.innerHTML = L.sub === 'notes' ? notesPane(vm) : L.sub === 'fin' ? finPane(vm) : L.sub === 'books' ? booksPane(vm) : meetPane(vm);
}

/* ---------- 노트 ---------- */
function notesPane(vm) {
  const L = vm.log;
  return `<section class="card" aria-labelledby="n-h"><h2 id="n-h">하루 노트 모음</h2>
    <p class="muted">노트는 오늘 화면의 하루 노트에서 씁니다. 여기서는 분류별로 모아 봅니다. 노트를 누르면 그 날로 갑니다.</p>
    <div class="qbox"><input type="search" data-nq value="${esc(L.q)}" placeholder="제목·내용·분류 검색" aria-label="노트 검색"></div>
    <div class="g2" style="margin-top:8px"><label class="f">대분류<select data-nk><option value="">전체</option>${PILLARS.map(([k, n]) => `<option value="${k}" ${L.k === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}<option value="-" ${L.k === '-' ? 'selected' : ''}>분류 없음</option></select></label>
      <label class="f">보기<select data-nv><option value="tree" ${L.view === 'tree' ? 'selected' : ''}>분류별</option><option value="date" ${L.view === 'date' ? 'selected' : ''}>날짜별</option></select></label></div>
    <div data-notelist>${notesListR(vm)}</div></section>`;
}
const noteBtnR = n => `<li><button type="button" class="nb" data-nopen="${n.date}"><span class="nt">${n.date.slice(5).replace('-', '.')}</span><span class="nm"><b>${esc(n.title.slice(0, 40))}</b>${n.txt && n.txt.trim() !== n.title ? `<small>${esc(String(n.txt).replace(/\s+/g, ' ').slice(0, 60))}</small>` : ''}</span></button></li>`;
function notesListR(vm) {
  const L = vm.log, list = filterNotes(vm.notes, { q: L.q, k: L.k });
  if (!list.length) return `<p class="muted">${vm.notes.length ? '조건에 맞는 노트가 없습니다.' : '아직 노트가 없습니다.'}</p>`;
  const cnt = `<p class="muted">${list.length}개</p>`;
  if (L.view === 'date') return cnt + groupNotesByDate(list.slice(0, 200)).map(g => `<h3 class="gh">${mdR(g.date)}</h3><ul class="nl">${g.notes.map(noteBtnR).join('')}</ul>`).join('');
  return cnt + groupNotes(list.slice(0, 300)).map((a, i) => `<details class="tree" ${i === 0 || list.length < 12 ? 'open' : ''}><summary><b>${esc(a.name)}</b> <span class="muted">${a.count}</span></summary>${a.kids.map(b => `<details class="tree sub" open><summary>${esc(b.name)} <span class="muted">${b.count}</span></summary>${b.kids.map(c => `<div class="leaf"><span class="muted">${esc(c.name)}</span><ul class="nl">${c.notes.map(noteBtnR).join('')}</ul></div>`).join('')}</details>`).join('')}</details>`).join('');
}

/* ---------- 재정 ---------- */
function finPane(vm) {
  const ym = vm.log.ym, m = monthFin(vm.all, ym), mx = Math.max(1, ...m.cats.map(c => c.n));
  return `<div class="datebar"><button type="button" class="ico" data-ym="-1" aria-label="지난달">‹</button><div class="dlabel">${ym.slice(0, 4)}년 ${+ym.slice(5)}월</div><button type="button" class="ico" data-ym="1" aria-label="다음달">›</button></div>
  <section class="card" aria-labelledby="f-h"><h2 id="f-h">이달 요약</h2><div class="sum4"><div><small>수입</small><b>${won(m.sum.in)}</b></div><div><small>지출</small><b>${won(m.sum.out)}</b></div><div><small>나눔</small><b>${won(m.sum.give)}</b></div><div><small>남은 금액</small><b class="${m.net < 0 ? 'neg' : ''}">${won(m.net)}</b></div></div>
    <p class="muted">거래는 오늘 화면의 지출 입력에서만 적습니다.</p></section>
  ${m.cats.length ? `<section class="card" aria-labelledby="f-c"><h2 id="f-c">지출 분류</h2><ul class="bal">${m.cats.slice(0, 8).map(c => `<li class="fr"><span class="bn">${esc(c.name)}</span><div class="bb"><i class="b1" style="width:${c.n / mx * 100}%"></i></div><span class="bv">${won(c.n)}</span></li>`).join('')}</ul></section>` : ''}
  <section class="card" aria-labelledby="f-l"><h2 id="f-l">거래 ${m.rows.length}건</h2>${m.rows.length ? `<ul class="nl">${m.rows.map(r => `<li><button type="button" class="nb" data-nopen="${r.date}"><span class="nt">${r.date.slice(5).replace('-', '.')}</span><span class="nm"><b>${esc(r.item || r.cat || '(내용 없음)')}</b><small>${r.kd === 'in' ? '수입' : r.kd === 'give' ? '나눔' : '지출'}${r.cat ? ' · ' + esc(r.cat) : ''}</small></span><span class="amt ${r.kd}">${r.kd === 'in' ? '+' : '−'}${won(r.n)}</span></button></li>`).join('')}</ul>` : '<p class="muted">이 달 거래가 없습니다.</p>'}</section>`;
}

/* ---------- 독서 ---------- */
function booksPane(vm) {
  const g = bookGroups(vm.books);
  return `<section class="card" aria-labelledby="b-h"><h2 id="b-h">책 넣기</h2><form class="qbox" data-badd autocomplete="off"><input type="text" id="bt" placeholder="책 제목" aria-label="책 제목"><input type="text" id="ba" placeholder="저자(선택)" aria-label="저자" style="max-width:40%"><button class="btn" type="submit">넣기</button></form>
    <p class="muted">읽으면서 쓰는 글은 오늘 화면의 하루 노트에서 ‘독서’로 분류해 적습니다.</p></section>
  ${g.map(x => `<section class="card" aria-label="${x.label}"><h2>${x.label} <span class="tag">${x.items.length}</span></h2>${x.items.length ? `<ul class="tl2">${x.items.map(b => `<li class="tr"><button type="button" class="tt" data-book="${esc(b.id)}"><b>${esc(b.title)}</b><small>${[b.author, b.rate ? '★'.repeat(b.rate) : ''].filter(Boolean).map(esc).join(' · ')}</small></button></li>`).join('')}</ul>` : '<p class="muted">없습니다.</p>'}</section>`).join('')}`;
}
function openBookSheet(vm, act, id) {
  const b = (vm.booksAll || []).find(x => x.id === id); if (!b) return;
  openSheet({
    title: '책', html: `<form class="ed" data-bed novalidate>
      <label class="f">제목<input id="bk-t" type="text" value="${esc(b.title || '')}"></label><label class="f">저자<input id="bk-a" type="text" value="${esc(b.author || '')}"></label>
      <div class="g2"><label class="f">상태<select id="bk-s">${BOOK_ST.map(([k, l]) => `<option value="${k}" ${k === (b.st || 'want') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">별점<select id="bk-r">${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${n === (+b.rate || 0) ? 'selected' : ''}>${n ? '★'.repeat(n) : '없음'}</option>`).join('')}</select></label></div>
      <label class="f">한 줄 느낌<input id="bk-f" type="text" value="${esc(b.feel || '')}"></label>
      <p class="err" id="bk-err" role="alert" hidden></p>
      <div class="row sp"><button class="btn" type="submit">저장</button><button type="button" class="btn ghost danger" data-bk-del>삭제</button></div></form>`,
    onMount(el, close) {
      const $ = q => el.querySelector(q);
      $('[data-bed]').onsubmit = async ev => { ev.preventDefault(); const title = $('#bk-t').value.trim(); if (!title) { $('#bk-err').textContent = '제목을 적어 주십시오.'; $('#bk-err').hidden = false; return; }
        const st = $('#bk-s').value, today = vm.today, p = { title, author: $('#bk-a').value.trim(), st, rate: +$('#bk-r').value, feel: $('#bk-f').value.trim() };
        if (st !== 'want' && !b.start) p.start = today; if (st === 'done' && !b.end) p.end = today;
        const r = await act.editBook(id, p); close(); toast('저장했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
      $('[data-bk-del]').onclick = async () => { const r = await act.deleteBook(id); close(); toast('삭제했습니다.', { label: '되돌리기', fn: () => act.undo(r) }); };
    },
  });
}

/* ---------- 만남 ---------- */
function meetPane(vm) {
  const s = meetStats(vm.all);
  return `<section class="card" aria-labelledby="m-h"><h2 id="m-h">만남 ${s.length}명</h2><p class="muted">만남은 오늘 화면에서 적습니다(“만남: …”). 여기서는 사람별로 모아 봅니다.</p>
  ${s.length ? s.map(p => `<details class="tree"><summary><b>${esc(p.who)}</b> <span class="muted">${p.count}번 · 마지막 ${mdR(p.last)}${p.follow ? ` · 챙길 일 ${p.follow}` : ''}</span></summary><ul class="nl">${p.list.map(x => `<li><button type="button" class="nb" data-nopen="${x.date}"><span class="nt">${x.date.slice(5).replace('-', '.')}</span><span class="nm"><b>${esc(x.what || x.kind || '만남')}</b>${x.learn ? `<small>${esc(x.learn)}</small>` : ''}</span></button></li>`).join('')}</ul></details>`).join('') : '<p class="muted">아직 만남 기록이 없습니다.</p>'}</section>`;
}

function bindRec(root, act) {
  const vm = new Proxy({}, { get: (_, k) => root.__vm[k] });
  root.addEventListener('click', e => {
    const t = e.target;
    const sb = t.closest('[data-sub]'); if (sb) return act.setLog({ sub: sb.dataset.sub });
    const y = t.closest('[data-ym]'); if (y) return act.setLog({ ym: addMonth(vm.log.ym, +y.dataset.ym) });
    const no = t.closest('[data-nopen]'); if (no) return act.openDay(no.dataset.nopen);
    const bk = t.closest('[data-book]'); if (bk) return openBookSheet(vm, act, bk.dataset.book);
  });
  root.addEventListener('input', e => { if (e.target.matches('[data-nq]')) act.setLog({ q: e.target.value }, true); });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-nk]')) act.setLog({ k: e.target.value });
    if (e.target.matches('[data-nv]')) act.setLog({ view: e.target.value });
  });
  root.addEventListener('submit', async e => {
    if (!e.target.matches('[data-badd]')) return; e.preventDefault();
    const t = e.target.querySelector('#bt').value.trim(); if (!t) return;
    const r = await act.addBook({ title: t, author: e.target.querySelector('#ba').value }); toast('책을 넣었습니다.', { label: '되돌리기', fn: () => act.undo(r) });
  });
}
