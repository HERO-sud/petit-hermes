#!/usr/bin/env bash
# GitHub release 直リンクで VOICEVOX ランタイムを取得（API不使用＝レート制限回避）
set -uo pipefail
cd "$(dirname "$0")"
log(){ echo "[voice $(date +%H:%M:%S)] $*"; }
mkdir -p runtime/vv/models runtime/vv/onnxruntime runtime/vv/dict

# 1) ONNX Runtime (CPU)
if ! ls runtime/vv/onnxruntime/**/lib/libvoicevox_onnxruntime.so* >/dev/null 2>&1; then
  log "onnxruntime 取得..."
  curl -sL -m 300 -o /tmp/ort.tgz "https://github.com/VOICEVOX/onnxruntime-builder/releases/download/voicevox_onnxruntime-1.17.3/voicevox_onnxruntime-linux-x64-1.17.3.tgz" \
    && tar -C runtime/vv/onnxruntime -xzf /tmp/ort.tgz && log "onnxruntime OK" || log "onnxruntime FAILED"
fi

# 2) Open JTalk 辞書
if [ ! -d runtime/vv/dict/open_jtalk_dic_utf_8-1.11 ]; then
  log "辞書 取得..."
  curl -sL -m 200 -o /tmp/dic.tgz "https://github.com/r9y9/open_jtalk/releases/download/v1.11.1/open_jtalk_dic_utf_8-1.11.tar.gz" \
    && tar -C runtime/vv/dict -xzf /tmp/dic.tgz && log "辞書 OK" || log "辞書 FAILED"
fi

# 3) 音声モデル vvm（0-24, n0, s0 を直リンクで）
log "モデル取得開始..."
ok=0; fail=0
for n in $(seq 0 24) n0 s0; do
  f="runtime/vv/models/$n.vvm"
  [ -s "$f" ] && { ok=$((ok+1)); continue; }
  if curl -sL -m 120 -f -o "$f" "https://github.com/VOICEVOX/voicevox_vvm/releases/download/0.16.4/$n.vvm"; then
    ok=$((ok+1))
  else
    rm -f "$f"; fail=$((fail+1)); log "  $n.vvm FAILED"
  fi
done
log "モデル: 成功 $ok / 失敗 $fail"
du -sh runtime/vv/* 2>/dev/null
log "=== voice setup 完了 ==="
