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
        ok('오늘 반복 카드', await pg.locator('[data-rdone]').count()==3)
        await pg.check('[data-rdone="habit:h1"]'); await pg.wait_for_timeout(300)
        ok('반복 체크', await pg.locator('.tr.dn:has-text("운동")').count()==1 and '1/3' in await pg.locator('#h-due').inner_text())
        await pg.click('[data-mode=end]'); await pg.wait_for_selector('.sr')
        ok('습관 완료가 점수 초안에 반영', '습관' in await pg.locator('.sr:has-text("습관")').first.inner_text() and await pg.locator('.sr:has-text("건강") output').inner_text()=='10', await pg.locator('.sr:has-text("건강") output').inner_text())
        await pg.click('[data-mode=plan]')
        await pg.click('[data-tab=pillar]'); await pg.wait_for_selector('.pgrid')
        ok('기둥 카드 7', await pg.locator('.pc').count()==7)
        await pg.click('[data-room=body]'); await pg.wait_for_selector('#r-h')
        ok('방 제목 Lv', 'Lv.' in await pg.inner_text('#r-h'))
        ok('수치 목표 표시', '체중 70kg' in await pg.inner_text('#r-g + *') or await pg.locator('.gr:has-text("체중")').count()==1, await pg.locator('.gr:has-text("체중")').inner_text())
        ok('수치 진행률 40%', '40%' in await pg.locator('.gr:has-text("체중")').inner_text())
        ok('방 습관 연속', '연속 1일' in await pg.locator('#r-r ~ * .tr:has-text("운동"), .card:has(#r-r) .tr:has-text("운동")').first.inner_text())
        # 목표 추가
        await pg.click('[data-goal-add]'); await pg.wait_for_selector('.sheet'); await pg.fill('#g-title','주 3회 운동'); await pg.select_option('#g-lv','w'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('목표 추가', await pg.locator('.gr:has-text("주 3회 운동")').count()==1)
        # 목표 편집: 단계 추가·완료
        await pg.click('.tt:has-text("주 3회 운동")'); await pg.wait_for_selector('#g-step'); await pg.fill('#g-step','월'); await pg.click('[data-sadd]'); await pg.wait_for_timeout(400)
        await pg.fill('#g-step','수'); await pg.click('[data-sadd]'); await pg.wait_for_timeout(400)
        await pg.check('[data-sdone]>>nth=0'); await pg.wait_for_timeout(400)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
        ok('단계 진행률 50%', '50%' in await pg.locator('.gr:has-text("주 3회 운동")').inner_text(), await pg.locator('.gr:has-text("주 3회 운동")').inner_text())
        await pg.check('[data-gdone]>>nth=0'); await pg.wait_for_timeout(300)
        # 습관 추가
        await pg.click('[data-rule-add]'); await pg.fill('#ru-name','스트레칭'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('습관 추가(이 기둥)', await pg.locator('.tr:has-text("스트레칭")').count()==1)
        await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('습관 추가 되돌리기', await pg.locator('.tr:has-text("스트레칭")').count()==0)
        # 중점
        await pg.click('[data-rfocus=body]'); await pg.wait_for_timeout(300)
        ok('방에서 중점', await pg.locator('[data-rfocus=body].on').count()==1)
        await pg.click('[data-back]'); ok('목록 복귀', await pg.locator('.pc').count()==7 and await pg.locator('.pc:has-text("건강") .tag').count()==1)
        await pg.reload(); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300)
        ok('새로고침 후 반복 체크', await pg.locator('.tr.dn:has-text("운동")').count()==1)
        await pg.click('[data-tab=pillar]'); await pg.click('[data-room=body]'); await pg.wait_for_selector('#r-h')
        ok('새로고침 후 목표', await pg.locator('.gr:has-text("주 3회 운동")').count()==1)
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.screenshot(path=OUT+'/s5_room.png',full_page=True)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
