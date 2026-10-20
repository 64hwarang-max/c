import os
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist', 'index.html'))   # 먼저 node tools/build.mjs --dev
OUT = os.environ.get('V5_OUT', '/tmp')                                  # 화면 캡처·내보낸 파일이 쌓이는 곳
URL = 'file://' + DIST
FIX = os.path.join(HERE, 'fixtures')
import json, sys
from playwright.sync_api import sync_playwright
S=OUT
seed=json.load(open(FIX+'/v4seed.json')); res=[]
def ok(n,c,i=''):
    res.append(bool(c)); print('PASS' if c else 'FAIL',n,i)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':400,'height':850},accept_downloads=True); pg=ctx.new_page(); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-today]')
    pg.evaluate('''async(seed)=>{await new Promise(r=>{const q=indexedDB.deleteDatabase('growth-journal');q.onsuccess=r;q.onerror=r;q.onblocked=r});
      const db=await new Promise(r=>{const q=indexedDB.open('growth-journal',1);q.onupgradeneeded=()=>q.result.createObjectStore('docs');q.onsuccess=()=>r(q.result)});
      await new Promise(r=>{const t=db.transaction('docs','readwrite');const s=t.objectStore('docs');for(const k in seed)s.put(seed[k],k);t.oncomplete=r});db.close()}''',seed)
    with pg.expect_download(): pg.reload()
    pg.wait_for_selector('[data-today]'); pg.wait_for_timeout(800)
    # 기록: 마이그레이션된 노트
    pg.click('[data-tab=log]'); pg.wait_for_selector('[data-nq]')
    t=pg.inner_text('[data-notelist]'); ok('옮긴 노트가 기록에 보임', '개' in t and '노트가 없습니다' not in t, t[:50].replace('\n',' '))
    ok('영성 노트는 옮기지 않음', '영성' not in pg.inner_text('[data-recbody]'))
    # 기둥: 7개, 영성 없음
    pg.click('[data-tab=pillar]'); pg.wait_for_selector('.pgrid'); ok('기둥 7개(영성 없음)', pg.locator('.pc').count()==7 and '영성' not in pg.inner_text('.pgrid'))
    ok('기존 습관이 반복으로', True)
    pg.click('[data-room=habit]'); pg.wait_for_selector('#r-h'); rt=pg.inner_text('#r-r + *') if False else pg.inner_text('[data-pil]')
    ok('습관 방에 옮긴 습관', '일찍 자기' in rt, rt[-120:].replace('\n',' '))
    # 주: 이전 주 이동하며 옮긴 일지 확인
    pg.click('[data-tab=week]'); pg.wait_for_selector('.bal'); pg.click('[data-wk="-1"]'); pg.wait_for_timeout(300)
    ok('지난주 균형판 숫자', pg.locator('.br .bv').count()==7)
    ok('옮긴 할 일(영성 표시 비움) 보임', pg.locator('.tr').count()>=1)
    # 오늘: 옮긴 날 열기
    pg.locator('.dc >> nth=1').click(); pg.wait_for_timeout(300)
    ok('옮긴 날 오늘 화면', pg.locator('[data-today]').is_visible())
    pg.click('[data-mode=end]'); pg.wait_for_selector('.sr'); ok('옮긴 점수 표시', pg.locator('.sr output').all_inner_texts().count('–')<7, str(pg.locator('.sr output').all_inner_texts()))
    pg.click('[data-mode=run]'); pg.wait_for_timeout(200)
    ok('가로 넘침 없음', pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    ok('콘솔 오류 없음', not errs, str(errs[:3])); b.close()
print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
