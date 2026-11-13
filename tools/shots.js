// 화면 확인용: 예시 데이터를 넣고 주요 화면을 /tmp/shots/*.png 로 찍는다.
// 쓰는 법:  (서버) setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 &   →   node tools/shots.js [화면이름...]
// 화면이름: day alarm editor quick plan setview setbackup bible  (없으면 전부)
const { chromium } = require('playwright');const fs=require('fs');
const UD='/tmp/gj-shots-profile',OUT='/tmp/shots';
(async()=>{const seed=!fs.existsSync(UD);fs.mkdirSync(OUT,{recursive:true});
const ctx=await chromium.launchPersistentContext(UD,{viewport:{width:412,height:860}});await ctx.route(/fonts\.|open-meteo|api\.github\.com|googleapis|supabase/,r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const load=async()=>{await p.goto('http://localhost:8765/index.html');await p.waitForFunction(()=>document.documentElement.classList.contains('gjready'),null,{timeout:60000});await p.waitForTimeout(2000)};
await load();
if(seed){await p.evaluate(async()=>{const T=today();const C=SET.cats.map(c=>c.name);const A=[['06:00','07:00','아침 루틴'],['07:30','12:00','업무'],['12:00','13:00','점심'],['13:00','16:10','업무'],['16:30','17:30','운동'],['19:00','20:30','성경공부'],['22:00','04:30','잠']];
 for(let i=-7;i<60;i++){const d=addD(T,-i);const o=norm({date:d});o.plan=A.map((a,j)=>({id:uid(),s:a[0],e:a[1],act:a[2],cat:C[j%C.length]}));if(i>=0){o.time=A.slice(0,5).map((a,j)=>({id:uid(),s:a[0],e:a[1],act:a[2],cat:C[j%C.length],memo:j%2?'메모':''}));o.gratitude=['감사 하나','감사 둘'];}await store.save(d,o)}
 for(let i=0;i<30;i++){const id='note-'+uid();const n={kind:'note',id,date:addD(T,-i),topic:'',dk:['work','grow','spirit','body'][i%4],title:'노트 '+i,body:'<p>본문 내용입니다.</p>',photos:[],tags:[],created:Date.now(),updated:Date.now()};NOTES.set(id,n);await store.putDoc(id,n)}
 for(let i=0;i<8;i++)TASKS.items.push({id:uid(),title:'할 일 '+i,due:addD(T,i%3-1),done:false,list:TASKS.lists[0].id});try{await saveTasks()}catch(e){}});await p.waitForTimeout(800);await load()}
const want=process.argv.slice(2);const S={
 day:async()=>{await p.evaluate(async()=>{await openDay(today());window.scrollTo(0,0)});await p.waitForTimeout(1500)},
 alarm:async()=>{await p.evaluate(()=>{go('day');toast('예시 안내 1');toast('예시 안내 2')});await p.waitForTimeout(400)},
 editor:async()=>{await p.evaluate(()=>{go('day');openBlockEditor('plan',1)})},
 quick:async()=>{await p.evaluate(()=>{try{closeBlockEditor()}catch(e){}go('day');openQuick()})},
 plan:async()=>{await p.evaluate(()=>{const s=document.querySelector('#sheet');if(s){s.hidden=true;s.innerHTML=''}go('plan')})},
 setview:async()=>{await p.evaluate(()=>{go('export');setGrid('view')})},
 setbackup:async()=>{await p.evaluate(()=>{go('export');setGrid('backup')})},
 bible:async()=>{await p.evaluate(()=>bbOpen(1,11));await p.waitForTimeout(2000)}};
for(const k of Object.keys(S)){if(want.length&&!want.includes(k))continue;try{await S[k]();await p.waitForTimeout(900);await p.screenshot({path:`${OUT}/${k}.png`});await p.screenshot({path:`${OUT}/${k}-full.png`,fullPage:true});console.log('ok',k)}catch(e){console.log('FAIL',k,e.message.slice(0,120))}}
console.log('errors:',errs.slice(0,5));await ctx.close()})();
