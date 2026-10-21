// 구형 안드로이드(낡은 웹뷰) 호환 처리: node compat.js <html 파일>
// 1) 가장 큰 인라인 <script>를 구형 문법(Chrome 55 수준)으로 낮춘다 (?. ?? ... 등)
// 2) 구형 웹뷰에 없는 기능(flat, flatMap, fromEntries, matchAll, replaceAll 등)을 채워 넣는다
const fs=require('fs');
const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const POLY=`<script>/* compat */(function(){var P=function(o,n,f){if(!o[n])try{Object.defineProperty(o,n,{value:f,writable:true,configurable:true})}catch(e){}};
P(Array.prototype,'flat',function(d){d=d===undefined?1:d;var r=[];(function f(a,k){for(var i=0;i<a.length;i++){if(Array.isArray(a[i])&&k>0)f(a[i],k-1);else r.push(a[i])}})(this,d);return r});
P(Array.prototype,'flatMap',function(fn,t){return Array.prototype.map.call(this,fn,t).flat(1)});
P(Array.prototype,'at',function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;return this[i]});
P(String.prototype,'at',function(i){i=Math.trunc(i)||0;if(i<0)i+=this.length;return this.charAt(i)});
P(Object,'fromEntries',function(it){var o={};for(var e of it)o[e[0]]=e[1];return o});
P(Object,'hasOwn',function(o,k){return Object.prototype.hasOwnProperty.call(o,k)});
P(String.prototype,'trimStart',function(){return this.replace(/^\\s+/,'')});
P(String.prototype,'trimEnd',function(){return this.replace(/\\s+$/,'')});
P(String.prototype,'padStart',function(n,p){var s=String(this);n=n>>0;p=p===undefined?' ':String(p);if(s.length>=n||!p)return s;var k=n-s.length;while(p.length<k)p+=p;return p.slice(0,k)+s});
P(String.prototype,'replaceAll',function(a,b){if(a instanceof RegExp)return this.replace(a,b);return this.split(String(a)).join(b)});
P(String.prototype,'matchAll',function(re){var r=new RegExp(re.source,re.flags.indexOf('g')<0?re.flags+'g':re.flags),a=[],m;while((m=r.exec(this))){a.push(m);if(m[0]==='')r.lastIndex++}return a[Symbol.iterator]()});
P(Promise,'allSettled',function(a){return Promise.all(Array.prototype.map.call(a,function(p){return Promise.resolve(p).then(function(v){return{status:'fulfilled',value:v}},function(e){return{status:'rejected',reason:e}})}))});
P(Element.prototype,'replaceChildren',function(){while(this.firstChild)this.removeChild(this.firstChild);for(var i=0;i<arguments.length;i++)this.append(arguments[i])});
if(!window.structuredClone)window.structuredClone=function(v){return JSON.parse(JSON.stringify(v))};
if(!window.queueMicrotask)window.queueMicrotask=function(f){Promise.resolve().then(f)};
if(!window.requestIdleCallback)window.requestIdleCallback=function(f){return setTimeout(function(){f({timeRemaining:function(){return 8}})},1)};
})();</script>`;
const m=[...s.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter(x=>!/src=/.test(x[1])).sort((a,b)=>b[2].length-a[2].length)[0];
let esb;try{esb=require('esbuild')}catch(e){console.log('esbuild 없음 → 문법 낮추기 생략, 기능 채우기만 적용')}
if(m&&esb){
  try{const r=esb.transformSync(m[2],{target:'chrome55',legalComments:'none'});
    s=s.replace(m[0],()=>'<script'+m[1]+'>'+r.code.replace(/<\/script/gi,'<\\/script')+'</script>');
    console.log('문법 낮추기 완료',m[2].length,'->',r.code.length)}
  catch(e){console.log('문법 낮추기 실패(그대로 둠):',String(e.message).slice(0,300))}
}
s=s.replace(/<head([^>]*)>/i,(a)=>a+POLY);
fs.writeFileSync(f,s);console.log('compat 적용:',f);
