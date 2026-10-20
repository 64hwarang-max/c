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
        await pg.click('[data-tab=week]'); await pg.wait_for_selector('[data-week] .bal')
        ok('균형판 7행', await pg.locator('.br').count()==7)
        ok('일곱 날 7칸', await pg.locator('.dc').count()==7)
        ok('오늘 칸 강조', await pg.locator('.dc.now').count()==1)
        ok('할 일 묶음', await pg.locator('[data-week] .tr').count()==4, str(await pg.locator('.gh').all_inner_texts()))
        # 중점 기둥
        await pg.click('[data-focus=body]'); await pg.wait_for_timeout(300)
        ok('중점 선택', await pg.locator('[data-focus=body].on').count()==1 and await pg.locator('.br:has-text("건강") .tag').count()==1)
        await pg.click('[data-focus=work]'); await pg.wait_for_timeout(300)
        ok('중점은 하나만', await pg.locator('[data-focus].on').count()==1)
        # 할 일 추가
        await pg.fill('#tin','금요일까지 보고서 제출'); await pg.press('#tin','Enter'); await pg.wait_for_timeout(300)
        ok('할 일 추가', await pg.locator('.tr:has-text("보고서 제출")').count()==1)
        ok('마감일 읽음', '금' in await pg.locator('.tr:has-text("보고서 제출")').inner_text() or '월' in await pg.locator('.tr:has-text("보고서 제출")').inner_text(), await pg.locator('.tr:has-text("보고서 제출")').inner_text())
        await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('추가 되돌리기', await pg.locator('[data-week] .tr').count()==4)
        # 완료
        await pg.check('[data-tdone=t2]'); await pg.wait_for_timeout(300)
        ok('완료 처리', await pg.locator('.tr.dn:has-text("치과 예약")').count()==1)
        # 편집·시간표
        await pg.click('.tt:has-text("보고서 검토")'); await pg.wait_for_selector('.sheet')
        await pg.fill('#tk-title','보고서 검토(수정)'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('할 일 수정', await pg.locator('.tr:has-text("검토(수정)")').count()==1)
        await pg.click('.tt:has-text("검토(수정)")'); await pg.fill('#tk-ss','15:00'); await pg.click('[data-tk-plan]'); await pg.wait_for_timeout(400)
        await pg.click('[data-tab=today]'); await pg.wait_for_timeout(200)
        # 계획에 넣은 날이 마감일(2일 뒤)
        await pg.click('[data-tab=week]'); await pg.wait_for_selector('.dc')
        await pg.click('.dc >> nth=%d' % 0); await pg.wait_for_timeout(300)
        ok('일곱 날 → 오늘 화면', await pg.locator('[data-today]').is_visible())
        await pg.click('[data-tab=week]'); await pg.wait_for_selector('.dc')
        # 주 이동
        await pg.click('[data-wk="-1"]'); await pg.wait_for_timeout(200)
        ok('지난주로', await pg.locator('[data-wk="0"]').count()==1)
        await pg.click('[data-wk="0"]'); await pg.wait_for_timeout(200)
        # 주 마무리 + 다음 주 중점
        await pg.fill('[data-wrap=good]','운동 꾸준'); await pg.press('[data-wrap=good]','Tab'); await pg.click('[data-nfocus=mind]'); await pg.wait_for_timeout(300)
        ok('다음 주 중점', await pg.locator('[data-nfocus=mind].on').count()==1)
        await pg.reload(); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300); await pg.click('[data-tab=week]'); await pg.wait_for_selector('.bal')
        ok('새로고침 후 마무리', await pg.input_value('[data-wrap=good]')=='운동 꾸준')
        ok('새로고침 후 중점', await pg.locator('[data-focus=work].on').count()==1 and await pg.locator('[data-nfocus=mind].on').count()==1)
        ok('새로고침 후 할 일', await pg.locator('.tr.dn:has-text("치과 예약")').count()==1)
        # 오늘 빠른 입력 → 할 일
        await pg.click('[data-tab=today]'); await pg.fill('#qin','내일까지 메일 보내기'); await pg.wait_for_selector('[data-qpv]:not([hidden])')
        await pg.click('[data-qk=task]'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(300)
        await pg.click('[data-tab=week]'); await pg.wait_for_selector('.bal')
        ok('오늘 입력칸의 할 일이 주 탭에', await pg.locator('.tr:has-text("메일 보내기")').count()==1)
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.screenshot(path=OUT+'/s4_week.png',full_page=True)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
