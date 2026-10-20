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
FAKE = """
(()=>{ const log=[]; window.__log=log; window.__listeners={};
 window.Capacitor={isNativePlatform:()=>true,Plugins:{
  WidgetBridge:{update:async a=>{log.push(['widget',a.data])}},
  LocalNotifications:{checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),getPending:async()=>({notifications:[]}),cancel:async a=>log.push(['cancel',a]),schedule:async a=>log.push(['schedule',a])},
  App:{addListener:(n,cb)=>{window.__listeners[n]=cb},exitApp:()=>log.push(['exit'])},
  Filesystem:{mkdir:async()=>{},writeFile:async a=>{log.push(['write',a.directory,a.path])}}}};
})();
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':400,'height':850})).new_page()
        errs=[]; pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.add_init_script(FAKE)
        await pg.goto(URL); await pg.wait_for_selector('[data-today]'); await pg.wait_for_timeout(2500)
        log=await pg.evaluate('window.__log')
        ok('시작 후 위젯 갱신', any(x[0]=='widget' for x in log), str([x[0] for x in log]))
        w=[json.loads(x[1]) for x in log if x[0]=='widget'][-1]
        ok('위젯 내용', '월' in w['title'] or '화' in w['title'] and '보고서 마무리' in w['body'], w['title']+' | '+w['body'][:40])
        ok('알림 예약', any(x[0]=='schedule' for x in log))
        # 계획 추가 → 위젯/알림 다시 맞춤
        n0=len([x for x in log if x[0]=='widget'])
        await pg.fill('#qin','일정: 23시 정리'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(2500)
        log=await pg.evaluate('window.__log')
        ok('변경 뒤 위젯 다시 갱신', len([x for x in log if x[0]=='widget'])>n0)
        sch=[x for x in log if x[0]=='schedule'][-1][1]['notifications']
        ok('새 계획 알림 포함', any('정리' in n['title'] for n in sch), str([n['title'] for n in sch]))
        # 연동 끄기
        await pg.click('[data-tab=me]'); await pg.wait_for_selector('[data-dev=widget]')
        ok('앱 안내 문구', '앱(APK)에서만' not in await pg.inner_text('#m-dv + *'))
        await pg.uncheck('[data-dev=widget]'); await pg.wait_for_timeout(300)
        n1=len([x for x in await pg.evaluate('window.__log') if x[0]=='widget'])
        await pg.click('[data-tab=today]'); await pg.fill('#qin','일정: 23시 점검'); await pg.press('#qin','Enter'); await pg.wait_for_timeout(2500)
        ok('위젯 끄면 갱신 안 함', len([x for x in await pg.evaluate('window.__log') if x[0]=='widget'])==n1)
        # 뒤로가기: 시트 → 탭 → 종료
        await pg.click('[data-add=plan]'); await pg.wait_for_selector('.sheet')
        await pg.evaluate('window.__listeners.backButton()'); await pg.wait_for_timeout(200)
        ok('뒤로가기가 시트를 닫음', await pg.locator('.sheet').count()==0)
        await pg.click('[data-tab=week]'); await pg.evaluate('window.__listeners.backButton()'); await pg.wait_for_timeout(300)
        ok('뒤로가기가 오늘 탭으로', await pg.locator('[data-pane=today]').is_visible())
        await pg.evaluate('window.__listeners.backButton()'); await pg.wait_for_timeout(100)
        ok('오늘 탭에서 뒤로가기는 종료', any(x[0]=='exit' for x in await pg.evaluate('window.__log')))
        await pg.evaluate('window.__listeners.resume()'); await pg.wait_for_timeout(300)
        ok('다시 앞으로 와도 정상', await pg.locator('[data-col=plan] .blk').count()>=5)
        ok('콘솔 오류 없음', not errs, str(errs)); await b.close()
        # 웹(연동 없음)에서도 정상: 안내 문구
        b2=await p.chromium.launch(); pg2=await (await b2.new_context(viewport={'width':400,'height':850})).new_page(); await pg2.goto(URL); await pg2.wait_for_selector('[data-today]'); await pg2.click('[data-tab=me]'); await pg2.wait_for_selector('[data-dev=widget]')
        ok('웹에서는 앱 전용 안내', '앱(APK)에서만' in await pg2.inner_text('#m-dv + *')); await b2.close()
    print(sum(res),'/',len(res)); sys.exit(0 if all(res) else 1)
asyncio.run(main())
