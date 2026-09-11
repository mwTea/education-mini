#!/usr/bin/env python3
"""生成 TabBar 图标与快捷入口图形图标（81/96px PNG，8 倍超采样抗锯齿）。"""
from PIL import Image, ImageDraw, ImageFont
import os

S = 8
OUT = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'assets')
TABDIR = os.path.join(OUT, 'tabbar')
QUICKDIR = os.path.join(OUT, 'quick')
os.makedirs(TABDIR, exist_ok=True)
os.makedirs(QUICKDIR, exist_ok=True)


def canvas(px):
    m = Image.new('L', (px * S, px * S), 0)
    return m, ImageDraw.Draw(m)


def save(mask, color, path, px):
    img = Image.new('RGBA', (px * S, px * S), color + (0,))
    solid = Image.new('RGBA', (px * S, px * S), color + (255,))
    img.paste(solid, (0, 0), mask)
    img = img.resize((px, px), Image.LANCZOS)
    img.save(path)


def draw_home(d, u):
    d.polygon([(40.5 * u, 11 * u), (7 * u, 40 * u), (74 * u, 40 * u)], fill=255)
    d.rounded_rectangle([13 * u, 35 * u, 68 * u, 71 * u], radius=7 * u, fill=255)
    d.rounded_rectangle([33 * u, 50 * u, 48 * u, 71 * u], radius=4 * u, fill=0)


def draw_learn(d, u):
    d.polygon([(40.5 * u, 14 * u), (33 * u, 20 * u), (33 * u, 62 * u), (40.5 * u, 68 * u),
               (48 * u, 62 * u), (48 * u, 20 * u)], fill=255)
    d.rounded_rectangle([11 * u, 22 * u, 33 * u, 60 * u], radius=4 * u, fill=255)
    d.rounded_rectangle([48 * u, 22 * u, 70 * u, 60 * u], radius=4 * u, fill=255)
    d.polygon([(40.5 * u, 14 * u), (36 * u, 19 * u), (40.5 * u, 23 * u), (45 * u, 19 * u)], fill=255)


def draw_print(d, u):
    d.rounded_rectangle([25 * u, 10 * u, 56 * u, 24 * u], radius=3 * u, fill=255)
    d.rounded_rectangle([12 * u, 24 * u, 69 * u, 56 * u], radius=8 * u, fill=255)
    d.ellipse([54 * u, 36 * u, 63 * u, 45 * u], fill=0)
    d.rounded_rectangle([22 * u, 48 * u, 59 * u, 71 * u], radius=3 * u, fill=255)
    d.rectangle([22 * u, 48 * u, 59 * u, 54 * u], fill=0)


def draw_growth(d, u):
    d.rounded_rectangle([14 * u, 47 * u, 28 * u, 71 * u], radius=4 * u, fill=255)
    d.rounded_rectangle([33 * u, 34 * u, 47 * u, 71 * u], radius=4 * u, fill=255)
    d.rounded_rectangle([52 * u, 20 * u, 66 * u, 71 * u], radius=4 * u, fill=255)


def draw_profile(d, u):
    d.ellipse([28 * u, 10 * u, 53 * u, 35 * u], fill=255)
    d.pieslice([18 * u, 42 * u, 63 * u, 92 * u], 180, 360, fill=255)
    d.rectangle([18 * u, 66 * u, 63 * u, 71 * u], fill=255)


TAB_ICONS = {
    'home': draw_home,
    'learn': draw_learn,
    'print': draw_print,
    'growth': draw_growth,
    'profile': draw_profile,
}

for name, fn in TAB_ICONS.items():
    for suffix, color in [('', (154, 163, 178)), ('-on', (59, 130, 246))]:
        m, d = canvas(81)
        fn(d, S)
        save(m, color, os.path.join(TABDIR, f'{name}{suffix}.png'), 81)


def draw_pencil(d, u):
    d.polygon([(22 * u, 58 * u), (58 * u, 22 * u), (66 * u, 30 * u), (30 * u, 66 * u)], fill=255)
    d.polygon([(22 * u, 58 * u), (18 * u, 70 * u), (30 * u, 66 * u)], fill=255)
    d.polygon([(58 * u, 22 * u), (62 * u, 18 * u), (70 * u, 26 * u), (66 * u, 30 * u)], fill=255)


def draw_nametag(d, u):
    d.rounded_rectangle([14 * u, 20 * u, 66 * u, 62 * u], radius=8 * u, fill=255)
    d.ellipse([30 * u, 28 * u, 40 * u, 38 * u], fill=0)
    d.pieslice([26 * u, 38 * u, 44 * u, 56 * u], 180, 360, fill=0)
    d.rounded_rectangle([46 * u, 30 * u, 60 * u, 34 * u], radius=2 * u, fill=0)
    d.rounded_rectangle([46 * u, 40 * u, 60 * u, 44 * u], radius=2 * u, fill=0)
    d.polygon([(34 * u, 62 * u), (40.5 * u, 72 * u), (46 * u, 62 * u)], fill=255)


def draw_grid(d, u):
    d.rounded_rectangle([15 * u, 15 * u, 38 * u, 38 * u], radius=6 * u, fill=255)
    d.rounded_rectangle([43 * u, 15 * u, 66 * u, 38 * u], radius=6 * u, fill=255)
    d.rounded_rectangle([15 * u, 43 * u, 38 * u, 66 * u], radius=6 * u, fill=255)
    d.rounded_rectangle([43 * u, 43 * u, 66 * u, 66 * u], radius=6 * u, fill=255)


def draw_clock(d, u):
    d.ellipse([12 * u, 12 * u, 69 * u, 69 * u], fill=255)
    d.ellipse([19 * u, 19 * u, 62 * u, 62 * u], fill=0)
    d.ellipse([37 * u, 37 * u, 44 * u, 44 * u], fill=255)
    d.polygon([(40.5 * u, 24 * u), (38 * u, 39 * u), (43 * u, 39 * u)], fill=255)
    d.polygon([(56 * u, 40.5 * u), (42 * u, 38 * u), (42 * u, 43 * u)], fill=255)


QUICK_ICONS = {
    'quiz': (draw_pencil, (37, 99, 235)),
    'name': (draw_nametag, (239, 68, 68)),
    'radical': (draw_grid, (245, 158, 11)),
    'history': (draw_clock, (139, 92, 246)),
}

for name, (fn, color) in QUICK_ICONS.items():
    m, d = canvas(96)
    fn(d, S)
    save(m, color, os.path.join(QUICKDIR, f'{name}.png'), 96)

print('generated:', sorted(os.listdir(TABDIR)), sorted(os.listdir(QUICKDIR)))
