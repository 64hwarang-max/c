// 성장일지 자동 점검: APK를 만들기 전에 돌립니다. 하나라도 실패하면 빌드를 멈춥니다.
// 사용: (저장소 폴더에서) python3 -m http.server 8765 & node tests/check.js
// 개인 기록 없이, 시험용 기록만 만들어 씁니다.
const { chromium } = require('playwright');
const fs = require('fs');
const URL = process.env.GJ_URL || 'http://localhost:8765/index.html';
const results = [];
const ok = (name, pass, info) => { results.push({ name, pass: !!pass, info }); console.log((pass ? '✅ ' : '❌ ') + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 300) : '')); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await ctx.route(/fonts\.|open-meteo|api\.github\.com|googleapis/, r => r.abort());
  const errs = [];
  const open = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept());
    await p.goto(URL);
    await p.waitForFunction(() => document.documentElement.classList.contains('gjready'), null, { timeout: 60000 });
    await p.waitForTimeout(1200);
    return p;
  };
  const fresh = async () => { const x = await open(); const r = await x.evaluate(() => [D.date, D.time.map(b => b.act), D.plan.map(b => b.act)]); await x.close(); return r; };
  try {
    // 1. 켜기
    const A = await open();
    ok('앱이 오류 없이 켜짐', errs.length === 0, errs);
    // 2. 버전 번호
    const ver = fs.readFileSync('VERSION', 'utf8').trim();
    const appv = await A.evaluate(() => typeof APPV !== 'undefined' ? APPV : null);
    ok('앱 안 버전(APPV) = VERSION 파일', String(appv) === ver, { appv, ver });

    // 3. 저장 → 다시 열기
    await A.evaluate(async () => { D.plan.push({ id: 'T-p1', s: '09:00', e: '10:00', act: '시험 계획', cat: '업무' }); D.time.push({ id: 'T-t1', s: '09:00', e: '09:50', act: '시험 실제', cat: '업무' }); schedule(); await flush(); });
    let r = await fresh();
    ok('계획·실제 저장 후 다시 열어도 남음', r[1].includes('시험 실제') && r[2].includes('시험 계획'), r);

    // 4. 저장 직후 바로 꺼짐(0.15초)
    const K = await open();
    await K.evaluate(() => { D.time.push({ id: 'T-k1', s: '11:00', e: '11:30', act: '바로 꺼짐', cat: '업무' }); schedule(); });
    await K.waitForTimeout(150); await K.close();
    r = await fresh();
    ok('입력 0.15초 뒤 꺼져도 남음', r[1].includes('바로 꺼짐'), r);

    // 5. 낡은 사본이 나중에 저장돼도 지워지지 않음
    const P = await open();
    await P.evaluate(async () => { const old = D; await openDay(D.date); D.time.push({ id: 'T-s1', s: '12:00', e: '13:00', act: '사본 뒤 기록', cat: '업무' }); schedule(); await flush(); old.zz = 1; await store.save(old.date, old); });
    await P.close();
    r = await fresh();
    ok('낡은 사본 저장이 새 블록을 지우지 않음', r[1].includes('사본 뒤 기록'), r);

    // 6. 두 번 열린 앱
    const X = await open(), Y = await open();
    await Y.evaluate(async () => { D.time.push({ id: 'T-y1', s: '14:00', e: '15:00', act: '두번째 창', cat: '업무' }); schedule(); await flush(); });
    await X.evaluate(async () => { D.time.push({ id: 'T-x1', s: '15:00', e: '16:00', act: '첫번째 창', cat: '업무' }); schedule(); await flush(); });
    await X.close(); await Y.close();
    r = await fresh();
    ok('앱이 두 번 열려도 양쪽 블록이 남음', r[1].includes('두번째 창') && r[1].includes('첫번째 창'), r);

    // 7. 지운 블록은 되살아나지 않음
    const Z = await open();
    await Z.evaluate(async () => { D.time = D.time.filter(b => b.id !== 'T-y1'); shDel(D.date, 'T-y1', 'time'); schedule(); await flush(); });
    await Z.close();
    r = await fresh();
    ok('지운 블록은 되살아나지 않음', !r[1].includes('두번째 창'), r);

    // 8. 연동: 오래된 원격 기록은 이 기기 블록을 지우지 않음
    const S = await open();
    const s8 = await S.evaluate(async () => { const loc = await store.load(D.date); await syPutSafe(store.base, 'day:' + D.date, { date: D.date, time: [], plan: [], _sv: (loc._sv || 0) - 60000 }); const v = await store.load(D.date); return v.time.length; });
    ok('연동: 오래된 원격 기록이 덮어쓰지 않음', s8 > 0, s8);

    // 9. 블록 편집 창
    const s9 = await S.evaluate(async () => {
      GOALS.roles = [{ id: 'R1', name: '직업', e: '🎖️', area: 'work', stmt: '', ppl: [] }];
      D.plan.push({ id: 'T-p9', s: '17:00', e: '18:00', act: '편집기 계획', cat: '업무' });
      go('day'); openBlockEditor('plan', D.plan.findIndex(b => b.id === 'T-p9'));
      await new Promise(r => setTimeout(r, 300));
      const same = !!document.querySelector('#bsame'), role = !!document.querySelector('[data-blrl="R1"]');
      document.querySelector('#bsame').click(); await new Promise(r => setTimeout(r, 300));
      const copied = D.time.some(b => b.from === 'T-p9');
      openBlockEditor('time', 0); await new Promise(r => setTimeout(r, 300));
      const ev = document.querySelectorAll('[data-blev]').length;
      closeBlockEditor();
      return { same, role, copied, ev };
    });
    ok('블록 편집 창: 실행도 동일·역할·하루 평가 단추', s9.same && s9.role && s9.copied && s9.ev === 3, s9);

    // 10. 주요 화면 모두 열기
    const e0 = errs.length;
    const secs = await S.evaluate(() => [...document.querySelectorAll('nav.main [data-g]')].map(b => b.dataset.g));
    for (const g of secs) { await S.evaluate(g => { try { go(g) } catch (e) { window.__goErr = (window.__goErr || '') + g + ':' + e.message + ' ' } }, g); await S.waitForTimeout(500); }
    const goErr = await S.evaluate(() => window.__goErr || '');
    ok('하단 탭 화면이 모두 열림 (' + secs.join(',') + ')', secs.length >= 4 && !goErr && errs.length === e0, { goErr, errs: errs.slice(e0) });

    // 11. 비전·역할 화면
    const s11 = await S.evaluate(async () => { go('pillar'); openSection('vision'); await new Promise(r => setTimeout(r, 600)); return { vc: !!document.querySelector('#vcbar'), rl: !!document.querySelector('#rlbox') }; });
    ok('비전 화면: 대화 단추·역할 카드', s11.vc && s11.rl, s11);

    // 12. 큐티 첫 화면
    const s12 = await S.evaluate(() => { const Q = qtS(); Q.from = 6; Q.fromDate = today(); const d = document.createElement('div'); d.innerHTML = qtHomeHTML(); return { set: !!d.querySelector('.qtset'), top: (d.querySelector('.qtw') || {}).className || '' }; });
    ok('큐티: 시작 설정 접힘·이번 주차 맨 위', s12.set && /qtcw/.test(s12.top), s12);

    // 13. 안내 메시지 시간
    const s13 = await S.evaluate(async () => { SET.toastSec = 1; toast('t'); await new Promise(r => setTimeout(r, 1300)); const h = $('#toast').hidden; SET.toastSec = 6; return h; });
    ok('안내 메시지 표시 시간 설정', s13, s13);

    ok('점검 중 페이지 오류 없음', errs.length === 0, errs);
  } catch (e) {
    ok('점검 실행 중 예외', false, String(e && e.stack || e).slice(0, 500));
  }
  await browser.close();
  const fail = results.filter(x => !x.pass);
  console.log(`\n${results.length - fail.length}/${results.length} 통과`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## 자동 점검 ${results.length - fail.length}/${results.length}\n` + results.map(x => `- ${x.pass ? '✅' : '❌'} ${x.name}`).join('\n') + '\n');
  process.exit(fail.length ? 1 : 0);
})();
