#!/usr/bin/env bash
# ffmpeg静的ビルド + VOICEVOX core(オフライン) を GitHub releases から取得
set -uo pipefail
cd "$(dirname "$0")"
log(){ echo "[setup $(date +%H:%M:%S)] $*"; }

# ---- 1. ffmpeg static (BtbN) ----
if [ ! -x bin/ffmpeg ]; then
  log "ffmpeg ダウンロード中..."
  curl -sL -m 600 -o /tmp/ff.tar.xz "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" \
    && tar -C /tmp -xf /tmp/ff.tar.xz \
    && cp /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /tmp/ffmpeg-master-latest-linux64-gpl/bin/ffprobe bin/ \
    && chmod +x bin/ffmpeg bin/ffprobe \
    && log "ffmpeg OK: $(bin/ffmpeg -version 2>/dev/null | head -1)" || log "ffmpeg FAILED"
else
  log "ffmpeg 既存スキップ"
fi

# ---- 2. VOICEVOX core wheel (pip) ----
log "voicevox_core wheel を pip install..."
WHL="voicevox_core-0.16.4-cp310-abi3-manylinux_2_34_x86_64.whl"
curl -sL -m 300 -o /tmp/$WHL "https://github.com/VOICEVOX/voicevox_core/releases/download/0.16.4/$WHL" \
  && python3 -m pip install --quiet --break-system-packages "/tmp/$WHL" 2>&1 | tail -3 \
  && python3 -c "import voicevox_core; print('voicevox_core import OK', voicevox_core.__version__)" \
  && log "wheel OK" || log "wheel FAILED"

# ---- 3. VOICEVOX downloader: onnxruntime + open_jtalk dict + models(.vvm) ----
if [ ! -d runtime/vv/models ]; then
  log "downloader 取得..."
  curl -sL -m 120 -o runtime/dl "https://github.com/VOICEVOX/voicevox_core/releases/download/0.16.4/download-linux-x64" \
    && chmod +x runtime/dl \
    && log "downloader 実行(onnxruntime/dict/models)..." \
    && ./runtime/dl --output runtime/vv --exclude c-api 2>&1 | tail -6 || \
       ./runtime/dl --output runtime/vv 2>&1 | tail -6
  log "downloader 完了。中身:"; ls -R runtime/vv 2>/dev/null | head -40
else
  log "voicevox runtime 既存スキップ"
fi
log "=== setup 完了 ==="
