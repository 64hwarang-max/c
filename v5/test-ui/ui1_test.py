import os
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist', 'index.html'))   # 먼저 node tools/build.mjs --dev
OUT = os.environ.get('V5_OUT', '/tmp')                                  # 화면 캡처·내보낸 파일이 쌓이는 곳
URL = 'file://' + DIST
FIX = os.path.join(HERE, 'fixtures')
import json, sys
from playwright.sync_api import sync_playwright
S=OUT
seed=json.load(open(FIX+'/v4seed.json'))
res=[]
def ok(name,cond,extra=''):
    res.append((name,bool(cond),extra)); print(('PASS' if cond else 'FAIL'),name,extra)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome') if False else p.chromium.launch()
    ctx=b.new_context(viewport={'width':400,'height':850},accept_downloads=True)
    pg=ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    def me(pg):
        pg.click('[data-tab=me]'); pg.wait_for_selector('[data-diagbox]',state='attached')
        if not pg.evaluate("document.querySelector('details.card').open"): pg.click('details.card summary')
    KEYS='''async()=>{const r=indexedDB.open('growth-journal',1);return await new Promise(res=>{r.onsuccess=()=>{const q=r.result.transaction('docs').objectStore('docs').getAllKeys();q.onsuccess=()=>res(q.result)}})}'''
    # 1) 빈 기기
    pg.goto(URL); pg.wait_for_selector('[data-today]'); pg.wait_for_timeout(500); me(pg)
    ok('빈 기기에서 시작', '변환 완료' in pg.inner_text('[data-diagbox]'))
    ok('가로 넘침 없음', pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'))
    # 2) 샘플로 시험
    k0=sorted(pg.evaluate(KEYS)); pg.click('[data-a=sample]'); pg.wait_for_selector('#msg:has-text("변환했습니다")')
    txt=pg.inner_text('[data-diagbox]')
    ok('샘플 보고서 표시', '이전한 일지' in txt and '14' in txt)
    ok('샘플은 저장하지 않음', sorted(pg.evaluate(KEYS))==k0)
    pg.screenshot(path=S+'/shot_sample.png',full_page=True)
    # 3) 백업 파일로 시험
    v=seed; backup={'app':'성장일지','v':6,'settings':v['settings'],'goals':v['goals'],'notes':[x for x in v.values() if isinstance(x,dict) and x.get('kind')=='note'],'days':[x for k,x in v.items() if k.startswith('day:')]}
    open(S+'/backup6.json','w').write(json.dumps(backup,ensure_ascii=False))
    pg.set_input_files('[data-a=file]',S+'/backup6.json'); pg.wait_for_selector('#msg:has-text("backup6.json")')
    ok('백업 파일 시험', '14일을 변환' in pg.inner_text('#msg'))
    pg.set_input_files('[data-a=file]',{'name':'bad.json','mimeType':'application/json','buffer':b'{oops'}); pg.wait_for_selector('#msg:has-text("시험하지 못했습니다")')
    ok('깨진 파일은 오류 문구', '형식' in pg.inner_text('#msg'))
    # 4) 실제 v4 IndexedDB → 변환
    ctx2=b.new_context(viewport={'width':400,'height':850},accept_downloads=True); p2=ctx2.new_page(); p2.on('pageerror',lambda e: errs.append(str(e)))
    p2.goto(URL); p2.wait_for_selector('[data-today]')
    p2.evaluate('''async(seed)=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('growth-journal');q.onsuccess=r;q.onerror=r;q.onblocked=r});
      const db=await new Promise(r=>{const q=indexedDB.open('growth-journal',1);q.onupgradeneeded=()=>q.result.createObjectStore('docs');q.onsuccess=()=>r(q.result)});
      await new Promise(r=>{const t=db.transaction('docs','readwrite');const s=t.objectStore('docs');for(const k in seed)s.put(seed[k],k);t.oncomplete=r});db.close()}''',seed)
    with p2.expect_download() as dl: p2.reload()
    d=dl.value; ok('원본 백업 파일이 내려받아짐', d.suggested_filename.startswith('성장일지-v4원본-'), d.suggested_filename)
    saved=json.load(open(d.path())); ok('백업에 일지 14일 전체', len(saved['data']['days'])==14)
    p2.wait_for_selector('[data-today]'); p2.wait_for_timeout(500); me(p2); p2.wait_for_selector('table')
    t2=p2.inner_text('[data-diagbox]'); ok('변환 결과 표시(내 데이터)', '내 데이터' in t2 and 'v5 변환 완료' in t2)
    keys=p2.evaluate('''async()=>{const r=indexedDB.open('growth-journal',1);return await new Promise(res=>{r.onsuccess=()=>{const q=r.result.transaction('docs').objectStore('docs').getAllKeys();q.onsuccess=()=>res(q.result)}})}''')
    ok('v5 일지 문서 15개(14일 + 날짜 없는 노트의 작성일) + 설정류', len([k for k in keys if k.startswith('v5/day:')])==15 and 'v5/meta' in keys and 'v5/rules' in keys)
    ok('v4 문서 그대로', 'day:2026-10-06' in keys and 'settings' in keys and 'note-a1' in keys)
    n=[0]; p2.on('download',lambda d: n.__setitem__(0,n[0]+1)); p2.reload(); p2.wait_for_selector('[data-today]'); p2.wait_for_timeout(800)
    ok('두 번째 시작은 다시 내려받지 않음', n[0]==0, str(n[0]))
    ctx3=b.new_context(viewport={'width':400,'height':850}); 
    p2.screenshot(path=S+'/shot_real.png',full_page=True)
    ok('가로 넘침 없음(결과 화면)', p2.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'))
    ok('콘솔 오류 없음', not errs, str(errs[:3]))
    b.close()
print('결과', sum(1 for r in res if r[1]),'/',len(res))
sys.exit(0 if all(r[1] for r in res) else 1)
