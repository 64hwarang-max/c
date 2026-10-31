#!/bin/sh
# 사용: sh tools/bump.sh 391  → VERSION 파일과 index.html 안의 APPV를 같은 번호로 맞춤
set -e
N="$1"; [ -n "$N" ] || { echo "번호를 주십시오"; exit 1; }
echo "$N" > VERSION
sed -i "s#/\*APPV\*/[0-9]*#/*APPV*/$N#" index.html
grep -o "/\*APPV\*/[0-9]*" index.html
