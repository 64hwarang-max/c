#!/usr/bin/env python3
"""공유판 만들기: index.html → share/index.html (개인정보 제거)
사용: python3 tools/make-share.py
"""
import re, json, os, sys

src = open('index.html', encoding='utf-8').read()
s = src

def rep(a, b, n=1):
    global s
    c = s.count(a)
    if c != n:
        sys.exit(f'찾기 실패({c}회): {a[:60]}')
    s = s.replace(a, b)

# 1) 맨 위 변경 기록 주석(개인 작업 내역) 제거
s = re.sub(r'<!-- 성장일지 v[^\n]*?-->', '<!-- 성장일지 · 공유판 -->', s, count=1)

# 2) 가져오기 자료(DSEED)가 비어 있는지 확인 — 원본에서도 이미 비웠음
if 'const DSEED={"m":[],"notes":[],"books":[]};' not in s: sys.exit('DSEED가 비어 있지 않습니다')

# 4) 제작자 GitHub 새 버전 확인 끄기(저장소 주소 노출 방지)
rep("const VRK='gj-verchk',VRURL='https://github.com/64hwarang-max/c/actions/workflows/build-apk.yml';",
    "const VRK='gj-verchk',VRURL='';")
rep("async function vrCheck(force){const c=vrGet();", "async function vrCheck(force){const c=vrGet();return c;")

s = s.replace('https://api.github.com/repos/64hwarang-max/c/actions/workflows/build-apk.yml/runs?status=success&per_page=1', 'about:blank')

# 5) 최종 검사: 남으면 실패
bad = ['64hwarang', '@gmail.com']
left = [w for w in bad if w in s]
if left: sys.exit(f'남은 개인정보: {left}')

os.makedirs('share', exist_ok=True)
open('share/index.html', 'w', encoding='utf-8').write(s)
print(f'share/index.html  {len(src)//1024}KB → {len(s)//1024}KB')
