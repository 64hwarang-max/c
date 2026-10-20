import os
HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist', 'index.html'))   # 먼저 node tools/build.mjs --dev
OUT = os.environ.get('V5_OUT', '/tmp')                                  # 화면 캡처·내보낸 파일이 쌓이는 곳
URL = 'file://' + DIST
FIX = os.path.join(HERE, 'fixtures')
import asyncio, sys, json
from playwright.async_api import async_playwright
res=[]
def ok(name,cond,info=''):
    res.append((name,bool(cond),info)); print(('PASS' if cond else 'FAIL'),name,info)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/opt/pw-browsers/chromium' if False else None)
        ctx=await b.new_context(viewport={'width':400,'height':850},has_touch=False)
        pg=await ctx.new_page()
        errs=[]; pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_selector('[data-today]')
        ok('샘플 하루 블록 표시', await pg.locator('[data-col=plan] .blk').count()==5)
        ok('계획 모드엔 실제 열 없음', await pg.locator('[data-col=actual]').count()==0)
        await pg.click('[data-mode=run]'); ok('실행 모드 실제 3블록', await pg.locator('[data-col=actual] .blk').count()==3); await pg.click('[data-mode=plan]')
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        # 빠른 입력
        await pg.fill('#qin','내일 3시 치과'); await pg.wait_for_selector('[data-qpv]:not([hidden])')
        t=await pg.inner_text('[data-qpv]'); ok('미리보기 일정', '일정' in t and '치과' in t, t.replace('\n',' '))
        await pg.fill('#qin','일정: 21시 정리'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(300)
        ok('일정 추가됨', await pg.locator('[data-col=plan] .blk:has-text("정리")').count()==1)
        ok('입력칸 비움', await pg.input_value('#qin')=='')
        # 되돌리기
        await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('되돌리기', await pg.locator('[data-col=plan] .blk').count()==5)
        # 점심 9000원 지출 → fin
        await pg.fill('#qin','커피 4500원'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(300)
        # 편집 시트
        await pg.click('[data-col=plan] .blk:has-text("보고서")'); await pg.wait_for_selector('.sheet')
        await pg.fill('#ed-act','보고서 최종'); await pg.fill('#ed-e','12:30'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('편집 저장', await pg.locator('[data-col=plan] .blk:has-text("보고서 최종")').count()==1)
        # 계획대로 했다 (회의 안 한 것) 시트에서
        await pg.click('[data-col=plan] .blk:has-text("팀 회의")'); await pg.click('[data-ed-done]'); await pg.wait_for_timeout(300)
        await pg.click('[data-mode=run]'); ok('계획→실제', await pg.locator('[data-col=actual] .blk:has-text("팀 회의")').count()==1); await pg.click('[data-mode=plan]')
        # 삭제
        n0=await pg.locator('[data-col=plan] .blk').count()
        await pg.click('[data-col=plan] .blk:has-text("독서")'); await pg.click('[data-ed-del]'); await pg.wait_for_timeout(300)
        ok('삭제', await pg.locator('[data-col=plan] .blk').count()==n0-1)
        await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('삭제 되돌리기', await pg.locator('[data-col=plan] .blk').count()==n0)
        # 끌기
        blk=pg.locator('[data-col=plan] .blk:has-text("운동")'); await blk.scroll_into_view_if_needed(); bb=await blk.bounding_box(); before=await blk.locator('.bm').inner_text(); print('bb',bb)
        await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+10); await pg.mouse.down(); await pg.wait_for_timeout(450)
        for i in range(1,9): await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+10+i*8); 
        await pg.mouse.up(); await pg.wait_for_timeout(400)
        after=await pg.locator('[data-col=plan] .blk:has-text("운동")').locator('.bm').inner_text()
        ok('끌어서 이동', before!=after, f'{before} -> {after}')
        ok('시트 안 열림(끌기 후)', await pg.locator('.sheet').count()==0)
        # 길이
        blk=pg.locator('[data-col=plan] .blk:has-text("점심")'); bb=await blk.bounding_box(); before=await blk.locator('.bm').inner_text()
        gx=bb['x']+bb['width']/2; gy=bb['y']+bb['height']-4
        await pg.mouse.move(gx,gy); await pg.mouse.down()
        for i in range(1,6): await pg.mouse.move(gx,gy+i*8)
        await pg.mouse.up(); await pg.wait_for_timeout(400)
        after=await pg.locator('[data-col=plan] .blk:has-text("점심")').locator('.bm').inner_text()
        ok('길이 조절', before!=after, f'{before} -> {after}')
        # 모드 / 날짜
        await pg.click('[data-mode=run]'); ok('실행 모드 지금 카드', await pg.locator('#h-now').count()==1)
        await pg.click('[data-mode=end]'); await pg.wait_for_selector('.sr'); ok('마감 화면', await pg.locator('.sr').count()==7)
        await pg.click('[data-mode=plan]')
        await pg.click('[data-go="1"]'); await pg.wait_for_timeout(200)
        ok('다음날 빈 화면', await pg.locator('.empty').count()==1)
        await pg.click('[data-go="0"]'); await pg.wait_for_timeout(200)
        ok('오늘로', await pg.locator('[data-col=plan] .blk').count()==n0)
        # 우선순위 저장 + 새로고침 유지
        await pg.fill('[data-pri-text="2"]','메일 정리'); await pg.press('[data-pri-text="2"]','Tab'); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300)
        ok('새로고침 후 유지(우선순위)', await pg.input_value('[data-pri-text="2"]')=='메일 정리')
        ok('새로고침 후 블록 유지', await pg.locator('[data-col=plan] .blk:has-text("보고서 최종")').count()==1)
        # 탭
        await pg.click('[data-tab=week]'); await pg.wait_for_selector('.bal'); ok('주 탭 균형판', await pg.locator('.br').count()==7)
        await pg.click('[data-tab=me]'); ok('나 탭 진단', await pg.locator('[data-pane=me]').inner_text()!='')
        await pg.click('[data-tab=today]')
        ok('가로 넘침 없음(끝)', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.screenshot(path=OUT+'/s2_today.png',full_page=True)
        await pg.click('[data-mode=run]'); await pg.screenshot(path=OUT+'/s2_run.png')
        ok('콘솔 오류 없음', not errs, str(errs))
        await b.close()
    f=[r for r in res if not r[1]]; print(len(res)-len(f),'/',len(res)); sys.exit(1 if f else 0)
asyncio.run(main())
