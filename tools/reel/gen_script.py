#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""timeline.json(+timing.json) から script.md（完全台本）を生成。無音化時の再収録にも使える。"""
import json, os
R = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(R, "timeline.json"), encoding="utf-8"))
T = json.load(open(os.path.join(R, "timing.json"), encoding="utf-8")) if os.path.exists(os.path.join(R, "timing.json")) else None
SPK = TL["meta"]["speakers"]
durs = [f["dur"] for f in T["frames"]] if T else [b.get("min_dur", 2.5) for b in TL["beats"]] + [2.8]

lines = []
lines.append("# 台本 — 勝手にコンサル 103日目（プチヘルメース追体験ゲーム）\n")
lines.append(f"- 形式: 縦9:16 / {TL['meta']['fps']}fps / 一人称ビューティ + テロップ + VOICEVOX掛け合い")
lines.append(f"- 総尺: 約 {T['total']:.0f} 秒\n" if T else "")
lines.append("## 話者（VOICEVOX）")
for sp, v in SPK.items():
    lines.append(f"- **{v['name']}**（style_id {v['style_id']}）… `{sp}`")
lines.append("\n## タイムライン\n")
lines.append("| # | 時刻 | 話者 | テロップ | 読み(VOICEVOX) | 背景 |")
lines.append("|---|---|---|---|---|---|")
t = 0.0
for i, b in enumerate(TL["beats"]):
    d = durs[i]; sp = SPK.get(b["sp"], {}).get("name", "—")
    title = f"〔大テロップ: {b['title']}〕<br>" if b.get("title") else ""
    say = b.get("say", "") or "（音声なし）"
    bg = b["bg"].replace("frame:", "🎬 ").replace("card:", "🗂 ")
    lines.append(f"| {b['id']} | {t:04.1f}s | {sp} | {title}{b['text']} | {say} | {bg} |")
    t += d
lines.append(f"| END | {t:04.1f}s | — | 〔エンドカード〕勝手にコンサル 103日目 | — | 🗂 end |\n")
lines.append("## 再収録メモ")
lines.append("- 音声は `voice.py`（voicevox_core, オフライン）で `say` 列を style_id で合成→ `wav/narration.wav`。")
lines.append("- 別途VOICEVOXで作る場合も、話者・style_id・尺はこの表どおりにすれば動画と同期します。")
lines.append(f"\n{TL['meta']['credit']}")
open(os.path.join(R, "script.md"), "w", encoding="utf-8").write("\n".join(lines))
print("script.md 生成")
