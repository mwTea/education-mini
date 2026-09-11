'use strict';

/**
 * 语文（汉字）字帖排版 —— 每字一行模型
 *
 * 练字帖 / 听写卷：每个汉字独占一行，
 *   范字（黑色，固定 1 格）→ 描红（红色）× traceCount → 空白练习格补满整行
 * 每行格数、每页行数由 A4 版面直接推导，不作为用户选项。
 *
 * 生字卡片（mode: 'card'）：每字一张卡，三行结构：
 *   info      拼音 + 部首/笔画/结构 + 组词（来自 hanzi.service，缺数据自动省略）
 *   strokeOrder 逐笔累加的笔顺演示行（打印页/PDF 渲染，小程序预览跳过）
 *   practice  描红练习行（同练字帖）
 *
 * 拼音：标注在每行行首（范字上方）/卡片信息行，未手工提供时自动注音（pinyin-pro）。
 */

const { pinyin } = require('pinyin-pro');
const hanziData = require('../hanzi.service');

// A4 版面常量：内容宽约 182mm、单格 15mm → 每行 12 格；
// 内容高约 269mm，带拼音行高约 22mm → 每页 11 行，不带约 17mm → 14 行
const CELLS_PER_ROW = 12;
const CARDS_PER_PAGE = 3; // 生字卡片：组词练习收在右栏（描红行下方），A4 每页 3 张
const CARD_CELLS_PER_ROW = 12; // 卡片右侧练习区每行格数

const DEFAULT_OPTIONS = {
  grid: 'tian', // tian 田字格 | mi 米字格 | fang 方格（无辅助线）
  mode: 'copy', // copy 练字 | dictation 听写 | card 生字卡片
  paper: 'classic', // classic 仿真纸（绿格黑范字红描红）| plain 素雅（灰格浅灰描红）
  font: 'kai', // kai 正楷（霞鹜文楷）| xingkai 行楷（志莽行书）
  showPinyin: false,
  traceCount: 2, // 每字描红遍数（范字固定 1 遍，行内其余自动补空白）
};

const LIMITS = {
  maxChars: 30, // 练字/听写：每份 30 字（带拼音约 3 页）
  maxCardChars: 20, // 卡片每页 3 张，20 字约 7 页（一整课课文通常 10~15 字）
  traceCount: [0, CELLS_PER_ROW - 1],
};

function clampOption(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeOptions(raw = {}) {
  const opts = { ...DEFAULT_OPTIONS };
  opts.grid = ['tian', 'mi', 'fang'].includes(raw.grid) ? raw.grid : DEFAULT_OPTIONS.grid;
  opts.mode = ['copy', 'dictation', 'card'].includes(raw.mode) ? raw.mode : DEFAULT_OPTIONS.mode;
  opts.paper = ['classic', 'plain'].includes(raw.paper) ? raw.paper : DEFAULT_OPTIONS.paper;
  opts.font = ['kai', 'xingkai'].includes(raw.font) ? raw.font : DEFAULT_OPTIONS.font;
  opts.showPinyin = raw.showPinyin === true || raw.showPinyin === 'true';
  if (opts.mode === 'dictation') opts.showPinyin = true; // 听写卷必须能看到拼音
  opts.traceCount = clampOption(raw.traceCount, LIMITS.traceCount, DEFAULT_OPTIONS.traceCount);

  // A4 推导的排版参数（随 showPinyin 决定行高，进而决定每页行数）
  opts.charsPerRow = CELLS_PER_ROW;
  opts.rowsPerPage = opts.showPinyin ? 11 : 14;
  return opts;
}

function sanitizeChars(raw, mode) {
  if (typeof raw !== 'string') return [];
  const cap = mode === 'card' ? LIMITS.maxCardChars : LIMITS.maxChars;
  return Array.from(raw.replace(/\s+/g, '')).slice(0, cap);
}

/** 手工拼音优先；数量不匹配时忽略，走自动注音 */
function resolvePinyinList(raw, charList) {
  if (typeof raw === 'string' && raw.trim()) {
    const manual = raw.trim().split(/[\s,，、]+/).filter(Boolean).map((s) => s.toLowerCase());
    if (manual.length === charList.length) return manual;
  }
  try {
    return charList.map((ch) => (/[\u3400-\u9fff]/.test(ch)
      ? pinyin(ch, { toneType: 'symbol', type: 'array', nonZh: 'consecutive' })[0] || ''
      : ''));
  } catch (e) {
    return charList.map(() => '');
  }
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function buildRow(char, pinyin, opts) {
  const cells = [];
  if (opts.mode === 'dictation') {
    for (let c = 0; c < CELLS_PER_ROW; c += 1) {
      cells.push({ char, style: 'blank', pinyin: c === 0 ? pinyin : null });
    }
    return { kind: 'practice', cells };
  }
  cells.push({ char, style: 'demo', pinyin });
  for (let t = 0; t < opts.traceCount; t += 1) {
    cells.push({ char, style: 'trace', pinyin: null });
  }
  while (cells.length < CELLS_PER_ROW) {
    cells.push({ char, style: 'blank', pinyin: null });
  }
  return { kind: 'practice', cells };
}

/**
 * 生字卡片（竞品式表格化布局，一张红框卡）：
 *   顶栏：拼音格 + 笔顺演示长条（渲染层画，布局只给 char）
 *   左栏：大范字格 + 笔画/部首/结构标签
 *   右区：组词行 + 两行描红（每行 范字1 + 描红N + 空白补满）
 */
function buildCard(char, pinyin, opts) {
  const data = hanziData.lookup(char) || {};
  const meta = {};
  if (data.radical) meta.radical = data.radical;
  if (data.strokeCount) meta.strokes = data.strokeCount;
  if (data.structure) meta.structure = data.structure;
  const words = Array.isArray(data.words) ? data.words.filter(Boolean).slice(0, 3) : [];

  const practiceRows = [0, 1].map(() => {
    const cells = [{ char, style: 'demo', pinyin: null }];
    for (let t = 0; t < opts.traceCount; t += 1) cells.push({ char, style: 'trace', pinyin: null });
    while (cells.length < CARD_CELLS_PER_ROW) cells.push({ char, style: 'blank', pinyin: null });
    return { cells };
  });

  // 组词练习：两行全宽空白格
  const wordRows = [0, 1].map(() => ({
    cells: Array.from({ length: CARD_CELLS_PER_ROW }, () => ({ char, style: 'blank', pinyin: null })),
  }));

  const card = { kind: 'card', char, pinyin: pinyin || null, practiceRows, wordRows };
  if (Object.keys(meta).length) card.meta = meta;
  if (words.length) card.words = words;
  // 笔顺 SVG 路径（hanzi-writer-data，坐标系 1024×900）：小程序预览画笔顺演示条用
  const strokes = hanziData.strokePaths(char);
  if (Array.isArray(strokes) && strokes.length) card.strokes = strokes;
  return card;
}

function buildChineseSheet({ title, chars, pinyin, options }) {
  const opts = normalizeOptions(options);
  const charList = sanitizeChars(chars, opts.mode);
  const pinyinList = resolvePinyinList(pinyin, charList);

  let pages;
  if (opts.mode === 'card') {
    const cards = charList.map((char, i) => buildCard(char, pinyinList ? pinyinList[i] : null, opts));
    pages = chunk(cards, CARDS_PER_PAGE).map((pageCards, index) => ({
      number: index + 1,
      rows: pageCards,
    }));
  } else {
    const rows = charList.map((char, i) => buildRow(char, pinyinList ? pinyinList[i] : null, opts));
    pages = chunk(rows, opts.rowsPerPage).map((pageRows, index) => ({
      number: index + 1,
      rows: pageRows,
    }));
  }

  const sheet = {
    type: 'chinese',
    title,
    options: opts,
    charCount: charList.length,
    pages,
  };
  if (opts.mode === 'dictation') sheet.subtype = '听写卷';
  if (opts.mode === 'card') sheet.subtype = '生字卡片';
  return sheet;
}

module.exports = { buildChineseSheet, DEFAULT_OPTIONS, CELLS_PER_ROW };
