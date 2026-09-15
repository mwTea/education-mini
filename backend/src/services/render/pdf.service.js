'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const fontkit = require('fontkit');

const { HttpError } = require('../../utils/http-error');
const { PALETTE } = require('./html.service');
const hanziService = require('../hanzi.service');
const { clockGeometry } = require('../layout/clock');

/**
 * layout JSON → A4 PDF（与 html.service 同一套尺寸算法）。
 *
 * 文字全部按「字形轮廓矢量路径」绘制，不内嵌字体：
 * 微信内置 PDF 查看器等移动端渲染器对 pdfkit 的子集字体兼容不佳，
 * 会整页回落成宋体（用户实测）；矢量路径在任何查看器中字形一致。
 *
 * 字形来源（均可免费商用；UKai 随文件附 Arphic 公共许可证，允许内嵌再分发）：
 *   kai    正楷 —— AR PL UKai CN 文鼎楷体（传统教材楷体风格）
 *   xingkai 行楷 —— 演示夏行楷（OFL，maoken-fonts/slidefont）
 * 行楷缺字时按单字自动回退到正楷；正楷未安装时接口返回 503，
 * 打印 HTML 页仍是可用兜底。
 */

const FONT_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');
const FONT_FILES = {
  kai: 'UKai-CN.ttf',
  xingkai: 'Slidexiaxing-Regular.ttf',
  'english-hengshui': 'EduSABeginner-Regular.ttf',
  'english-print': 'NotoSans-Regular.ttf',
  'english-rounded': 'Nunito-Regular.ttf',
};

// 自定义字体覆盖：把有授权的字体放到 assets/fonts/custom-kai.ttf / custom-xingkai.ttf
// 即可替换内置开源字体（PDF 会内嵌该字体，打印页同步加载）
const FONT_OVERRIDES = {
  kai: 'custom-kai.ttf',
  xingkai: 'custom-xingkai.ttf',
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 24;
const CONTENT_W = A4.width - MARGIN * 2;

const fontCache = {};

function loadFont(key) {
  if (fontCache[key]) return fontCache[key];
  const override = FONT_OVERRIDES[key] ? path.join(FONT_DIR, FONT_OVERRIDES[key]) : null;
  const file = override && fs.existsSync(override)
    ? override
    : path.join(FONT_DIR, FONT_FILES[key]);
  if (!fs.existsSync(file)) {
    if (key !== 'kai') return loadFont('kai'); // 非基础字体缺失时静默回落正楷
    throw new HttpError(503, 'PDF 字体未安装：请先运行 backend/scripts/fetch-fonts.sh 下载开源楷体');
  }
  const fk = fontkit.openSync(file);
  fontCache[key] = {
    key,
    docName: `CB${key}`,
    path: file,
    ascender: fk.ascent / fk.unitsPerEm,
    fk,
    ink: new Map(),
  };
  return fontCache[key];
}

function loadEnglishFont(opts = {}) {
  const key = ['hengshui', 'print', 'rounded'].includes(opts.englishFont) ? opts.englishFont : 'hengshui';
  return loadFont(`english-${key}`);
}

function hasGlyph(font, ch) {
  try {
    return font.fk.hasGlyphForCodePoint(ch.codePointAt(0));
  } catch (e) {
    return false;
  }
}

/** 单字符「墨迹中心」相对基线的偏移（em），按 glyph bbox 精确计算 */
function inkCenterEm(font, ch) {
  if (font.ink.has(ch)) return font.ink.get(ch);
  let center = 0.35;
  try {
    const glyph = font.fk.layout(ch).glyphs[0];
    if (glyph && glyph.bbox && Number.isFinite(glyph.bbox.yMin) && Number.isFinite(glyph.bbox.yMax)) {
      center = ((glyph.bbox.yMax + glyph.bbox.yMin) / 2) / font.fk.unitsPerEm;
    }
  } catch (e) {
    // 度量失败时回落到汉字经验值
  }
  font.ink.set(ch, center);
  return center;
}

function line(doc, x1, y1, x2, y2, color, width, dashed) {
  doc.save();
  if (dashed) doc.dash(3, { space: 3 });
  else doc.undash();
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(width).strokeColor(color).stroke();
  doc.restore();
}

/** 单字符字形信息（轮廓路径 + 步进宽度），模块级缓存 */
const glyphCache = new Map();
function glyphInfo(font, ch) {
  const key = font.key + '\u0000' + ch;
  if (glyphCache.has(key)) return glyphCache.get(key);
  let info = null;
  try {
    const glyph = font.fk.layout(ch).glyphs[0];
    if (glyph && glyph.path) {
      info = {
        segs: parseSvgPath(glyph.path.toSVG()),
        advanceEm: (glyph.advanceWidth || font.fk.unitsPerEm) / font.fk.unitsPerEm,
      };
    }
  } catch (e) {
    info = null;
  }
  glyphCache.set(key, info);
  return info;
}

/**
 * 以字形轮廓路径绘制文字（基线定位，与原 pdfkit 文本方案逐参兼容）。
 * 水平居中沿用原 align:center 语义：按步进宽度总和居中，位置与旧版一致。
 */
function drawText(doc, font, str, x, baselineY, size, color, opts = {}) {
  const scale = size / font.fk.unitsPerEm;
  const infos = Array.from(String(str)).map((ch) => glyphInfo(font, ch));
  const total = infos.reduce((sum, g) => sum + (g ? g.advanceEm * size : size * 0.5), 0);
  let pen = opts.width && opts.align !== 'left' ? x + (opts.width - total) * (opts.align === 'right' ? 1 : 0.5) : x;
  doc.save();
  doc.fillColor(color);
  infos.forEach((g) => {
    if (g && g.segs.length) {
      const ox = pen;
      let started = false;
      g.segs.forEach((s) => {
        const px = (v) => ox + v * scale;
        const py = (v) => baselineY - v * scale;
        if (s.c === 'M') {
          doc.moveTo(px(s.x), py(s.y));
          started = true;
        } else if (s.c === 'L') doc.lineTo(px(s.x), py(s.y));
        else if (s.c === 'Q') doc.quadraticCurveTo(px(s.x1), py(s.y1), px(s.x), py(s.y));
        else if (s.c === 'C') doc.bezierCurveTo(px(s.x1), py(s.y1), px(s.x2), py(s.y2), px(s.x), py(s.y));
        else if (s.c === 'Z') doc.closePath();
      });
      if (started) doc.fill();
    }
    pen += (g ? g.advanceEm * size : size * 0.5);
  });
  doc.restore();
}

function drawHeader(doc, kai, sheet, pal) {
  const dateText = new Date(sheet.createdAt || Date.now()).toLocaleDateString('zh-CN');
  const isChinese = sheet.type === 'chinese';
  const opts = sheet.options || {};
  const typeText = isChinese
    ? `语文${sheet.subtype ? ' · ' + sheet.subtype : ''} · ${sheet.charCount} 字`
    : `英语${sheet.subtype ? ' · ' + sheet.subtype : sheet.wordBank ? ' · 默写帖' : ''} · ${sheet.charCount} 字符`;

  const isDictation = !isChinese && opts.practiceMode === 'zh2en';
  const headerTitle = isDictation
    ? (opts.exerciseType === 'sentence' ? '二、短语/句子' : '一、单词')
    : (sheet.title || '字帖练习');
  drawText(doc, kai, headerTitle, isDictation ? MARGIN : 0, MARGIN + 16, 16, '#2f2a26', { width: isDictation ? CONTENT_W / 2 : A4.width, align: isDictation ? 'left' : 'center' });
  if (!isDictation) drawText(doc, kai, `${typeText} · 共 ${sheet.pages.length} 页 · ${dateText}`, 0, MARGIN + 30, 8.5, '#8a929a', { width: A4.width, align: 'center' });

  // 姓名 / 班级 / 日期 填写栏
  const lineY = MARGIN + 50;
  const seg = CONTENT_W / 3;
  drawText(doc, kai, '班级：__________', MARGIN, lineY, 9, '#6b7280');
  drawText(doc, kai, '姓名：__________', MARGIN + seg, lineY, 9, '#6b7280', { width: seg, align: 'center' });
  drawText(doc, kai, '日期：__________', MARGIN + seg * 2, lineY, 9, '#6b7280');

  let y = lineY + 14;
  const hints = sheet.wordHints || {};
  const words = sheet.wordBank && sheet.wordBank.length ? sheet.wordBank : Object.keys(hints);
  if (words.length) {
    const label = sheet.wordBank ? '报词栏' : '词义栏';
    const bankText = `${label}：${words.map((w) => (hints[w] ? `${w} ${hints[w]}` : w)).join('  /  ')}`;
    doc.save();
    doc.dash(3, { space: 2 });
    doc.roundedRect(MARGIN, y, CONTENT_W, 20, 3).lineWidth(1).strokeColor(pal.border).stroke();
    doc.restore();
    drawText(doc, kai, bankText, MARGIN + 8, y + 13, 8.5, '#6b7280');
    y += 26;
  }
  if (sheet.dictationNote) {
    drawText(doc, kai, sheet.dictationNote, 0, y, 8, '#c07f4e', { width: A4.width, align: 'center' });
    y += 12;
  }
  return y;
}

/** 解析 MMTH 的 SVG 路径（绝对坐标 M/L/Q/C/Z 命令） */
function parseSvgPath(d) {
  const tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g) || [];
  const segs = [];
  let cmd = null;
  let nums = [];
  const flush = () => {
    if (!cmd) return;
    if (cmd === 'M' || cmd === 'L') segs.push({ c: cmd, x: +nums[0], y: +nums[1] });
    else if (cmd === 'Q') segs.push({ c: cmd, x1: +nums[0], y1: +nums[1], x: +nums[2], y: +nums[3] });
    else if (cmd === 'C') segs.push({ c: cmd, x1: +nums[0], y1: +nums[1], x2: +nums[2], y2: +nums[3], x: +nums[4], y: +nums[5] });
    else if (cmd === 'Z') segs.push({ c: 'Z' });
    nums = [];
  };
  for (const t of tokens) {
    if (/[A-Z]/.test(t)) {
      flush();
      cmd = t;
    } else {
      nums.push(t);
    }
  }
  flush();
  return segs;
}

/** 在 (cellX, cellY) 边长 size 的方块里画一笔（MMTH 坐标系：y 翻转，基面 1024×900） */
function drawStrokePath(doc, d, cellX, cellY, size, color) {
  const segs = parseSvgPath(d);
  if (!segs.length) return;
  const px = (v) => cellX + (v * size) / 1024;
  const py = (v) => cellY + ((900 - v) * size) / 1024;

  doc.save();
  doc.fillColor(color);
  let started = false;
  segs.forEach((s) => {
    if (s.c === 'M') {
      doc.moveTo(px(s.x), py(s.y));
      started = true;
    } else if (s.c === 'L') doc.lineTo(px(s.x), py(s.y));
    else if (s.c === 'Q') doc.quadraticCurveTo(px(s.x1), py(s.y1), px(s.x), py(s.y));
    else if (s.c === 'C') doc.bezierCurveTo(px(s.x1), py(s.y1), px(s.x2), py(s.y2), px(s.x), py(s.y));
    else if (s.c === 'Z') doc.closePath();
  });
  if (started) doc.fill();
  doc.restore();
}

/** 单个田字格/米字格/方格（含范字/描红），卡片与普通练习行共用 */
function drawCell(doc, kai, cellFont, cellData, x, y, cell, opts, pal, charFactor) {
  doc.save();
  doc.lineWidth(1.1).strokeColor(pal.border);
  doc.rect(x, y, cell, cell).stroke();
  doc.restore();

  if (opts.grid !== 'fang') {
    line(doc, x + cell / 2, y, x + cell / 2, y + cell, pal.guide, 0.8, true);
    line(doc, x, y + cell / 2, x + cell, y + cell / 2, pal.guide, 0.8, true);
  }
  if (opts.grid === 'mi') {
    line(doc, x, y, x + cell, y + cell, pal.guide, 0.8, true);
    line(doc, x, y + cell, x + cell, y, pal.guide, 0.8, true);
  }

  if (cellData.style !== 'blank') {
    const color = cellData.style === 'demo' ? pal.demo : pal.trace;
    const font = (cellFont === kai || hasGlyph(cellFont, cellData.char)) ? cellFont : kai;
    const factor = charFactor || (cellFont.key === 'xingkai' ? 0.64 : 0.7);
    const charSize = cell * factor;
    const baseline = y + cell / 2 + inkCenterEm(font, cellData.char) * charSize;
    drawText(doc, font, cellData.char, x, baseline, charSize, color, { width: cell });
  }
}

/** 生字卡片：红框整卡（顶栏拼音+笔顺条 / 左栏大范字+标签 / 右区组词+两行描红） */
function drawCard(doc, kai, card, opts, pal, cellFont, startY) {
  const pad = 6;
  const W = CONTENT_W;
  const topH = 40;
  const pyW = 64;
  const leftW = 88;
  const demoH = 88;
  const labH = 17;
  const labGap = 4;
  const leftH = demoH + 3 * (labH + labGap);
  const rightX = MARGIN + pad + leftW + 6;
  const rightW = W - pad * 2 - leftW - 6;
  const cellR = Math.min(36, rightW / (card.practiceRows[0] ? card.practiceRows[0].cells.length : 12));
  // 右栏：描红行 + 组词行 + 两行空白格（组词练习），利用左栏下方空间，卡片几乎不增高
  const rightH = card.practiceRows.length * (cellR + 5) + 14 + card.wordRows.length * (cellR + 5) - 5;
  const bodyH = Math.max(leftH, rightH);
  const cardH = pad * 2 + topH + 6 + bodyH;
  const top = startY;

  // 外框
  doc.save();
  doc.lineWidth(1.4).strokeColor(pal.frame);
  doc.roundedRect(MARGIN, top, W, cardH, 3).stroke();
  doc.restore();

  // 顶栏：拼音格
  const pyX = MARGIN + pad;
  const pyY = top + pad;
  doc.save();
  doc.lineWidth(0.9).strokeColor(pal.frame);
  doc.rect(pyX, pyY, pyW, topH).stroke();
  doc.restore();
  const pySize = 20;
  drawText(doc, kai, card.pinyin || card.char, pyX, pyY + topH / 2 + inkCenterEm(kai, (card.pinyin || card.char)[0]) * pySize, pySize, '#2f2a26', { width: pyW });

  // 顶栏：笔顺演示长条（已完成笔深色，最新一笔红色）
  const stX = pyX + pyW + 6;
  const stW = W - pad * 2 - pyW - 6;
  doc.save();
  doc.lineWidth(0.9).strokeColor(pal.frame);
  doc.rect(stX, pyY, stW, topH).stroke();
  doc.restore();
  const paths = hanziService.strokePaths(card.char);
  if (paths && paths.length) {
    const cellS = Math.min(26, (stW - 10) / paths.length, topH - 8);
    const offY = pyY + (topH - cellS) / 2;
    paths.forEach((_, k) => {
      const x = stX + 5 + k * cellS;
      paths.slice(0, k + 1).forEach((d, j) => {
        drawStrokePath(doc, d, x, offY, cellS, j === k ? '#d95f52' : '#3f3a34');
      });
    });
  }

  // 左栏：大范字 + 笔画/部首/结构标签
  const bodyY = pyY + topH + 6;
  drawCell(doc, kai, cellFont, { char: card.char, style: 'demo' }, MARGIN + pad, bodyY, demoH, opts, pal, 0.6);
  const meta = card.meta || {};
  const labels = [];
  if (meta.strokes) labels.push(`笔画 ${meta.strokes} 画`);
  if (meta.radical) labels.push(`部首 ${meta.radical}`);
  if (meta.structure) labels.push(meta.structure);
  labels.forEach((text, i) => {
    const ly = bodyY + demoH + labGap + i * (labH + labGap);
    doc.save();
    doc.lineWidth(0.9).strokeColor(pal.frame);
    doc.rect(MARGIN + pad, ly, leftW, labH).stroke();
    doc.restore();
    drawText(doc, kai, text, MARGIN + pad + 5, ly + labH / 2 + 3, 8, '#3a2e25');
  });

  // 右栏：两行描红 + 组词行 + 两行空白格
  card.practiceRows.forEach((prow, r) => {
    const yRow = bodyY + r * (cellR + 5);
    prow.cells.forEach((c, i) => {
      drawCell(doc, kai, cellFont, c, rightX + i * cellR, yRow, cellR, opts, pal);
    });
  });
  let rightCursor = bodyY + card.practiceRows.length * (cellR + 5);
  if (card.words && card.words.length) {
    drawText(doc, kai, `组词  ${card.words.join('  ')}`, rightX, rightCursor + 9, 9, '#6b5f51', { width: rightW, align: 'right' });
  }
  rightCursor += 14;
  card.wordRows.forEach((wrow, r) => {
    const yRow = rightCursor + r * (cellR + 5);
    wrow.cells.forEach((c, i) => {
      drawCell(doc, kai, cellFont, c, rightX + i * cellR, yRow, cellR, opts, pal);
    });
  });

  return top + cardH + 22; // 下一张卡的起始 y（含卡间距）
}

function drawChinesePage(doc, kai, page, opts, pal, startY) {
  const cell = CONTENT_W / (opts.charsPerRow || 10);
  const pinyinH = opts.showPinyin ? cell * 0.34 : 0;
  const charSize = cell * (opts.font === 'xingkai' ? 0.64 : 0.7);
  const rowGap = cell * 0.14;
  let y = startY;

  const cellFont = opts.font === 'xingkai' ? loadFont('xingkai') : kai;

  page.rows.forEach((row) => {
    if (row.kind === 'card') {
      y = drawCard(doc, kai, row, opts, pal, cellFont, y);
      return;
    }

    const cellTop = y + pinyinH;
    row.cells.forEach((cellData, i) => {
      const x = MARGIN + i * cell;

      if (opts.showPinyin && cellData.pinyin) {
        // 拼音完整绘制，条内垂直居中（按墨迹中心），始终用正楷
        const pySize = cell * 0.24;
        drawText(doc, kai, cellData.pinyin, x, y + pinyinH / 2 + inkCenterEm(kai, cellData.pinyin[0]) * pySize, pySize, '#9a7b6b', { width: cell });
      }

      doc.save();
      doc.lineWidth(1.1).strokeColor(pal.border);
      doc.rect(x, cellTop, cell, cell).stroke();
      doc.restore();

      if (opts.grid !== 'fang') {
        line(doc, x + cell / 2, cellTop, x + cell / 2, cellTop + cell, pal.guide, 0.8, true);
        line(doc, x, cellTop + cell / 2, x + cell, cellTop + cell / 2, pal.guide, 0.8, true);
      }
      if (opts.grid === 'mi') {
        line(doc, x, cellTop, x + cell, cellTop + cell, pal.guide, 0.8, true);
        line(doc, x, cellTop + cell, x + cell, cellTop, pal.guide, 0.8, true);
      }

      if (cellData.style !== 'blank') {
        const color = cellData.style === 'demo' ? pal.demo : pal.trace;
        // 行楷缺字时按单字回退正楷
        const font = (cellFont === kai || hasGlyph(cellFont, cellData.char)) ? cellFont : kai;
        const baseline = cellTop + cell / 2 + inkCenterEm(font, cellData.char) * charSize;
        drawText(doc, font, cellData.char, x, baseline, charSize, color, { width: cell });
      }
    });
    y += pinyinH + cell + rowGap;
  });
}

function drawEnglishFourLine(doc, x, top, width, height, pal) {
  const unit = height / 3;
  line(doc, x, top, x + width, top, pal.line, 0.65, false);
  line(doc, x, top + unit, x + width, top + unit, pal.lineDashed, 0.55, true);
  line(doc, x, top + unit * 2, x + width, top + unit * 2, pal.line, 0.65, false);
  line(doc, x, top + height, x + width, top + height, pal.line, 0.65, false);
}

function drawEnglishPage(doc, kai, page, opts, pal, startY) {
  const writingFont = loadEnglishFont(opts);
  const advance = CONTENT_W / (opts.cellsPerLine || 24);
  const font = advance / 0.62;
  const u = font * 0.52;
  const rowH = u * 3;
  const rowGap = u * 0.9;
  let y = startY;

  if (page.rows.length && page.rows.every((row) => row.kind === 'word-dictation')) {
    const columns = 4;
    const gapX = 18;
    const colW = (CONTENT_W - gapX * (columns - 1)) / columns;
    const cardH = 94;
    page.rows.forEach((row, index) => {
      const col = index % columns;
      const lineNo = Math.floor(index / columns);
      const x = MARGIN + col * (colW + gapX);
      const top = startY + lineNo * cardH;
      drawText(doc, kai, row.meaning, x, top + 14, 10, '#374151', { width: colW, align: 'left' });
      const count = row.lineCount || 1;
      for (let n = 0; n < count; n += 1) {
        drawEnglishFourLine(doc, x, top + 26 + n * 20, colW, 16, pal);
      }
    });
    return;
  }

  if (page.rows.length && page.rows.every((row) => row.kind === 'sentence-dictation')) {
    page.rows.forEach((row, index) => {
      const top = startY + index * 142;
      drawText(doc, kai, `${row.no}. ${row.translation}`, MARGIN, top + 14, 10.5, '#30343b', { width: CONTENT_W, align: 'left' });
      const count = row.lineCount || 1;
      for (let n = 0; n < count; n += 1) {
        drawEnglishFourLine(doc, MARGIN, top + 31 + n * 29, CONTENT_W, 23, pal);
      }
    });
    return;
  }

  page.rows.forEach((row) => {
    if (row.kind === 'word-copy') {
      const bandH = 36;
      const unitH = bandH / 3;
      line(doc, MARGIN, y, MARGIN + CONTENT_W, y, pal.line, 0.9, false);
      line(doc, MARGIN, y + unitH, MARGIN + CONTENT_W, y + unitH, pal.lineDashed, 0.75, true);
      line(doc, MARGIN, y + unitH * 2, MARGIN + CONTENT_W, y + unitH * 2, pal.line, 0.9, false);
      line(doc, MARGIN, y + bandH, MARGIN + CONTENT_W, y + bandH, pal.line, 0.9, false);
      const slots = row.repeatCount || 6;
      const slotW = CONTENT_W / slots;
      const size = 25;
      for (let n = 0; n < slots; n += 1) {
        drawText(doc, writingFont, row.word, MARGIN + n * slotW + 2, y + unitH * 2, size, n === 0 ? '#24332e' : pal.trace, { width: slotW - 4, align: 'left' });
      }
      const info = [row.meaning ? `释义：${row.meaning}` : '', ...(row.details || [])].filter(Boolean).join('   ');
      if (info) drawText(doc, kai, info, MARGIN + 6, y + 52, 8.7, '#4b5563', { width: CONTENT_W - 12, align: 'left' });
      line(doc, MARGIN, y + 60, MARGIN + CONTENT_W, y + 60, pal.line, 0.65, false);
      y += 68;
      return;
    }
    if (row.kind === 'word-meaning') {
      const promptW = 150;
      const gap = 18;
      const writingX = MARGIN + promptW + gap;
      const writingW = CONTENT_W - promptW - gap;
      const lineCount = row.lineCount || 1;
      const groupH = Math.max(58, lineCount * 34);

      doc.save();
      doc.roundedRect(MARGIN, y, promptW, groupH, 5).fill('#f7faf8');
      doc.restore();
      drawText(doc, writingFont, `${row.no}. ${row.word}`, MARGIN + 9, y + 24, 14, '#263b59', { width: promptW - 18, align: 'left' });
      drawText(doc, kai, '写出中文释义', MARGIN + 9, y + 44, 8.5, '#64748b', { width: promptW - 18, align: 'left' });
      for (let index = 0; index < lineCount; index += 1) {
        const lineY = y + 28 + index * 34;
        line(doc, writingX, lineY, writingX + writingW, lineY, pal.line, 0.9, false);
      }
      y += groupH + 14;
      return;
    }
    // 默写提示行
    if (row.kind === 'hint') {
      drawText(doc, kai, row.text, MARGIN, y + 11, 10, '#3a2e25');
      y += 16;
      return;
    }
    // 英译汉：方格书写行（写中文）
    if (row.kind === 'fang') {
      const size = rowH;
      const count = row.count || 4;
      for (let i = 0; i < count; i += 1) {
        doc.save();
        doc.lineWidth(1.1).strokeColor(pal.border);
        doc.rect(MARGIN + i * (size + 4), y, size, size).stroke();
        doc.restore();
      }
      y += size + 8;
      return;
    }
    if (row.kind === 'unscramble') {
      drawText(doc, kai, `${row.no}.`, MARGIN, y + 13, 10, '#334155');
      let x = MARGIN + 20;
      (row.tokens || []).forEach((token) => {
        const boxW = Math.max(30, Math.min(110, Array.from(token).length * 7 + 15));
        if (x + boxW > MARGIN + CONTENT_W) {
          x = MARGIN + 20;
          y += 28;
        }
        doc.save();
        doc.roundedRect(x, y, boxW, 22, 4).lineWidth(0.8).strokeColor(pal.border).stroke();
        doc.restore();
        drawText(doc, writingFont, token, x, y + 15, 9.5, '#334155', { width: boxW, align: 'center' });
        x += boxW + 7;
      });
      if (row.punctuation) drawText(doc, writingFont, row.punctuation, x, y + 15, 10, '#334155');
      y += 29;
      if (row.translation) {
        drawText(doc, kai, row.translation, MARGIN + 20, y + 10, 8.5, '#64748b');
        y += 15;
      }
      return;
    }
    // 默写的四线格按单词宽度收窄
    const gridW = row.kind === 'erow' && row.width ? advance * row.width : CONTENT_W;
    line(doc, MARGIN, y, MARGIN + gridW, y, pal.line, 1, false);
    line(doc, MARGIN, y + u, MARGIN + gridW, y + u, pal.lineDashed, 1, true);
    line(doc, MARGIN, y + u * 2, MARGIN + gridW, y + u * 2, pal.line, 1, false);
    line(doc, MARGIN, y + u * 3, MARGIN + gridW, y + u * 3, pal.line, 1, false);

    (row.cells || []).forEach((cell, i) => {
      if (cell.style !== 'trace') return; // 描红浅色字；空白/间隔格不绘制
      drawText(doc, writingFont, cell.char, MARGIN + i * advance, y + u * 2, font, pal.trace);
    });
    y += rowH + rowGap;
  });
}


/** 数学口算页：口算三列（列间淡虚线）/ 竖式计算框 / 应用题留白 / 答案页四列 */

/** 数学卷信息栏：姓名 / 日期 / 用时 / 得分（口算卡标配） */
function drawMathHeader(doc, kai, sheet) {
  drawText(doc, kai, sheet.title || '数学口算练习', 0, MARGIN + 16, 16, '#2f2a26', { width: A4.width, align: 'center' });
  const lineY = MARGIN + 46;
  const seg = CONTENT_W / 4;
  drawText(doc, kai, '姓名：______', MARGIN, lineY, 9.5, '#6b7280');
  drawText(doc, kai, '日期：______', MARGIN + seg, lineY, 9.5, '#6b7280');
  drawText(doc, kai, '用时：______', MARGIN + seg * 2, lineY, 9.5, '#6b7280');
  drawText(doc, kai, '得分：______', MARGIN + seg * 3, lineY, 9.5, '#6b7280');
  return lineY + 16;
}

function wrapText(font, text, size, width) {
  const lines = [];
  let current = '', used = 0;
  for (const ch of Array.from(text)) {
    const glyph = glyphInfo(font, ch);
    const advance = (glyph ? glyph.advanceEm : 0.5) * size;
    if (current && used + advance > width) { lines.push(current); current = ''; used = 0; }
    current += ch; used += advance;
  }
  if (current) lines.push(current);
  return lines;
}

function drawMathPage(doc, kai, page, opts, startY) {
  let y = startY;
  page.rows.forEach((row) => {
    if (row.kind === 'section') {
      drawText(doc, kai, row.text, MARGIN, y + 16, 12, '#222');
      y += (row.heightMm || 9) * 72 / 25.4;
    } else if (row.kind === 'clock') {
      const colW = CONTENT_W / (row.columns || 4);
      row.items.forEach((item, i) => {
        const x = MARGIN + i * colW;
        drawText(doc, kai, `${item.clock.blank ? item.answer : '写出时间'}`, x, y + 12, 9, '#222');
        const g = clockGeometry(item.clock), ox = x + 4, oy = y + 18;
        doc.save();
        doc.circle(ox + 60, oy + 60, 54).lineWidth(1).strokeColor('#222').stroke();
        g.ticks.forEach((t) => line(doc, ox + t.from.x, oy + t.from.y, ox + t.to.x, oy + t.to.y, '#333', 0.5));
        g.numbers.forEach((n) => drawText(doc, kai, n.text, ox + n.x - 8, oy + n.y + 3, 10, '#222', { width: 16 }));
        if (!item.clock.blank) {
          line(doc, ox + 60, oy + 60, ox + g.hour.x, oy + g.hour.y, '#222', 2.5);
          line(doc, ox + 60, oy + 60, ox + g.minute.x, oy + g.minute.y, '#222', 1.3);
        }
        doc.circle(ox + 60, oy + 60, 2).fill('#222');
        doc.restore();
        if (!item.clock.blank) drawText(doc, kai, '时间：________', x + 4, y + 144, 10, '#222');
      });
      y += (row.heightMm || 52) * 72 / 25.4;
    } else if (row.kind === 'inline') {
      const cols = row.columns || 3;
      const colW = CONTENT_W / cols;
      const rowH = 25.5; // 与布局 9mm 一致（含列内行距）
      row.items.forEach((item, i) => {
        const x = MARGIN + (i % cols) * colW;
        const iy = y + Math.floor(i / cols) * rowH + 16;
        drawText(doc, kai, item.stem, x, iy, cols === 4 ? 11 : 12, '#2f2a26');
      });
      y += row.heightMm ? row.heightMm * 72 / 25.4 : rowH;
    } else if (row.kind === 'vertical') {
      // 竖式题：横式出题 + 留白，孩子自己列竖式
      row.items.forEach((item, i) => {
        const x = MARGIN + (i % 2) * (CONTENT_W / 2);
        drawText(doc, kai, item.stem, x, y + 16, 13, '#2f2a26');
      });
      y += row.heightMm ? row.heightMm * 72 / 25.4 : 85;
    } else if (row.kind === 'word') {
      row.items.forEach((item) => {
        const lines = wrapText(kai, item.stem, 11, CONTENT_W);
        lines.forEach((s, i) => drawText(doc, kai, s, MARGIN, y + 14 + i * 17, 11, '#2f2a26'));
        const h = Math.max((row.heightMm || 42) * 72 / 25.4, lines.length * 17 + 65);
        line(doc, MARGIN, y + h - 12, MARGIN + CONTENT_W, y + h - 12, '#bbb', 0.5, true);
        y += h;
      });
    } else if (row.kind === 'answer') {
      const cols = 4;
      const colW = CONTENT_W / cols;
      const rowH = 18;
      row.items.forEach((item, i) => {
        const x = MARGIN + (i % cols) * colW;
        const iy = y + Math.floor(i / cols) * rowH + 12;
        drawText(doc, kai, `${item.no}. ${item.answer}`, x, iy, 10, '#3a2e25');
      });
      y += Math.ceil(row.items.length / cols) * rowH + 8;
    }
  });
  return y;
}

function sheetToPdfBuffer(sheet) {
  const kai = loadFont('kai'); // 缺正楷时在此抛 503
  const opts = sheet.options || {};
  const pal = PALETTE[opts.paper] || PALETTE.classic;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      sheet.pages.forEach((page, index) => {
        if (index > 0) doc.addPage();
        // 纸张底色（pdfkit 页面默认透明，不填色部分查看器会显示为黑）
        doc.save();
        doc.rect(0, 0, A4.width, A4.height).fill('#ffffff');
        doc.restore();
        const startY = sheet.type === 'math'
          ? drawMathHeader(doc, kai, sheet)
          : (sheet.type === 'english' || index === 0 ? drawHeader(doc, kai, sheet, pal) : MARGIN + 8);
        if (sheet.type === 'math') drawMathPage(doc, kai, page, opts, startY);
        else if (sheet.type === 'chinese') drawChinesePage(doc, kai, page, opts, pal, startY);
        else drawEnglishPage(doc, kai, page, opts, pal, startY);
        drawText(doc, kai, `- ${page.number} -`, 0, A4.height - 18, 8.5, '#9aa0a6', { width: A4.width, align: 'center' });
      });

      if (sheet.type === 'math' && sheet.answerPage) {
        doc.addPage();
        doc.save();
        doc.rect(0, 0, A4.width, A4.height).fill('#ffffff');
        doc.restore();
        drawText(doc, kai, `${sheet.title} · 答案页`, 0, MARGIN + 14, 13, '#2f2a26', { width: A4.width, align: 'center' });
        drawMathPage(doc, kai, sheet.answerPage, opts, MARGIN + 34);
      }

      if (sheet.type === 'english' && sheet.answerPage) {
        const writingFont = loadEnglishFont(opts);
        doc.addPage();
        doc.save();
        doc.rect(0, 0, A4.width, A4.height).fill('#ffffff');
        doc.restore();
        drawText(doc, kai, `${sheet.title} · 答案页`, 0, MARGIN + 14, 13, '#2f2a26', { width: A4.width, align: 'center' });
        let answerY = MARGIN + 42;
        sheet.answerPage.rows.flatMap((row) => row.items || []).forEach((item) => {
          const lines = wrapText(writingFont, `${item.no}. ${item.answer}`, 10, CONTENT_W);
          lines.forEach((text, index) => drawText(doc, writingFont, text, MARGIN, answerY + index * 16, 10, '#334155'));
          answerY += Math.max(24, lines.length * 16 + 8);
        });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  sheetToPdfBuffer,
  // 静态资源生成脚本（scripts/build-radicals.js）复用的绘制原语
  internals: { loadFont, loadEnglishFont, drawText, line, A4, MARGIN, CONTENT_W },
};
