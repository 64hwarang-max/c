/* screens/diag — 1단계 확인 화면: 저장 상태, 이전 보고서, 점수·레벨 요약. 저장소는 만지지 않고 받은 값만 그린다. */
import { esc, num } from '../ui/html.js';
import { PILLARS } from '../core/schema.js';

const ROWS = [
  ['days', '이전한 일지(일)'], ['notesMoved', '노트 → 하루 노트 블록'], ['notesDropped', '영성 노트(옮기지 않음)'],
  ['notesUndated', '날짜 없어 건너뛴 노트'], ['habitChecks', '습관 체크 → 반복 완료'], ['spiritScores', '영성 점수(읽지 않음)'],
  ['spiritFields', '영성 전용 필드(읽지 않음)'], ['spiritRefs', '영성 분류 표시 비움'], ['focusTrimmed', '중점 기둥 3개 → 1개로 줄인 주'],
  ['stuffDropped', '제자리 물건(옮기지 않음)'],
];

export function renderDiag(root, vm, act) {
  const lv = vm.sum.level;
  const rep = vm.report;
  root.innerHTML = `
  <p class="muted">${esc(vm.build)} · 저장 방식 ${esc(vm.mode)} · ${vm.migrated ? 'v5 변환 완료' : '아직 변환 전'}</p>
  <section class="card" aria-labelledby="h-dsum">
    <h2 id="h-dsum">점수·레벨 요약 <span class="tag">${vm.fromSample ? '샘플 데이터' : '내 데이터'}</span></h2>
    <div class="lvl"><b>Lv.${lv.level}</b><div class="bar" role="img" aria-label="다음 레벨까지 ${lv.pct}%"><i style="width:${lv.pct}%"></i></div><small>${num(lv.into)} / ${num(lv.span)} XP · 누적 ${num(vm.sum.total)}</small></div>
    <p class="muted">🔥 연속 ${vm.sum.streak}일 (최고 ${vm.sum.best}일) · 오늘 +${num(vm.sum.today.xp)} XP</p>
    <ul class="pil">${PILLARS.map(([k, n]) => { const p = vm.sum.pillars[k]; return `<li><span>${esc(n)}</span><b>Lv.${p.level}</b><div class="bar"><i style="width:${p.pct}%"></i></div><small>${num(p.xp)}</small></li>`; }).join('')}</ul>
  </section>
  <section class="card" aria-labelledby="h-rep">
    <h2 id="h-rep">이전 보고서</h2>
    ${rep ? `<table><tbody>${ROWS.map(([k, t]) => `<tr><th scope="row">${t}</th><td>${rep[k] || 0}</td></tr>`).join('')}</tbody></table>
    <p class="muted">반복 규칙으로 통합: ${esc(Object.entries(rep.rules || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음')}</p>
    ${(rep.warnings || []).length ? `<ul class="warn">${rep.warnings.slice(0, 8).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`
    : '<p class="muted">v4 데이터가 없습니다. 아래에서 샘플이나 백업 파일로 변환을 시험할 수 있습니다(저장하지 않습니다).</p>'}
  </section>
  <section class="card" aria-labelledby="h-try">
    <h2 id="h-try">변환 시험 (저장하지 않음)</h2>
    <div class="row"><button class="btn" data-a="sample">샘플로 시험</button>
    <label class="btn ghost">백업 파일로 시험<input type="file" accept=".json,.txt,application/json,text/plain" hidden data-a="file"></label></div>
    <p class="muted" id="msg" role="status">${esc(vm.msg || '')}</p>
  </section>`;
  root.querySelector('[data-a=sample]').onclick = () => act.sample();
  root.querySelector('[data-a=file]').onchange = e => { const f = e.target.files[0]; if (f) act.file(f); };
}
