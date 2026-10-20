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
        await pg.click('[data-mode=end]'); await pg.wait_for_selector('.sr')
        ok('점수 7행', await pg.locator('.sr').count()==7)
        ok('자동 초안 표시(업무)', 'work' and await pg.locator('.sr:has-text("업무") output').inner_text()!='–', await pg.locator('.sr:has-text("업무")').inner_text())
        ok('자동 태그', await pg.locator('.sr:has-text("업무") .tag:has-text("자동")').count()==1)
        v0=await pg.locator('.sr:has-text("마음관리") output').inner_text(); ok('마음관리 초안 없음', v0=='–')
        for _ in range(3): await pg.click('[data-sc="mind:1"]')
        await pg.wait_for_timeout(300)
        ok('직접 3점', await pg.locator('.sr:has-text("마음관리") output').inner_text()=='3')
        ok('직접 태그·자동으로 버튼', await pg.locator('.sr:has-text("마음관리") [data-sc-auto]').count()==1)
        await pg.click('[data-sc-auto="mind"]'); await pg.wait_for_timeout(300); ok('자동으로 → 초안 없음', await pg.locator('.sr:has-text("마음관리") output').inner_text()=='–')
        xp0=await pg.locator('#h-xp + p').inner_text()
        for _ in range(5): await pg.click('[data-sc="mind:1"]')
        await pg.wait_for_timeout(300)
        ok('XP 반영', await pg.locator('#h-xp + p').inner_text()!=xp0, xp0+' -> '+await pg.locator('#h-xp + p').inner_text())
        await pg.click('[data-sc="mind:-1"]'); await pg.wait_for_timeout(300); ok('내리기', await pg.locator('.sr:has-text("마음관리") output').inner_text()=='4')
        # 돌아봄
        await pg.fill('[data-ev="mgrat:0"]','가족'); await pg.fill('[data-ev="step"]','운동 먼저'); await pg.press('[data-ev="step"]','Tab'); await pg.wait_for_timeout(300)
        # 노트
        await pg.click('[data-note-add]'); await pg.wait_for_selector('.sheet')
        await pg.fill('#nd-title','개요 정리'); await pg.fill('#nd-txt','첫 문단'); await pg.select_option('#nd-k','work'); await pg.fill('#nd-c','보고'); await pg.fill('#nd-s','개요')
        await pg.select_option('#nd-ln', index=1); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('노트 목록', await pg.locator('.nb:has-text("개요 정리")').count()==1)
        ok('분류 경로 표시', '업무 › 보고 › 개요' in await pg.locator('.nb:has-text("개요 정리")').inner_text())
        await pg.click('.nb:has-text("개요 정리")'); await pg.fill('#nd-title','개요 수정'); await pg.click('.ed button[type=submit]'); await pg.wait_for_timeout(300)
        ok('노트 수정', await pg.locator('.nb:has-text("개요 수정")').count()==1)
        # 빈 노트는 저장 안 됨
        await pg.click('[data-note-add]'); await pg.click('.ed button[type=submit]'); ok('빈 노트 막음', await pg.locator('.sheet').count()==1); await pg.keyboard.press('Escape')
        # 빠른 입력 노트
        await pg.fill('#qin','메모: 아이디어'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(300)
        ok('빠른 입력 노트', await pg.locator('.nb:has-text("아이디어")').count()==1)
        # 새로고침 유지
        await pg.reload(); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(300); await pg.click('[data-mode=end]')
        ok('새로고침 후 점수', await pg.locator('.sr:has-text("마음관리") output').inner_text()=='4')
        ok('새로고침 후 돌아봄', await pg.input_value('[data-ev="step"]')=='운동 먼저' and await pg.input_value('[data-ev="mgrat:0"]')=='가족')
        ok('새로고침 후 노트', await pg.locator('.nb').count()==2)
        # 삭제 + 되돌리기
        await pg.click('.nb:has-text("개요 수정")'); await pg.click('[data-nd-del]'); await pg.wait_for_timeout(300)
        ok('노트 삭제', await pg.locator('.nb').count()==1); await pg.click('#toast .tbtn'); await pg.wait_for_timeout(300)
        ok('삭제 되돌리기', await pg.locator('.nb').count()==2)
        # 실행 모드에서도 노트 보임
        await pg.click('[data-mode=run]'); ok('실행 모드 노트', await pg.locator('#h-nt').count()==1)
        ok('가로 넘침 없음', await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await pg.click('[data-mode=end]'); await pg.screenshot(path=OUT+'/s3_end.png',full_page=True)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
