# VOICEVOX 実音声 環境構築メモ（この環境で再現する手順）

四国めたん／ずんだもん／雨晴はう の**本物の音声**を生成するための構築手順。
GitHub APIはレート制限・トークン無しのため、**API非経由の直リンク**で取得する。

## 1. エンジン取得（CPU版・Linux x64・VOICEVOX 0.25.2）
```bash
mkdir -p /tmp/vv && cd /tmp/vv
# 最新タグは releases/latest のリダイレクトで判明（API不要）。本手順は 0.25.2 を固定使用。
curl -sSL -o engine.7z.001 \
  https://github.com/VOICEVOX/voicevox_engine/releases/download/0.25.2/voicevox_engine-linux-cpu-x64-0.25.2.7z.001
pip3 install py7zr
ln -sf engine.7z.001 engine.7z
python3 -c "import py7zr; py7zr.SevenZipFile('engine.7z','r').extractall('/tmp/vv/engine_x')"
```

## 2. 起動（HTTP API :50021）
```bash
cd /tmp/vv/engine_x/linux-cpu-x64 && chmod +x run
./run --host 127.0.0.1 --port 50021 &   # 起動に十数秒（モデル読込）
curl -s http://127.0.0.1:50021/version  # "0.25.2"
```

## 3. キャラのスタイルID（/speakers で確認済み）
- 四国めたん：ノーマル=2（あまあま=0／ツンツン=6 …）
- ずんだもん：ノーマル=3（あまあま=1 …）
- 雨晴はう：ノーマル=10

## 4. 合成ヘルパー
`voicevox_say.py` を使用：
```python
from voicevox_say import synth
synth("こんにちは、ずんだもんなのだ！", "ずんだもん", "/tmp/out.wav", speed=1.05)
```
（/audio_query → /synthesis を叩くだけ。requestsが必要：pip install requests）

## 5. リール用ナレーション生成
`reel_beats.json`（who/say/telop/focus）を順に synth → 連結して narration_vv.wav を作成。
タイミングは `reel_timings_vv.json`（start/dur/who、合計約81.5秒）。
who→キャラ対応：metan=四国めたん, zunda=ずんだもん, hau=雨晴はう。
このタイミングで動画レンダラ（tmpの render_chunk.mjs）を回せば、実音声版リールが書き出せる。
