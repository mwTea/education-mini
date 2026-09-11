#!/usr/bin/env python3
"""内页清扫：把 v1 暖橙纸感色值批量映射到 V2 设计令牌。

原则：学科页映射学科色（语文红/英语绿/数学主蓝），公共页映射主蓝或暖橙，
中性纸色统一映射令牌；田字格绿、示例字红等功能色保留。
"""
import re
import sys

BASE = '/Users/likangdong/Documents/workspace/education/miniprogram/'

NEUTRAL = {
    # 深棕文字 → 文字令牌
    '#3a2e25': 'var(--c-text)', '#2f2a26': 'var(--c-text)',
    '#4a4038': 'var(--c-text-sub)', '#6b5f51': 'var(--c-text-sub)', '#8a7a68': 'var(--c-text-sub)',
    # 浅棕辅助字 → 次级/弱文字
    '#9a8c80': 'var(--c-text-faint)', '#a4937f': 'var(--c-text-faint)', '#b3a48f': 'var(--c-text-faint)',
    '#b3a89d': 'var(--c-text-faint)', '#b3a08b': 'var(--c-text-faint)', '#c9b8a3': 'var(--c-text-faint)',
    '#c5bab0': 'var(--c-text-faint)', '#c9bda8': 'var(--c-text-faint)', '#d8c9bc': 'var(--c-text-faint)',
    '#d8c6a4': 'var(--c-text-faint)', '#d8c9ac': 'var(--c-text-faint)', '#d8c9b2': 'var(--c-text-faint)',
    # 纸感分割线 → 线条令牌
    '#e6d9bf': 'var(--c-line)', '#f5efe4': 'var(--c-line)', '#f0e2cc': 'var(--c-line)',
    '#ecd9c3': 'var(--c-line)', '#ecd9bd': 'var(--c-line)', '#e5d8c3': 'var(--c-line)',
    # 纸底 → 白卡 / 暖浅灰
    '#fffdf6': '#fff', '#fffcf4': '#fff',
    '#fffaf1': '#f4f1e9', '#faf5ea': '#f4f1e9', '#faf4e8': '#f4f1e9', '#f6efe0': '#f4f1e9',
    '#f7efe2': '#f4f1e9', '#f5ecdc': '#f4f1e9', '#f4ecdd': '#efece3', '#f9f4e8': '#f8f6f0',
    '#e8dcc4': '#e5e0d5',
    'rgba(58, 46, 37, 0.45)': 'rgba(15, 23, 42, 0.45)',
    'rgba(150, 108, 60, 0.07)': 'rgba(31, 41, 55, 0.06)',
    'rgba(150,108,60,0.12)': 'rgba(31, 41, 55, 0.1)',
    'rgba(255, 253, 246, 0.92)': 'rgba(255, 255, 255, 0.92)',
    'rgba(250, 244, 232, 0.9)': 'rgba(255, 255, 255, 0.92)',
    # 功能色
    '#d9534f': 'var(--c-error)', 'rgba(217, 83, 79, 0.35)': 'rgba(239, 68, 68, 0.3)',
    '#2f9e63': 'var(--c-success)', '#48a273': 'var(--c-success)', '#ddf3e6': '#dcfce7',
    '#f2c4c0': '#fecaca', '#f5b942': 'var(--c-warn)',
}

CHINESE = {
    '#f0821e': 'var(--c-chinese)', '#e2703a': 'var(--c-chinese)', '#d97a2b': 'var(--c-chinese)',
    '#f2703f': 'var(--c-chinese)', '#ffa04d': '#ff8f6b',
    '#fff6ec': 'var(--c-chinese-soft)', '#fff2e2': 'var(--c-chinese-soft)', '#fff3e6': 'var(--c-chinese-soft)',
    '#fff1e0': 'var(--c-chinese-soft)', '#ffe9d2': 'var(--c-chinese-soft)',
    '#b0653a': '#b45454', '#d9a06b': '#e08585', '#f0c9a0': '#f3c6c6',
    '#c07f4e': '#c2410c', '#fdf6e9': 'var(--c-warm-soft)',
    'rgba(240, 130, 30, 0.16)': 'rgba(245, 108, 108, 0.2)',
}

ENGLISH = {
    '#f0821e': 'var(--c-english)', '#e2703a': 'var(--c-english)', '#d97a2b': 'var(--c-english)',
    '#f2703f': 'var(--c-english)', '#ffa04d': '#5fd6ad',
    '#fff6ec': 'var(--c-english-soft)', '#fff2e2': 'var(--c-english-soft)', '#fff3e6': 'var(--c-english-soft)',
    '#fff1e0': 'var(--c-english-soft)', '#ffe9d2': 'var(--c-english-soft)',
    '#b0653a': '#2f8f6f', '#d9a06b': '#7cc9b1',
    'rgba(240, 130, 30, 0.16)': 'rgba(16, 185, 129, 0.2)',
    '#c07f4e': '#0f766e', '#fdf6e9': 'var(--c-warm-soft)',
}

PRIMARY = {
    '#3f92bb': 'var(--c-primary)', '#7cc0dd': '#6ea8ff', '#2f7fa8': 'var(--c-primary-ink)',
    '#e3f4fc': 'var(--c-primary-soft)', '#e9f6fc': 'var(--c-primary-soft)', '#eaf5fb': 'var(--c-primary-soft)',
    '#f2fbff': 'var(--c-primary-soft)', '#e3f2fa': 'var(--c-primary-soft)',
    '#b7d9e8': '#bfdbfe', '#e8edf2': '#eef2f7', '#eef0f2': '#eef2f7', '#8aa': '#94a3b8',
}

WARM = {
    '#f0821e': 'var(--c-warm)', '#ee782c': 'var(--c-warm)', '#ffb25c': 'var(--c-warm-light)',
    '#ffe9d2': 'var(--c-warm-soft)', '#fff5ed': 'var(--c-warm-soft)',
    '#ff9a76': '#ff8f6b', '#c04a20': '#b45454', '#f5d4bc': 'var(--c-chinese-soft)',
    '#e2544e': 'var(--c-error)',
}

FILES = {
    'pages/chinese/chinese.wxss': [CHINESE],
    'pages/english/english.wxss': [ENGLISH],
    'pages/radicals/radicals.wxss': [CHINESE, WARM],
    'pages/about/about.wxss': [WARM],
    'pages/history/history.wxss': [PRIMARY],
    'pages/preview/preview.wxss': [PRIMARY],
    'pages/math/index/index.wxss': [PRIMARY, WARM],
    'pages/math/config/config.wxss': [PRIMARY],
    'pages/math/quiz/quiz.wxss': [PRIMARY],
}


def apply(path, maps):
    with open(BASE + path, encoding='utf-8') as f:
        text = f.read()
    merged = {}
    for m in maps:
        merged.update(m)
    merged.update(NEUTRAL)
    # 最长字面量优先，避免 #fff 命中 #fffdf6 之类前缀
    for k in sorted(merged, key=len, reverse=True):
        text = text.replace(k, merged[k])
    with open(BASE + path, 'w', encoding='utf-8') as f:
        f.write(text)
    left = re.findall(r'#[0-9a-fA-F]{6}\b', text)
    legacy = [c for c in set(left) if c.lower() in
              {'#f0821e', '#e2703a', '#d97a2b', '#3a2e25', '#fffdf6', '#faf5ea', '#f6efe0',
               '#a4937f', '#8a7a68', '#c5bab0', '#3f92bb', '#7cc0dd', '#2f7fa8'}]
    print(f'{path}: {"仍残留 " + str(legacy) if legacy else "清扫完成"}')


for path, maps in FILES.items():
    apply(path, maps)
