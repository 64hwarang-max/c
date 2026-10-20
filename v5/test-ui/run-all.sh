#!/bin/sh
# 화면 시험 전체. 개발용(--dev)으로 빌드한 뒤 Python Playwright로 400×850 폰 화면에서 돌린다.
cd "$(dirname "$0")/.." || exit 1
node tools/build.mjs --dev || exit 1
fail=0
for t in test-ui/ui*_test.py; do
  out=$(timeout 150 python3 -u "$t" 2>&1); code=$?
  echo "== $t: $(echo "$out" | grep -E '^[0-9]+ /|결과' | tail -1)"
  [ $code = 0 ] || { fail=1; echo "$out" | grep -E "FAIL|Error|Timeout"; }
done
[ $fail = 0 ] && echo "화면 시험 모두 통과" || { echo "화면 시험 실패 있음"; exit 1; }
