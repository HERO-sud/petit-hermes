#!/usr/bin/env bash
# 4並列キーフレーム撮影（beatを4分割・別ポート）。全完了まで待機。
set -uo pipefail
cd "$(dirname "$0")"
log(){ echo "[par $(date +%H:%M:%S)] $*"; }
WORKERS=( "8911:1,2,3,4,5" "8912:6,7,8,9,10" "8913:11,18,19,20,23" "8914:24,25,26,27,29" )
pids=()
for w in "${WORKERS[@]}"; do
  port="${w%%:*}"; beats="${w#*:}"
  PORT="$port" BEATS="$beats" node capture.mjs > "worker_$port.log" 2>&1 &
  pids+=($!); log "worker :$port beats=$beats pid=$!"
done
fail=0
for p in "${pids[@]}"; do wait "$p" || fail=1; done
n=$(find frames -name '*.jpg' 2>/dev/null | wc -l)
log "全ワーカー終了 (fail=$fail) 総フレーム=$n"
for w in "${WORKERS[@]}"; do port="${w%%:*}"; echo "  :$port -> $(tail -1 worker_$port.log 2>/dev/null)"; done
