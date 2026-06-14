#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""各beatのクリップを作って連結し、縦リールMP4を組み立てる。
 frame beat: 連番フレーム(30fps)＋透明テロップを重ねる（=本物の移動映像）。
 card  beat: 静止カード＋Ken Burns＋テロップ。末尾にエンドカード。音声があれば多重化。"""
import json, os, subprocess, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
FF = os.path.join(ROOT, "bin", "ffmpeg")
FPS = 30        # 最終出力fps
CAP_FPS = 12    # 撮影(キーフレーム)fps → minterpolateで30fpsへ補間
with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as f:
    TL = json.load(f)
with open(os.path.join(ROOT, "timing.json"), encoding="utf-8") as f:
    T = json.load(f)
os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
tmp = tempfile.mkdtemp(prefix="reel_")

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("FFMPEG ERR:", " ".join(str(c) for c in cmd[:8]), "...\n", r.stderr[-1800:]); raise SystemExit(1)

beats = TL["beats"]
durs = [fr["dur"] for fr in T["frames"]]      # beat順 + 末尾end
end_dur = durs[-1]
clips = []

for i, b in enumerate(beats):
    dur = durs[i]; N = max(2, round(dur * FPS))
    ov = os.path.join(ROOT, "overlays", f"{b['id']:02d}.png")
    out = os.path.join(tmp, f"c{i:02d}.mp4")
    kind, _, name = b["bg"].partition(":")
    if kind == "frame":
        seq = os.path.join(ROOT, "frames", f"b{b['id']:02d}", "f%04d.jpg")
        # 12fpsキーフレームを minterpolate で30fpsへ補間→1080拡大→テロップ重ね（滑らか）
        fc = ("[0:v]minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,"
              "scale=1080:1920:flags=lanczos[v];[v][1:v]overlay=0:0:shortest=1,format=yuv420p")
        run([FF, "-y", "-framerate", str(CAP_FPS), "-i", seq, "-loop", "1", "-i", ov,
             "-filter_complex", fc, "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-r", str(FPS), out])
    else:  # card
        card = os.path.join(ROOT, "cards", f"{name}.png")
        z = f"1.0+0.05*on/{N}"
        fc = (f"[0:v]scale=2160:3840:flags=lanczos,"
              f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={N}:s=1080x1920:fps={FPS}[bg];"
              f"[bg][1:v]overlay=0:0:shortest=1,format=yuv420p")
        run([FF, "-y", "-loop", "1", "-t", f"{dur:.3f}", "-i", card, "-loop", "1", "-i", ov,
             "-filter_complex", fc, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), out])
    clips.append(out)
    print(f"beat {b['id']:02d} [{kind}] {dur:.2f}s")

# エンドカード（Ken Burns、テロップ無し）
endc = os.path.join(tmp, "cend.mp4"); Ne = round(end_dur * FPS)
run([FF, "-y", "-loop", "1", "-t", f"{end_dur:.3f}", "-i", os.path.join(ROOT, "end.png"),
     "-vf", f"scale=2160:3840,zoompan=z='1.0+0.04*on/{Ne}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={Ne}:s=1080x1920:fps={FPS},format=yuv420p",
     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), endc])
clips.append(endc)

# 連結
lst = os.path.join(tmp, "list.txt")
with open(lst, "w") as f:
    for c in clips: f.write(f"file '{c}'\n")
silent = os.path.join(tmp, "silent.mp4")
run([FF, "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent])

total = float(T["total"])
fade = f"fade=t=in:st=0:d=0.5,fade=t=out:st={max(0,total-0.8):.2f}:d=0.8"
out_mp4 = os.path.join(ROOT, "out", "reel_103.mp4")
audio = T.get("audio")
if T.get("has_audio") and audio and os.path.exists(os.path.join(ROOT, audio)):
    run([FF, "-y", "-i", silent, "-i", os.path.join(ROOT, audio),
         "-vf", fade, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-shortest", out_mp4])
else:
    run([FF, "-y", "-i", silent, "-vf", fade,
         "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", out_mp4])

pr = subprocess.run([os.path.join(ROOT, "bin", "ffprobe"), "-v", "error", "-show_entries",
                     "format=duration:stream=codec_type,width,height", "-of", "default=nw=1", out_mp4],
                    capture_output=True, text=True)
print("=== reel_103.mp4 ===\n" + pr.stdout, "\nOUT:", out_mp4)
