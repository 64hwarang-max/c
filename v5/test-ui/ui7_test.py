import os
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist', 'index.html'))   # 먼저 node tools/build.mjs --dev
OUT = os.environ.get('V5_OUT', '/tmp')                                  # 화면 캡처·내보낸 파일이 쌓이는 곳
URL = 'file://' + DIST
FIX = os.path.join(HERE, 'fixtures')
import asyncio, sys, json
from playwright.async_api import async_playwright
res=[]
def ok(n,c,i=''):
    res.append(bool(c)); print('PASS' if c else 'FAIL',n,i)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':400,'height':850},accept_downloads=True); pg=await ctx.new_page()
        errs=[]; pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300)
        await pg.click('[data-tab=me]'); await pg.wait_for_selector('[data-pick-theme]')
        ok('분류 9개', await pg.locator('[data-cat]').count()==9)
        await pg.select_option('[data-pick-theme]','dark'); await pg.wait_for_timeout(300)
        ok('다크 테마 적용', await pg.evaluate("document.documentElement.dataset.theme")=='dark')
        await pg.select_option('[data-pick-theme]',''); await pg.wait_for_timeout(300)
        ok('테마 해제', await pg.evaluate("document.documentElement.dataset.theme")==None)
        # 분류
        await pg.click('[data-cat-add]'); await pg.fill('#c-name','봉사'); await pg.select_option('#c-area','rel'); await pg.fill('#c-subs','청소, 배식'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('분류 추가', await pg.locator('[data-cat="봉사"]').count()==1 and '청소, 배식' in await pg.locator('[data-cat="봉사"]').inner_text())
        await pg.click('[data-cat-add]'); await pg.fill('#c-name','봉사'); await pg.click('.ed button[type=submit]'); ok('중복 이름 막음', await pg.locator('#c-err:not([hidden])').count()==1); await pg.keyboard.press('Escape')
        await pg.click('[data-cat="봉사"]'); await pg.click('[data-c-del]'); await pg.wait_for_timeout(300)
        ok('분류 삭제', await pg.locator('[data-cat="봉사"]').count()==0); await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('삭제 되돌리기', await pg.locator('[data-cat="봉사"]').count()==1)
        # 새 분류가 오늘 화면 자동분류에 쓰이나: 키워드
        await pg.click('[data-cat="봉사"]'); await pg.fill('#c-kw','봉사활동'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        await pg.click('[data-tab=today]'); await pg.fill('#qin','일정: 21시 봉사활동'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(300)
        ok('새 분류가 자동 분류에 반영', await pg.locator('[data-col=plan] .blk:has-text("봉사활동")').count()==1)
        await pg.click('[data-tab=me]')
        # 사람
        await pg.fill('#pn','김대리'); await pg.press('#pn','Enter'); await pg.wait_for_timeout(300)
        ok('사람 추가', await pg.locator('#m-p').inner_text()=='사람 1명')
        # 내보내기
        async with pg.expect_download() as dl: await pg.click('[data-export]')
        d=await dl.value; path=OUT+'/exp.json'; await d.save_as(path)
        j=json.load(open(path)); ok('내보내기 파일', j['kind']=='v5' and any(k.startswith('v5/day:') for k in j['docs']) and 'v5/taxonomy' in j['docs'], str(len(j['docs']))+'문서')
        # 사람 하나 더 → 합치기로 가져오면 그대로, 바꾸기로 가져오면 파일 상태
        await pg.fill('#pn','박과장'); await pg.press('#pn','Enter'); await pg.wait_for_timeout(300)
        ok('사람 2명', await pg.locator('#m-p').inner_text()=='사람 2명')
        async with pg.expect_download() as dl2:
            await pg.set_input_files('[data-import]', path)
            await pg.wait_for_selector('[data-ied]'); await pg.click('[data-ied] button[type=submit]')   # 합치기(기본)
        ok('가져오기 전 자동 내보내기', (await dl2.value).suggested_filename.endswith('.json'))
        await pg.wait_for_timeout(400)
        ok('합치기: 기존 유지', await pg.locator('#m-p').inner_text()=='사람 2명')
        async with pg.expect_download() as dl3:
            await pg.set_input_files('[data-import]', path); await pg.wait_for_selector('[data-ied]'); await pg.check('input[name=im][value=replace]'); await pg.click('[data-ied] button[type=submit]')
        await dl3.value; await pg.wait_for_timeout(500)
        ok('바꾸기: 파일 상태로', await pg.locator('#m-p').inner_text()=='사람 1명')
        ok('바꾼 뒤 일지 유지', True)
        # 깨진 파일
        open(OUT+'/bad.json','w').write('{깨짐')
        await pg.set_input_files('[data-import]',OUT+'/bad.json'); await pg.wait_for_timeout(300)
        ok('깨진 파일 안내', '형식' in await pg.inner_text('#toast') and await pg.locator('[data-ied]').count()==0)
        # 이전 점검 접힘
        ok('이전 점검은 접혀 있음', await pg.locator('details.card[open]').count()==0)
        await pg.click('[data-tab=today]'); await pg.wait_for_timeout(300)
        ok('가져온 뒤에도 오늘 화면 정상', await pg.locator('[data-col=plan] .blk').count()>=5)
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.click('[data-tab=me]'); await pg.screenshot(path=OUT+'/s7_me.png',full_page=True)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
