#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""voicevox_core(オフライン)で台本を音声合成し、narration.wav と timing.json を出力。
合成に失敗しても timing.json は必ず出す（has_audio=false の無音フォールバック）。"""
import json, os, glob, wave, struct, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
VV = os.path.join(ROOT, "runtime", "vv")
with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as fp:
    TL = json.load(fp)
SPK = TL["meta"]["speakers"]
END_DUR = 1.8
GAP = 0.16   # 各行の後の余白
SPEED = 1.25  # 話速（リール向けに少し速め）

def build_timing(durs, has_audio, audio_path=None):
    frames = [{"img": f"composed/{b['id']:02d}.png", "dur": round(durs[b["id"]], 3)} for b in TL["beats"]]
    frames.append({"img": "composed/end.png", "dur": END_DUR})
    out = {"frames": frames, "has_audio": has_audio, "audio": audio_path,
           "total": round(sum(x["dur"] for x in frames), 2)}
    with open(os.path.join(ROOT, "timing.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"timing.json: total {out['total']}s  has_audio={has_audio}")
    return out

def fallback():
    durs = {b["id"]: b.get("min_dur", 2.5) for b in TL["beats"]}
    build_timing(durs, False)

def main():
    try:
        from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
    except Exception as e:
        print("voicevox_core import 失敗 →無音フォールバック:", e); return fallback()
    try:
        libs = glob.glob(os.path.join(VV, "onnxruntime", "**", "libvoicevox_onnxruntime.so*"), recursive=True)
        libs = [l for l in libs if os.path.isfile(l)]
        if not libs:
            raise RuntimeError("onnxruntime .so が見つからない")
        ort = Onnxruntime.load_once(filename=sorted(libs)[-1])
        dic = glob.glob(os.path.join(VV, "dict", "open_jtalk_dic_utf_8-*"))
        ojt = OpenJtalk(dic[0])
        syn = Synthesizer(ort, ojt)

        # まず全vvmの metas だけ軽く読み、必要な話者を含むモデルを特定（全ロードは重いので回避）
        want_names = {SPK[sp]["name"] for sp in SPK}            # 四国めたん/ずんだもん/雨晴はう
        want_ids = {SPK[sp]["style_id"] for sp in SPK}          # 2/3/10
        need_vvm = {}      # vvm_path -> True
        style_by_id = {}   # style_id -> vvm_path
        name_norm = {}     # speaker名 -> ノーマルのstyle_id
        for vvm in sorted(glob.glob(os.path.join(VV, "models", "*.vvm"))):
            with VoiceModelFile.open(vvm) as m:
                for meta in m.metas:
                    for st in meta.styles:
                        if st.id in want_ids:
                            style_by_id[st.id] = vvm; need_vvm[vvm] = True
                        if meta.name in want_names and st.name == "ノーマル":
                            name_norm[meta.name] = st.id
                            need_vvm.setdefault(vvm, True)
        # 解決: timelineのstyle_idがあればそれ、無ければ話者名のノーマル
        sid = {}
        for sp in SPK:
            want = SPK[sp]["style_id"]
            if want in style_by_id:
                sid[sp] = want
            else:
                sid[sp] = name_norm.get(SPK[sp]["name"])
                if sid[sp] is not None:
                    style_by_id[sid[sp]] = next(v for v in glob.glob(os.path.join(VV, "models", "*.vvm")))
        print("style_id:", sid, flush=True)
        # 必要なモデルだけロード
        for vvm in {style_by_id[i] for i in sid.values() if i in style_by_id}:
            with VoiceModelFile.open(vvm) as m:
                syn.load_voice_model(m)
            print("loaded model:", os.path.basename(vvm), flush=True)

        os.makedirs(os.path.join(ROOT, "wav"), exist_ok=True)
        segs = []   # (id, pcm_bytes, voice_dur)
        rate = None; sampw = 2; ch = 1
        for b in TL["beats"]:
            say = b.get("say", "").strip()
            if say and b["sp"] in SPK:
                aq = syn.create_audio_query(say, sid[b["sp"]])
                aq.speed_scale = SPEED
                aq.pre_phoneme_length = 0.05
                aq.post_phoneme_length = 0.05
                wav = syn.synthesis(aq, sid[b["sp"]])
                p = os.path.join(ROOT, "wav", f"{b['id']:02d}.wav")
                with open(p, "wb") as f:
                    f.write(wav)
                with wave.open(p, "rb") as w:
                    rate = rate or w.getframerate(); sampw = w.getsampwidth(); ch = w.getnchannels()
                    pcm = w.readframes(w.getnframes())
                vd = len(pcm) / (rate * sampw * ch)
                segs.append((b["id"], pcm, vd))
            else:
                segs.append((b["id"], b"", 0.0))
        rate = rate or 24000
        # 行ごとの尺 = max(min_dur, 声+GAP)。声の後ろを無音パディングして尺を満たす
        durs = {}; track = bytearray()
        frame = sampw * ch
        silence = lambda sec: b"\x00" * (int(rate * max(0.0, sec)) * frame)  # 必ずフレーム境界に揃える
        for (bid, pcm, vd) in segs:
            mind = next(b.get("min_dur", 2.5) for b in TL["beats"] if b["id"] == bid)
            dur = max(mind, vd + GAP if vd else mind)
            durs[bid] = dur
            track += pcm + silence(dur - vd)
        track += silence(END_DUR)
        out_wav = os.path.join(ROOT, "wav", "narration.wav")
        with wave.open(out_wav, "wb") as w:
            w.setnchannels(ch); w.setsampwidth(sampw); w.setframerate(rate)
            w.writeframes(bytes(track))
        print(f"narration.wav: {len(track)/(rate*sampw*ch):.1f}s @ {rate}Hz")
        build_timing(durs, True, "wav/narration.wav")
    except Exception as e:
        import traceback; traceback.print_exc()
        print("合成失敗 →無音フォールバック:", e); fallback()

if __name__ == "__main__":
    main()
