# -*- coding: utf-8 -*-
"""生成小程序图标：按「暖橙习字簿」设计语言出 3 款，输出 1024 / 512 / 144。
   字体：霞鹜文楷（与字帖 PDF/预览同源，品牌一致）。"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W = 1024
FONT = os.path.join(os.path.dirname(__file__), '..', '..', 'backend', 'assets', 'fonts', 'LXGWWenKai-Regular.ttf')
FONT = os.path.abspath(FONT)
OUT = os.path.dirname(os.path.abspath(__file__))

INK = (58, 46, 37, 255)        # 墨色 #3A2E25
SEAL_RED = (216, 85, 75, 255)  # 印章红 #D8554B（与 app 内描红/印章同族）


def vgrad(top, bottom):
    col = Image.new('RGB', (1, W))
    for y in range(W):
        t = y / (W - 1)
        col.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return col.resize((W, W)).convert('RGBA')


def fit_font(char, target_h):
    """二分字号，让墨迹高度 ≈ target_h（与 PDF 的 inkCenter 同思路）"""
    lo, hi = 10, 3000
    while lo < hi:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(FONT, mid)
        bb = f.getbbox(char)
        if bb[3] - bb[1] < target_h:
            lo = mid + 1
        else:
            hi = mid
    return ImageFont.truetype(FONT, lo)


def draw_char(layer, char, center, target_h, fill):
    f = fit_font(char, target_h)
    bb = f.getbbox(char)
    x = center[0] - (bb[0] + bb[2]) / 2
    y = center[1] - (bb[1] + bb[3]) / 2
    ImageDraw.Draw(layer).text((x, y), char, font=f, fill=fill)
    return f


def dash_line(d, p1, p2, dash, gap, width, fill):
    x1, y1 = p1
    x2, y2 = p2
    total = math.hypot(x2 - x1, y2 - y1)
    ux, uy = (x2 - x1) / total, (y2 - y1) / total
    s = 0.0
    while s < total:
        e = min(s + dash, total)
        d.line([x1 + ux * s, y1 + uy * s, x1 + ux * e, y1 + uy * e], fill=fill, width=width)
        s = e + gap


def tian_cross(layer, box, color, width=10):
    """田字格十字虚线（内缩留边）"""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(layer)
    dash_line(d, ((x0 + x1) / 2, y0 + 10), ((x0 + x1) / 2, y1 - 10), 34, 24, width, color)
    dash_line(d, (x0 + 10, (y0 + y1) / 2), (x1 - 10, (y0 + y1) / 2), 34, 24, width, color)


def soft_shadow(base, box, blur=60, alpha=80):
    sh = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([box[0] + 40, box[3] - 30, box[2] + 90, box[3] + 90], fill=(110, 45, 8, alpha))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


def seal(char, center, size):
    """红印章（带一点手写歪斜感）"""
    layer = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    half = size / 2
    d.rounded_rectangle([cx - half, cy - half, cx + half, cy + half], radius=size * 0.16,
                        fill=SEAL_RED)
    draw_char(layer, char, center, size * 0.62, (255, 250, 244, 255))
    return layer.rotate(7, resample=Image.BICUBIC, center=center)


def exports(img, name):
    img.convert('RGB').save(os.path.join(OUT, f'{name}-1024.png'))
    img.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'{name}-512.png'))
    img.resize((144, 144), Image.LANCZOS).save(os.path.join(OUT, f'{name}-144.png'))


# ── 方案 A：暖橙底 + 米白田字格 + 大「字」+ 红「练」印章（主视觉，最贴 app 内页）──
def design_a():
    img = vgrad((255, 178, 92), (238, 120, 44))  # #FFB25C → #EE782C
    gx0, gy0, gx1, gy1 = 202, 170, 822, 790       # 620 田字格，略偏上给印章留角
    box = (gx0, gy0, gx1, gy1)
    soft_shadow(img, box)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=44, fill=(255, 252, 244, 255))  # #FFFCF4
    tian_cross(img, box, (240, 152, 146, 255))                       # 描红浅红 #F09892
    draw_char(img, '字', (512, 480), 448, INK)
    img.alpha_composite(seal('练', (gx1 - 16, gy1 - 12), 176))
    exports(img, 'icon-a-tianzi')


# ── 方案 B：米白纸底，上「汉字田字格」下「英语四线三格」，一眼看懂语+英双科 ──
def design_b():
    img = Image.new('RGBA', (W, W), (255, 250, 240, 255))  # #FFFAF0
    d = ImageDraw.Draw(img)
    # 顶部橙色卡片 + 白虚线十字 + 白「字」
    card = (172, 96, 852, 560)
    soft_shadow(img, card, blur=46, alpha=60)
    d.rounded_rectangle(card, radius=52, fill=(240, 138, 60, 255))  # #F08A3C
    tian_cross(img, card, (255, 252, 244, 150))
    draw_char(img, '字', (512, 320), 330, (255, 252, 244, 255))
    # 底部四线三格 + 楷风 Aa
    lx0, lx1 = 176, 848
    ys = [700, 744, 788, 832]
    for i, y in enumerate(ys):
        c = (226, 181, 138) if i % 2 else (214, 163, 112)
        d.line([lx0, y, lx1, y], fill=(*c, 255), width=8)
    f = ImageFont.truetype(FONT, 150)
    d.text((512, ys[2]), 'Aa', font=f, fill=INK, anchor='ms')
    exports(img, 'icon-b-duoke')


# ── 方案 C：还原字帖行 —— 田字格内「拼音在上、生字在下」，产品即图标 ──
def design_c():
    img = vgrad((240, 138, 60), (227, 104, 38))
    box = (212, 212, 812, 812)
    soft_shadow(img, box)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=44, fill=(255, 252, 244, 255))
    tian_cross(img, box, (247, 180, 155, 255))  # 更浅的橘粉，别抢主体
    draw_char(img, 'zì', (512, 300), 66, (201, 127, 92, 255))   # 拼音 #C97F5C
    draw_char(img, '字', (512, 590), 372, INK)
    exports(img, 'icon-c-pinyin')


def preview():
    names = ['icon-a-tianzi', 'icon-b-duoke', 'icon-c-pinyin']
    sheet = Image.new('RGB', (512 * 3 + 80 * 4, 592), (237, 231, 222))
    for i, n in enumerate(names):
        icon = Image.open(os.path.join(OUT, f'{n}-512.png')).convert('RGB')
        sheet.paste(icon, (80 + i * (512 + 80), 40))
    sheet.save(os.path.join(OUT, 'preview-all.png'))


if __name__ == '__main__':
    design_a()
    design_b()
    design_c()
    preview()
    print('done ->', OUT)
