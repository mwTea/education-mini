"use strict";

const zhDict = require('../../data/wordbooks/zh-dict.json').dict;

function lookupZh(word) {
  return zhDict[word] || zhDict[String(word).toLowerCase()] || null;
}

/**
 * 把空格切开的词流按词典贪心合并回短语。
 * 词库导入是把词表用空格拼成文本（"gingerbread house new zealand"），
 * 后端按空格再切会把短语拆碎、释义查不到（默写误降级），
 * 这里在默写排版前按 zh-dict 的短语键做最长匹配还原。
 */
function mergePhrases(tokens) {
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    let phrase = '';
    for (let k = Math.min(5, tokens.length - i); k >= 2; k -= 1) {
      const cand = tokens.slice(i, i + k).join(' ');
      if (zhDict[cand] || zhDict[cand.toLowerCase()]) {
        phrase = cand;
        break;
      }
    }
    if (phrase) {
      out.push(phrase);
      i += phrase.split(' ').length;
    } else {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out;
}

/**
 * 英语字帖排版（四线三格）
 *
 * mode:
 *   copy      抄写帖：整段文本按行重复「描红行 + 空白行」
 *   dictation 默写帖：每个单词独立成行、全部空白，
 *             另出 wordBank（报词栏）供家长报词
 */

const DEFAULT_OPTIONS = {
  letterCase: 'origin', // origin | upper | lower
  mode: 'copy', // copy 抄写 | dictation 默写
  dictationDir: 'zh2en', // zh2en 中译英（提示中文默英文）| en2zh 英译汉（提示英文默中文）
  paper: 'classic',
  traceCount: 1,
  blankCount: 2,
  cellsPerLine: 24,
  rowsPerPage: 12,
};

const LIMITS = {
  maxTextLength: 300,
  maxWords: 30, // 单份最多 30 个单词（约 3~4 页），防止整册导入生成几十页
  traceCount: [0, 4],
  blankCount: [0, 8],
  cellsPerLine: [12, 40],
  rowsPerPage: [4, 20],
};

function clampOption(value, [min, max], fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeOptions(raw = {}) {
  const opts = { ...DEFAULT_OPTIONS };
  opts.letterCase = ['origin', 'upper', 'lower'].includes(raw.letterCase)
    ? raw.letterCase
    : DEFAULT_OPTIONS.letterCase;
  opts.mode = ['copy', 'dictation'].includes(raw.mode) ? raw.mode : DEFAULT_OPTIONS.mode;
  opts.dictationDir = ['zh2en', 'en2zh'].includes(raw.dictationDir) ? raw.dictationDir : DEFAULT_OPTIONS.dictationDir;
  opts.paper = ['classic', 'plain'].includes(raw.paper) ? raw.paper : DEFAULT_OPTIONS.paper;
  opts.traceCount = clampOption(raw.traceCount, LIMITS.traceCount, DEFAULT_OPTIONS.traceCount);
  opts.blankCount = clampOption(raw.blankCount, LIMITS.blankCount, DEFAULT_OPTIONS.blankCount);
  opts.cellsPerLine = clampOption(raw.cellsPerLine, LIMITS.cellsPerLine, DEFAULT_OPTIONS.cellsPerLine);
  opts.rowsPerPage = clampOption(raw.rowsPerPage, LIMITS.rowsPerPage, DEFAULT_OPTIONS.rowsPerPage);
  if (opts.traceCount + opts.blankCount < 1) opts.blankCount = 1;
  return opts;
}

function sanitizeText(raw) {
  if (typeof raw !== 'string') return '';
  const capped = raw.replace(/\s+/g, ' ').trim().slice(0, LIMITS.maxTextLength);
  // 按词数截断后重组，保证不会把一个单词切一半
  return capped.split(' ').filter(Boolean).slice(0, LIMITS.maxWords).join(' ');
}

function applyCase(text, letterCase) {
  if (letterCase === 'upper') return text.toUpperCase();
  if (letterCase === 'lower') return text.toLowerCase();
  return text;
}

/** 按单词贪心折行；超长单词硬切分。返回「字符数组」的数组。 */
function wrapLines(text, cellsPerLine) {
  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let current = [];

  for (const word of words) {
    let letters = Array.from(word);
    while (letters.length > cellsPerLine) {
      if (current.length) {
        lines.push(current);
        current = [];
      }
      lines.push(letters.slice(0, cellsPerLine));
      letters = letters.slice(cellsPerLine);
    }
    const needed = current.length ? current.length + 1 + letters.length : letters.length;
    if (current.length && needed > cellsPerLine) {
      lines.push(current);
      current = letters.slice();
    } else {
      if (current.length) current.push(' ');
      current = current.concat(letters);
    }
  }
  if (current.length) lines.push(current);
  return lines;
}

function makeRow(lineChars, style) {
  return {
    style,
    text: lineChars.join(''),
    cells: lineChars.map((char) => ({ char })),
  };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * 抄写模式：每个单词一组，组内「描红 × traceCount + 空白练习 × blankCount」依次排列，
 * 字符流（含单词间空格占一格）按 cellsPerLine 折行，格子带独立 style（trace/blank/gap）。
 */
function buildCopyCells(words, opts) {
  const cells = [];
  const pushWord = (word, style) => {
    Array.from(word).forEach((ch) => cells.push({ char: ch, style }));
    cells.push({ char: ' ', style: 'gap' }); // 单词间隔
  };
  words.forEach((word) => {
    for (let t = 0; t < opts.traceCount; t += 1) pushWord(word, 'trace');
    for (let b = 0; b < opts.blankCount; b += 1) pushWord(word, 'blank');
  });
  if (cells.length && cells[cells.length - 1].char === ' ') cells.pop(); // 去掉行尾空格
  return cells;
}

/** 按词边界折行：单词不拆行，放不下就换行；超过整行宽度的超长词才硬切分 */
function wrapCells(cells, cellsPerLine) {
  // 按间隔格切成词组
  const groups = [];
  let cur = [];
  cells.forEach((c) => {
    if (c.style === 'gap') {
      if (cur.length) groups.push(cur);
      cur = [];
    } else {
      cur.push(c);
    }
  });
  if (cur.length) groups.push(cur);

  const rows = [];
  let line = [];
  const flush = () => {
    if (line.length) rows.push({ cells: line });
    line = [];
  };
  groups.forEach((g) => {
    if (g.length > cellsPerLine) {
      flush();
      for (let i = 0; i < g.length; i += cellsPerLine) rows.push({ cells: g.slice(i, i + cellsPerLine) });
      return;
    }
    if (line.length && line.length + 1 + g.length > cellsPerLine) {
      flush();
      line.push(...g);
    } else {
      if (line.length) line.push({ char: ' ', style: 'gap' });
      line.push(...g);
    }
  });
  flush();
  return rows;
}

function buildEnglishSheet({ title, text, options }) {
  const opts = normalizeOptions(options);
  const clean = applyCase(sanitizeText(text), opts.letterCase);
  const words = clean.split(' ').filter(Boolean);
  // 默写按短语还原（"gingerbred house" 等不能拆成两个词）
  const dictWords = opts.mode === 'dictation' ? mergePhrases(words) : words;

  const rows = [];
  let wordBank = null;
  let dictationNote = '';
  const wordHints = {};
  dictWords.forEach((w) => {
    const zh = lookupZh(w);
    if (zh) wordHints[w] = zh;
  });

  if (opts.mode === 'dictation') {
    // 默写帖：每词「提示行（前者）+ N 条空白书写行（写后者）」
    //   zh2en 中译英：行首给中文释义，四线格里默英文
    //   en2zh 英译汉：行首给英文单词，方格里默中文
    // 中译英依赖中文释义：任一单词缺释义时（直接提示英文会泄露答案）
    // 整卷自动降级为英译汉，并在返回里说明原因
    if (opts.dictationDir === 'zh2en' && dictWords.some((w) => !lookupZh(w))) {
      opts.dictationDir = 'en2zh';
      dictationNote = '部分单词暂无中文释义，本次已自动改为「英译汉」方向';
    }
    wordBank = dictWords;
    const perWordBlank = Math.max(1, opts.blankCount);
    const en2zh = opts.dictationDir === 'en2zh';
    dictWords.forEach((word, i) => {
      const zh = lookupZh(word);
      let hint;
      if (en2zh) {
        hint = `${i + 1}. ${word}`;
      } else if (zh) {
        // 释义可带词性前缀（"n. 苹果"）也可不带（"苹果"，2024 新版词表）；
        // 无词性时不输出空的括注
        const pos = (zh.match(/^[a-z]+\./) || [''])[0];
        const body = zh.replace(/^[a-z]+\.\s*/, '');
        hint = pos ? `${i + 1}. ${body}（${pos}）` : `${i + 1}. ${body}`;
      } else {
        hint = `${i + 1}. ${word}`;
      }
      rows.push({ kind: 'hint', text: hint });
      if (en2zh) {
        // 写中文：每条一行 4 个方格
        for (let b = 0; b < perWordBlank; b += 1) rows.push({ kind: 'fang', count: 4 });
      } else {
        // 写英文：四线格空白行，格宽与单词长度一致（最少 6 格）
        const width = Math.max(6, Array.from(word).length + 1);
        for (let b = 0; b < perWordBlank; b += 1) rows.push({ kind: 'erow', width, cells: Array.from({ length: width }, () => ({ char: ' ', style: 'blank' })) });
      }
    });
  } else {
    rows.push(...wrapCells(buildCopyCells(words, opts), opts.cellsPerLine));
  }

  const pages = chunk(rows, opts.rowsPerPage).map((pageRows, index) => ({
    number: index + 1,
    rows: pageRows,
  }));

  const sheet = {
    type: 'english',
    title,
    options: opts,
    charCount: Array.from(clean.replace(/ /g, '')).length,
    pages,
  };
  if (wordBank) sheet.wordBank = wordBank;
  if (Object.keys(wordHints).length) sheet.wordHints = wordHints;
  if (dictationNote) sheet.dictationNote = dictationNote;
  return sheet;
}

module.exports = { buildEnglishSheet, DEFAULT_OPTIONS };
