import os
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist', 'index.html'))   # 먼저 node tools/build.mjs --dev
OUT = os.environ.get('V5_OUT', '/tmp')                                  # 화면 캡처·내보낸 파일이 쌓이는 곳
URL = 'file://' + DIST
FIX = os.path.join(HERE, 'fixtures')
import asyncio, sys
from playwright.async_api import async_playwright
res=[]
def ok(n,c,i=''):
    res.append(bool(c)); print('PASS' if c else 'FAIL',n,i)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':400,'height':850})).new_page()
        errs=[]; pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300)
        # 오늘 화면에서 노트 하나 추가
        await pg.click('[data-mode=end]'); await pg.wait_for_selector('.sr'); await pg.click('[data-note-add]'); await pg.fill('#nd-title','오늘 노트'); await pg.select_option('#nd-k','work'); await pg.fill('#nd-c','보고'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        await pg.click('[data-tab=log]'); await pg.wait_for_selector('[data-nq]')
        ok('노트 모음 3개', '3개' in await pg.inner_text('[data-notelist]'), (await pg.inner_text('[data-notelist]'))[:60])
        ok('분류 나무', await pg.locator('details.tree summary:has-text("업무")').count()>=1)
        await pg.fill('[data-nq]','구상'); await pg.wait_for_timeout(200)
        ok('검색(입력칸 유지)', '1개' in await pg.inner_text('[data-notelist]') and await pg.evaluate("document.activeElement.matches('[data-nq]')"))
        await pg.fill('[data-nq]',''); await pg.select_option('[data-nk]','grow'); await pg.wait_for_timeout(200)
        ok('분류 필터', '1개' in await pg.inner_text('[data-notelist]'))
        await pg.select_option('[data-nk]',''); await pg.select_option('[data-nv]','date'); await pg.wait_for_timeout(200)
        ok('날짜별 보기', await pg.locator('.gh').count()>=2)
        await pg.click('.nb:has-text("개요 정리")'); await pg.wait_for_timeout(300)
        ok('노트 → 그 날 오늘 화면', await pg.locator('[data-today]').is_visible())
        await pg.click('[data-tab=log]'); await pg.wait_for_selector('[data-nq]')
        # 재정
        await pg.click('[data-sub=fin]'); await pg.wait_for_selector('#f-h')
        t=await pg.inner_text('.sum4'); ok('재정 합계', '11,500원' in t, t.replace('\n',' '))
        ok('지출 분류', await pg.locator('.fr:has-text("식비")').count()==1)
        ok('거래 목록', await pg.locator('#f-l ~ * .nb, .card:has(#f-l) .nb').count()>=2)
        await pg.click('[data-ym="-1"]'); ok('지난달 비어 있음', '이 달 거래가 없습니다' in await pg.inner_text('[data-recbody]'))
        # 독서
        await pg.click('[data-sub=books]'); await pg.wait_for_selector('#b-h')
        ok('책 그룹', await pg.locator('.tr:has-text("내적 지휘")').count()==1)
        await pg.fill('#bt','손자 외'); await pg.press('#bt','Enter'); await pg.wait_for_timeout(300)
        ok('책 추가', await pg.locator('.tr:has-text("손자 외")').count()==1)
        await pg.click('.tt:has-text("손자 외")'); await pg.select_option('#bk-s','done'); await pg.select_option('#bk-r','4'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('책 상태·별점', await pg.locator('section[aria-label="다 읽음"] .tr:has-text("손자 외")').count()==1 and '★★★★' in await pg.locator('.tr:has-text("손자 외")').inner_text())
        # 만남
        await pg.click('[data-sub=meet]'); await pg.wait_for_selector('#m-h')
        ok('만남 사람별', await pg.locator('details.tree:has-text("김대리")').count()==1)
        await pg.click('details.tree summary'); ok('만남 펼치기', await pg.locator('details.tree[open] .nb').count()==1)
        await pg.reload(); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300)
        await pg.click('[data-tab=log]'); await pg.click('[data-sub=books]'); await pg.wait_for_selector('#b-h')
        ok('새로고침 후 책', await pg.locator('section[aria-label="다 읽음"] .tr:has-text("손자 외")').count()==1)
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.click('[data-sub=notes]'); await pg.screenshot(path=OUT+'/s6_log.png',full_page=True)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
