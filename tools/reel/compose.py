#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""テロップは「透明オーバーレイ」として生成し、動く映像の上に重ねる。
 overlays/<id>.png … 各beatのテロップ(透明) / cards/<kind>.png … 静止カード / end.png"""
import json, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(ROOT, "frames")
OV = os.path.join(ROOT, "overlays"); os.makedirs(OV, exist_ok=True)
CARDS = os.path.join(ROOT, "cards"); os.makedirs(CARDS, exist_ok=True)
W, H = 1080, 1920
FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf"
def f(sz): return ImageFont.truetype(FONT, sz)

with open(os.path.join(ROOT, "timeline.json"), encoding="utf-8") as fp:
    TL = json.load(fp)
SPK = TL["meta"]["speakers"]

def wrap_cjk(text, font, maxw):
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if font.getlength(cur + ch) > maxw and cur:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur: lines.append(cur)
    return lines

def outline(d, xy, s, font, fill, sw=6, anchor=None, stroke=(0, 0, 0, 235)):
    d.text(xy, s, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke, anchor=anchor)

def draw_badge(d):
    label = "勝手にコンサル ｜ 103日目"; fo = f(34); tw = fo.getlength(label)
    d.rounded_rectangle([40, 70, 40 + tw + 56, 134], radius=32, fill=(15, 18, 22, 175))
    outline(d, (68, 102), label, fo, (240, 224, 168, 255), sw=3, anchor="lm")

def draw_title(d, title, accent=(255, 255, 255, 255)):
    fo = f(82); lines = wrap_cjk(title, fo, W - 150); y = 350
    for ln in lines:
        outline(d, (W / 2, y), ln, fo, accent, sw=10, anchor="mm"); y += 104

def draw_telop(d, sp, text):
    bodyf = f(62); lines = wrap_cjk(text, bodyf, W - 180); lh = 84
    panel_h = 64 + lh * len(lines) + 40
    py = H - 250 - panel_h
    d.rounded_rectangle([50, py, W - 50, py + panel_h], radius=28, fill=(10, 12, 16, 175))
    ty = py + 40
    if sp in SPK:
        name = SPK[sp]["name"]; col = tuple(SPK[sp]["color"]); nf = f(38); nw = nf.getlength(name)
        d.rounded_rectangle([78, py - 30, 78 + nw + 48, py + 38], radius=28, fill=col + (255,))
        outline(d, (102, py + 4), name, nf, (255, 255, 255, 255), sw=3, anchor="lm")
        ty = py + 60
    for ln in lines:
        outline(d, (W / 2, ty + lh / 2), ln, bodyf, (255, 255, 255, 255), sw=6, anchor="mm"); ty += lh

def make_overlay(beat):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im, "RGBA")
    draw_badge(d)
    if beat.get("title"):
        draw_title(d, beat["title"])
    if beat["sp"] in SPK:  # narration はカードに本文があるのでテロップ無し
        draw_telop(d, beat["sp"], beat["text"])
    im.save(os.path.join(OV, f"{beat['id']:02d}.png"))

# ---------- カード ----------
def backdrop(tint=(8, 10, 14), blur=18, dark=0.5):
    src = os.path.join(FRAMES, "b01", "f0000.jpg")
    if os.path.exists(src):
        im = Image.open(src).convert("RGB")
        s = max(W / im.width, H / im.height)
        im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2,) * 1 + ((im.width - W) // 2 + W, (im.height - H) // 2 + H))
        im = im.filter(ImageFilter.GaussianBlur(blur))
        im = Image.blend(im, Image.new("RGB", (W, H), tint), dark)
    else:
        im = Image.new("RGB", (W, H), tint)
    return im

def make_card(kind):
    im = backdrop(); d = ImageDraw.Draw(im, "RGBA")
    if kind == "prompt":
        d.rounded_rectangle([90, 700, W - 90, 1250], radius=36, fill=(20, 24, 30, 235), outline=(120, 200, 90, 255), width=4)
        outline(d, (130, 748), "〔 入力したプロンプト 〕", f(40), (180, 220, 150, 255), sw=3)
        yy = 870
        for ln in ["「広島のプチヘルメースっていう", "廃校のパン屋を、歩いて行ける", "オープンワールドにして」"]:
            outline(d, (130, yy), ln, f(54), (255, 255, 255, 255), sw=5); yy += 96
        outline(d, (W / 2, 1330), "…たった、これだけ。", f(56), (255, 235, 150, 255), sw=7, anchor="mm")
    elif kind == "2step":
        outline(d, (W / 2, 560), "やったのは、2ステップ", f(68), (255, 255, 255, 255), sw=9, anchor="mm")
        for (mk, tx, col, yy) in [("①", "新AI「Fable 5」に一言投げる", (120, 200, 90), 730),
                                   ("②", "「字幕＋自然な声で」と頼む", (90, 170, 230), 950)]:
            d.rounded_rectangle([90, yy, W - 90, yy + 175], radius=30, fill=(16, 20, 26, 225))
            outline(d, (160, yy + 88), mk, f(86), col + (255,), sw=5, anchor="mm")
            for i, ln in enumerate(wrap_cjk(tx, f(46), W - 380)):
                outline(d, (255, yy + 58 + i * 62), ln, f(46), (255, 255, 255, 255), sw=4)
        outline(d, (W / 2, 1260), "あとは全部、AIがやった。", f(52), (255, 235, 150, 255), sw=7, anchor="mm")
    elif kind == "assets":
        outline(d, (W / 2, 540), "AIが自動で用意したもの", f(64), (255, 255, 255, 255), sw=9, anchor="mm")
        yy = 700
        for c in ["・ キャラ（無料CC0素材）", "・ 廃校・パン屋・教室カフェ", "・ 田んぼ・山・川・電柱",
                  "・ 天気（晴れ・霧・雨）", "・ 歩く村人・犬の散歩"]:
            d.rounded_rectangle([110, yy, W - 110, yy + 116], radius=26, fill=(16, 20, 26, 220))
            outline(d, (150, yy + 58), c, f(46), (235, 240, 245, 255), sw=4, anchor="lm"); yy += 140
    elif kind == "news":
        im = backdrop(tint=(34, 8, 8), dark=0.58); d = ImageDraw.Draw(im, "RGBA")
        d.rounded_rectangle([90, 680, W - 90, 1280], radius=30, fill=(14, 14, 16, 238), outline=(220, 70, 60, 255), width=5)
        outline(d, (130, 728), "【 速報 ／ 実話 】", f(44), (255, 120, 110, 255), sw=4)
        for i, ln in enumerate(["米政府の指令で", "「Fable 5」全停止。", "公開から、わずか3日。"]):
            outline(d, (130, 850 + i * 112), ln, f(62), (255, 255, 255, 255), sw=6)
        outline(d, (130, 1210), "理由は —「強すぎる」から。", f(46), (255, 210, 120, 255), sw=4)
    elif kind == "link":
        outline(d, (W / 2, 700), "▼ あなたも歩ける", f(70), (255, 255, 255, 255), sw=9, anchor="mm")
        d.rounded_rectangle([110, 840, W - 110, 1090], radius=34, fill=(16, 20, 26, 232), outline=(90, 170, 230, 255), width=4)
        outline(d, (W / 2, 922), "リンクは プロフィールから", f(54), (160, 210, 245, 255), sw=5, anchor="mm")
        outline(d, (W / 2, 1014), "「プチヘルメース」追体験ゲーム", f(42), (235, 240, 245, 255), sw=4, anchor="mm")
        outline(d, (W / 2, 1210), "★ 保存して、あとで散歩。", f(50), (255, 235, 150, 255), sw=6, anchor="mm")
    im.convert("RGB").save(os.path.join(CARDS, f"{kind}.png"), quality=95)

def make_end():
    im = backdrop(dark=0.52); d = ImageDraw.Draw(im, "RGBA")
    outline(d, (W / 2, 740), "勝手にコンサル", f(54), (240, 224, 168, 255), sw=6, anchor="mm")
    outline(d, (W / 2, 850), "103日目", f(112), (255, 255, 255, 255), sw=11, anchor="mm")
    outline(d, (W / 2, 1030), "作ったAIは、もう存在しない。", f(48), (235, 240, 245, 255), sw=5, anchor="mm")
    outline(d, (W / 2, 1110), "でも、村は残った。", f(48), (235, 240, 245, 255), sw=5, anchor="mm")
    outline(d, (W / 2, 1720), TL["meta"]["credit"], f(28), (200, 205, 210, 255), sw=3, anchor="mm")
    im.convert("RGB").save(os.path.join(ROOT, "end.png"))

def main():
    for b in TL["beats"]:
        make_overlay(b)
    for kind in ["prompt", "2step", "assets", "news", "link"]:
        make_card(kind)
    make_end()
    print(f"overlays:{len(TL['beats'])}  cards:5  end.png OK")

if __name__ == "__main__":
    main()
