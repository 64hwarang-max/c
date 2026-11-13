# 성장일지 화면 정리 작업 지시서 (v449~)

이 문서 하나만 읽고 순서대로 하면 되도록 썼다. 한 번에 **작업 하나(T1, T2 …)만** 하고, 끝날 때마다 올린다.

## 0. 공통 규칙 (반드시 지킬 것)

- 코드는 `index.html` 한 파일. **줄 번호는 믿지 말고 아래 '찾는 말'로 `grep`** 한다.
- 고치는 방법 두 가지뿐:
  1. 제자리 수정: Python으로 `assert s.count(옛글)==1` 확인 후 `replace`.
  2. 덧붙이기: 마지막 `</script>` 바로 앞에 `/* ===== vNNN: 설명 ===== */` 블록 추가.
     기존 함수는 `{const _f=fn;fn=function(){...return _f.apply(this,arguments)}}` 로 감싼다.
     (단, `DECO.add(...run:fn)` 처럼 이미 넘겨진 함수는 감싸도 안 바뀐다 → 제자리 수정.)
- 설정값은 `SET.xxx` 에 넣고 `saveSet().catch(()=>{})`. 새 키는 없을 때의 기본 동작이 **지금과 똑같아야** 한다.
- 기록(일정·노트·재정)을 지우거나 바꾸는 코드는 넣지 않는다.
- 화면 확인: `node tools/shots.js [화면]` → `/tmp/shots/화면.png` 를 Read 로 본다.
  (서버가 죽었으면 `setsid nohup python3 -m http.server 8765 >/dev/null 2>&1 &`)
  화면 이름: `day alarm editor quick plan setview setbackup bible`
- 끝내는 순서: `sh tools/bump.sh NNN` → `node tests/check.js` (19/19) → 커밋·푸시(푸시하면 APK 자동 빌드)
  → `index.html` 을 scratchpad `pub/`, `work/` 에 복사 → Artifact 게시(같은 url).
- 보고는 짧게: 바꾼 것 / 확인한 방법 / 폰에서 확인 못 함.

## 1. 지금 상태 (이미 되어 있는 것 — 다시 만들지 말 것)

| 항목 | 상태 | 찾는 말 |
|---|---|---|
| 알림 한 곳으로 | 배너·안내(토스트)가 오늘 화면 위쪽 카드의 `🔔 알림 n/m` 장으로 모임 | `function ntfSlides`, `const NTT=`, `NTF_SEL=` |
| 일정 입력창 | 시간표·여러 날 보기·＋단추 모두 `openBlockEditor` 하나로 열림 | `function openBlockEditor`, `function drawBlockEditor` |
| 빠르게 적기 | ＋단추(FAB)의 한 줄 입력. 일정 편집창과 목적이 달라 그대로 둠 | `function openQuick` |
| 간결한 화면 | 항상 켜짐(`simOn()=>true`), 기능 끄기·기능 단계 있음 | `renderFeatCard`, `lvSelHTML` |
| 백업 한눈에 | v447 | `function bkOne` |

## 2. 할 일

### T1. 알림 종류별 켜기·끄기 (알림이 너무 많다는 불만)

- 목표: 설정에서 알림 종류를 끄면 그 종류는 `🔔 알림` 장에도, 배너로도 나오지 않는다. 기본은 전부 켜짐.
- 종류와 만드는 곳(각각 `grep` 으로 찾아 `data-nk="키"` 속성을 버튼에 추가 — 제자리 수정):

| 키 | 내용 | 찾는 말 |
|---|---|---|
| `wk` | 이번 주 목표 날짜 배치 | `data-wkplace="1"` |
| `carry` | 이어 받을 것 | `data-dgo="carry"`, `id="cyban"`, `data-pricarry="1"` |
| `focus` | 이번 주 한 걸음 | `🎯 이번 주 한 걸음` |
| `dday` | D-day | `ddList().filter` |
| `otd` | N년 전 오늘 | `class="banner otd"` |
| `cycle` | 주기 할 일 | `class="banner cy"` |
| `refl` | 지난 반성 | `🔧 지난 반성` |
| `qr` | 3분 돌아보기 | `class="banner qrban"` |
| `week` | 지난 7일 요약 | `data-wkopen="1"` |
| `place` | 할 일·습관 시간표 배치 | `id="apban"` |
| `qt` | 큐티 제안 | `data-gapgo="1"` |
| `copy` | 계획 그대로 실제로 복사 | `class="cpyrow"` |
| `sys` | 저장·완료 안내(토스트) | `NTT.add` (아래 따로) |

- 거르는 곳: `function ntfSlides` 안의 `L=L.filter(...)` 첫 줄 바로 뒤에
  `L=L.filter(e=>{const k=e.dataset.nk||(e.closest('[data-nk]')||{dataset:{}}).dataset.nk;if(k&&(SET.ntfOff||[]).includes(k)){e.dataset.ntfh='1';return false}return true});`
  그리고 CSS 한 줄: 끈 종류는 화면에서도 숨김 — 덧붙이기 블록에서 `<style id="ntfoffcss">` 를 `SET.ntfOff` 로 만들어 갱신
  (`[data-nk="키"]{display:none!important}` 를 끈 키마다).
- `sys`: `NTT.add` 를 감싸서 `SET.ntfOff` 에 `sys` 가 있으면 저장하지 않고 끝낸다(동작 단추 `fn` 이 있는 것은 그대로 통과).
- 설정 화면: `renderFeatCard` 를 감싸 `#featcard` 아래쪽에 `<h3>🔔 알림 고르기</h3>` + 체크 목록(위 표의 내용 글자) 추가.
  바꾸면 `SET.ntfOff` 저장 → css 갱신 → `refreshAny()`.
- 확인: `node tools/shots.js alarm setview`. Playwright 로 `SET.ntfOff=['sys']` 뒤 `toast('x')` → `NTT.L().length` 가 늘지 않는지, `[]` 로 되돌리면 느는지.

### T2. 일정 편집창 아이콘에 글자 붙이기

- 문제: 편집창 아래 동그란 아이콘 7개(📷👤📍💳✅🔁➡️)가 글자 없이 있어 무엇인지 모른다.
- 찾는 말: `class="beico` (두 곳: `drawBlockEditor` 안과 `const mk=(k,e,l,on)=>` 쪽), CSS `.beico{`
- 방법: 아이콘 버튼 안에 이미 있는 `aria-label`(l) 의 **앞 낱말만** 아이콘 아래 작은 글자로 보이게.
  CSS 로 해결 가능하면 CSS 만: `.beico::after{content:attr(data-lb);position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:.62rem;color:var(--muted);white-space:nowrap;margin-top:2px}` + 줄 아래 여백(`.beirow{padding-bottom:16px}`),
  버튼을 만드는 두 곳에 `data-lb="사진|사람|장소|예산|실행|반복|이월"` 추가(라벨 l 에서 `l.split(/[ ·]/)[0]` 을 쓰되 '함께한'→'사람', '실행도'→'실행' 으로 바꿈).
- 확인: `node tools/shots.js editor` 로 글자가 겹치지 않는지 눈으로 확인.

### T3. 오늘 화면 위쪽 카드 장 수 줄이기

- 문제: 위쪽 카드가 좌우로 넘기는 장이 18장쯤(점 18개)이라 무엇이 있는지 알 수 없다.
- 찾는 말: `function topCardHTML`, `function affSlides`, `.afdots`, `data-hs=`
- 먼저 조사: Playwright 로 `[...document.querySelectorAll('#dash .topcard .afc>.afs')].map(e=>e.dataset.hs+'|'+e.textContent.trim().slice(0,30))` 를 찍어 장 목록을 만든다.
- 방법: 설정(`renderFeatCard` 감싼 곳, T1 옆)에 `<h3>🃏 위쪽 카드에 보일 것</h3>` 체크 목록. 끈 종류(`data-hs` 값)는 `SET.topOff` 에 넣고,
  CSS `#dash .topcard .afc>.afs[data-hs="키"]{display:none}` 로 숨긴 뒤 점(`.afdots`) 개수를 보이는 장 수로 다시 그린다.
  `data-hs` 가 없는 장(다짐·명언·사진 등)은 조사 결과를 보고 `topCardHTML` 에서 `data-hs` 를 붙인다.
  기본은 전부 보임. **경험치(xp)·알림(al) 장은 끌 수 없게** 목록에서 뺀다.
- 확인: `node tools/shots.js day`, 점 개수 = 보이는 장 수.

### T4. 오늘 화면 도구 줄(아이콘 9개) 고르기

- 찾는 말: `const TLB=`, `function tlbHTML`
- 방법: `SET.tlbOff`(키 배열: `gmap glink gsearch start fr gap pm x`)에 있는 것은 `tlbHTML` 에서 건너뛴다(제자리 수정: `TLB.map` → `TLB.filter(x=>x[0]==='sp'||!(SET.tlbOff||[]).includes(x[1])).map`).
  설정 체크 목록은 T1·T3 과 같은 자리. 기본 전부 보임.
- 확인: `node tools/shots.js day setview`.

## 3. 하지 않기로 한 것 (이유)

- 덧댐 215곳을 원래 함수에 합치기: 재 보니 속도 병목이 아니었다(v446 측정). 위험만 큼.
- 일정 편집창과 빠르게 적기 합치기: 목적이 다르고 둘 다 매일 쓰는 화면.
- 글꼴 늦게 불러오기: 시작 0.3초 빨라지지만 글자 모양이 바뀌어 보임. 사용자가 원할 때만.

## 4. 속도 다시 잴 때

v446 에서 잰 방법: Playwright + CDP `Emulation.setCPUThrottlingRate {rate:4}`, 기록 430일·노트 400개·사진 문서 300개(각 200KB)를 넣은 프로필로
`gjready` 클래스가 붙을 때까지의 시간. 그때 값: 3.4초 → 2.2초.
