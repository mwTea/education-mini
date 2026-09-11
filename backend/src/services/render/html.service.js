'use strict';

const fs = require('fs');
const path = require('path');

const escapeHtml = require('../../utils/escape-html');
const hanziService = require('../hanzi.service');

/**
 * layout JSON → A4 可打印 HTML。
 * 小程序端组件（sheet-view）用同一份 layout JSON 自行渲染预览，
 * 两端尺寸算法保持一致：格子宽 = 内容宽 / 每行格数。
 *
 * paper 配色：
 *   classic 仿真纸 —— 绿格线、黑范字、红描红（贴近纸质教辅）
 *   plain   素雅   —— 灰格线、浅灰描红
 */

// A4 210mm - 页边 8mm×2 - 页内边距 6mm×2
const CONTENT_MM = 182;

const FONT_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');

function hasCustom(key) {
  return fs.existsSync(path.join(FONT_DIR, `custom-${key}.ttf`));
}

// 打印页默认用系统楷体（观感更接近标准印刷楷体）；仅行楷模式或放置了自定义字体时才内嵌
const FONT_STACKS = {
  kai: `${hasCustom('kai') ? '"CBKai", ' : ''}"Kaiti SC", "STKaiti", KaiTi, "LXGW WenKai", "Noto Serif CJK SC", serif`,
  xingkai: `"CBXing", "STXingkai", "Xingkai SC", Xingkai, KaiTi, serif`,
};

const PALETTE = {
  classic: {
    frame: '#d95f52', // 生字卡片红框
    border: '#5b9e7d',
    guide: '#a8cbb6',
    demo: '#2f2a26',
    trace: '#f09892',
    line: '#5b9e7d',
    lineDashed: '#a8cbb6',
  },
  plain: {
    frame: '#7f878e',
    border: '#7f878e',
    guide: '#c3cad1',
    demo: '#2b3137',
    trace: '#c9d0d7',
    line: '#7f878e',
    lineDashed: '#c3cad1',
  },
};

function round2(n) {
  return Math.round(n * 100) / 100;
}

function chineseMetrics(opts) {
  const perRow = opts.charsPerRow || 10;
  const cellMm = round2(CONTENT_MM / perRow);
  return {
    cellMm,
    charMm: round2(cellMm * (opts.font === 'xingkai' ? 0.64 : 0.7)),
    pinyinMm: round2(cellMm * 0.24),
    pinyinH: round2(cellMm * 0.34),
  };
}

/** 笔顺演示长条：逐笔累加的小字（已完成笔深色，最新一笔红色） */
function strokeStripHtml(char) {
  const paths = hanziService.strokePaths(char);
  if (!paths || !paths.length) return '';
  const cells = paths.map((_, k) => {
    const inner = paths.slice(0, k + 1)
      .map((d, j) => `<path d="${d}"${j === k ? ' class="cur"' : ''}/>`)
      .join('');
    return `<svg class="stg" viewBox="0 0 1024 1024"><g transform="scale(1,-1) translate(0,-900)">${inner}</g></svg>`;
  }).join('');
  return cells;
}

function cellHtml(cell, m, opts, sizeClass) {
  const guides = opts.grid === 'fang'
    ? ''
    : '<i class="gl-v"></i><i class="gl-h"></i>';
  const diagonals = opts.grid === 'mi' ? '<i class="gl-d d1"></i><i class="gl-d d2"></i>' : '';
  const char = cell.style === 'blank'
    ? ''
    : `<span class="char ${cell.style} ${sizeClass}" style="font-size:${sizeClass === 'cb-ch' ? '8.2mm' : m.charMm + 'mm'}">${escapeHtml(cell.char)}</span>`;
  return (
    `<div class="cwrap ${sizeClass === 'cb-ch' ? 'cb-cw' : ''}">` +
    `<div class="cell ${opts.grid} ${sizeClass}">${guides}${diagonals}${char}</div></div>`
  );
}

/** 生字卡片：红框整卡 = 顶栏（拼音格+笔顺条）+ 左栏（大范字+标签）+ 右区（组词+两行描红） */
function cardHtml(row, m, opts, pal) {
  const meta = row.meta || {};
  const labels = [];
  if (meta.strokes) labels.push(`<div class="cb-lab">笔画&nbsp;${meta.strokes}&nbsp;画</div>`);
  if (meta.radical) labels.push(`<div class="cb-lab">部首&nbsp;${escapeHtml(meta.radical)}</div>`);
  if (meta.structure) labels.push(`<div class="cb-lab">${escapeHtml(meta.structure)}</div>`);
  const rows = row.practiceRows
    .map((r) => `<div class="crow">${r.cells.map((c) => cellHtml(c, m, opts, 'cb-ch')).join('')}</div>`)
    .join('');
  const words = row.words && row.words.length
    ? `<div class="cb-words">组词&nbsp;&nbsp;${row.words.map((w) => escapeHtml(w)).join('&nbsp;&nbsp;')}</div>`
    : '';
  const wordRows = (row.wordRows || [])
    .map((r) => `<div class="crow">${r.cells.map((c) => cellHtml(c, m, opts, 'cb-ch')).join('')}</div>`)
    .join('');
  return (
    `<div class="cardbox" style="border-color:${pal.frame}">` +
    `<div class="cb-top">` +
    `<div class="cb-py">${escapeHtml(row.pinyin || row.char)}</div>` +
    `<div class="cb-strokes" style="border-color:${pal.frame}">${strokeStripHtml(row.char)}</div>` +
    `</div>` +
    `<div class="cb-body">` +
    `<div class="cb-left" style="border-color:${pal.frame}">` +
    `<div class="cb-demo"><i class="gl-v"></i><i class="gl-h"></i><span class="char demo" style="font-size:18mm">${escapeHtml(row.char)}</span></div>` +
    labels.join('') +
    `</div>` +
    `<div class="cb-right">${rows}${words}${wordRows}</div>` +
    `</div></div>`
  );
}

function chineseRowHtml(row, m, opts, pal) {
  if (row.kind === 'card') return cardHtml(row, m, opts, pal);
  const guides = opts.grid === 'fang'
    ? ''
    : '<i class="gl-v"></i><i class="gl-h"></i>';
  const diagonals = opts.grid === 'mi' ? '<i class="gl-d d1"></i><i class="gl-d d2"></i>' : '';

  const cells = row.cells.map((cell) => {
    const pinyin = opts.showPinyin
      ? `<div class="pinyin" style="height:${m.pinyinH}mm;font-size:${m.pinyinMm}mm;line-height:${m.pinyinH}mm">${escapeHtml(cell.pinyin || '')}</div>`
      : '';
    const char = cell.style === 'blank'
      ? ''
      : `<span class="char ${cell.style}" style="font-size:${m.charMm}mm">${escapeHtml(cell.char)}</span>`;
    return (
      `<div class="cwrap" style="width:${m.cellMm}mm">${pinyin}` +
      `<div class="cell ${opts.grid}" style="width:${m.cellMm}mm;height:${m.cellMm}mm">` +
      `${guides}${diagonals}${char}</div></div>`
    );
  }).join('');
  return `<div class="crow">${cells}</div>`;
}

function englishMetrics(opts) {
  const perLine = opts.cellsPerLine || 24;
  const advanceMm = round2(CONTENT_MM / perLine);
  const fontMm = round2(advanceMm / 0.62);
  const unitMm = round2(fontMm * 0.52);
  return {
    advanceMm,
    fontMm,
    unitMm,
    rowH: round2(unitMm * 3),
    gap: round2(unitMm * 0.9),
  };
}

function englishRowHtml(row, m, pal) {
  // 默写提示行（前者）
  if (row.kind === 'hint') {
    return `<div class="hrow">${escapeHtml(row.text)}</div>`;
  }
  // 英译汉：方格书写行（写中文）
  if (row.kind === 'fang') {
    const squares = Array.from({ length: row.count || 4 })
      .map(() => '<i class="fcell"></i>')
      .join('');
    return `<div class="fgrow">${squares}</div>`;
  }
  const cells = (row.cells || [])
    .map((cell) => `<span class="ecell ${cell.style}" style="width:${m.advanceMm}mm">${cell.char === ' ' ? '&nbsp;' : escapeHtml(cell.char)}</span>`)
    .join('');
  // 默写的四线格按单词宽度收窄
  const width = row.kind === 'erow' && row.width ? m.advanceMm * row.width : undefined;
  return (
    `<div class="erow" style="height:${m.rowH}mm;margin-bottom:${m.gap}mm;${width ? `width:${width}mm;` : ''}">` +
    '<i class="eline l1"></i><i class="eline l2"></i><i class="eline l3"></i><i class="eline l4"></i>' +
    `<div class="etext" style="font-size:${m.fontMm}mm">${cells}</div></div>`
  );
}

function css(pal, fontKey) {
  const faces = [];
  if (hasCustom('kai')) {
    faces.push(`@font-face { font-family: 'CBKai'; src: url('/assets/fonts/custom-kai.ttf') format('truetype'); font-display: swap; }`);
  }
  if (fontKey === 'xingkai') {
    const src = hasCustom('xingkai') ? '/assets/fonts/custom-xingkai.ttf' : '/assets/fonts/Slidexiaxing-Regular.ttf';
    faces.push(`@font-face { font-family: 'CBXing'; src: url('${src}') format('truetype'); font-display: swap; }`);
  }
  const fontFace = faces.length ? faces.join('\n') + '\n' : '';
  return `
${fontFace}* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #efe9df; color: #2b3137; font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; }
.toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid #e3e6ea;
  padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tb-title { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn { background: #f0821e; color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 14px; cursor: pointer; }
.tb-tip { color: #8a929a; font-size: 12px; }
.page { width: 194mm; min-height: 279mm; background: #ffffff; margin: 16px auto; padding: 6mm;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .08); }
.sheet-head { text-align: center; margin: 2mm 0 3mm; }
.sheet-head h1 { font-size: 20px; letter-spacing: 2px; }
.sheet-head p { margin-top: 1.5mm; color: #8a929a; font-size: 12px; }
.head-line { display: flex; justify-content: space-between; align-items: baseline;
  margin: 0 0 4mm; font-size: 12px; color: #6b7280; }
.head-line .blank { color: #b7bcc2; letter-spacing: 1px; }
.bank { margin: 0 0 4mm; padding: 2.5mm 3.5mm; border: 1px dashed ${pal.border}; border-radius: 2mm;
  font-size: 12px; color: #6b7280; }
.bank b { color: ${pal.trace}; margin-right: 2mm; }
.bank i { font-style: normal; color: #b3a48f; margin-left: 1mm; }
.bank s { text-decoration: none; color: #d8c9bc; margin: 0 1mm; }
.bank-note { margin: 0 0 4mm; font-size: 11px; color: #c07f4e; }
.crow { display: flex; }

/* ---- 生字卡片（表格化布局） ---- */
.cardbox { border: 0.8mm solid #d95f52; border-radius: 1.5mm; padding: 2mm; margin-bottom: 7mm; }
.cb-top { display: flex; gap: 2mm; margin-bottom: 2mm; }
.cb-py { width: 22mm; height: 13mm; border: 0.5mm solid #d95f52; border-radius: 1mm;
  display: flex; align-items: center; justify-content: center;
  font-size: 7mm; font-weight: 600; color: #2f2a26; flex-shrink: 0; }
.cb-strokes { flex: 1; min-width: 0; height: 13mm; border: 0.5mm solid #d95f52; border-radius: 1mm;
  display: flex; align-items: center; justify-content: space-between; gap: 0.5mm; padding: 1mm 1.5mm; overflow: hidden; }
.cb-strokes .stg { width: 8.6mm; height: 8.6mm; flex-shrink: 0; }
.stg path { fill: #3f3a34; }
.stg path.cur { fill: #d95f52; }
.cb-body { display: flex; gap: 2mm; }
.cb-left { width: 30mm; flex-shrink: 0; display: flex; flex-direction: column; gap: 1.2mm; }
.cb-demo { position: relative; height: 30mm; border: 0.5mm solid #d95f52; border-radius: 1mm;
  display: flex; align-items: center; justify-content: center; }
.cb-lab { border: 0.5mm solid #d95f52; border-radius: 1mm; font-size: 3.4mm; color: #3a2e25;
  padding: 1.4mm 2mm; display: flex; align-items: center; }
.cb-right { flex: 1; min-width: 0; }
.cb-right .crow { margin-bottom: 1.2mm; justify-content: space-between; }
.cb-words { text-align: right; font-size: 3.8mm; color: #6b5f51; margin: 0.6mm 0 1.6mm; }
.cb-cw { width: auto; flex: 1; min-width: 0; }
.cell.cb-ch { width: 100%; height: 11.6mm; }
.char.cb-ch { font-size: 8.2mm; }
.cwrap { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
.pinyin { text-align: center; color: #9a7b6b; }
.cell { position: relative; border: 1px solid ${pal.border}; flex-shrink: 0; }
.gl-v { position: absolute; left: 50%; top: 0; bottom: 0; border-left: 1px dashed ${pal.guide}; }
.gl-h { position: absolute; top: 50%; left: 0; right: 0; border-top: 1px dashed ${pal.guide}; }
.gl-d { position: absolute; left: 50%; top: 50%; width: 141%; height: 0;
  border-top: 1px dashed ${pal.guide}; transform: translate(-50%, -50%) rotate(45deg); }
.gl-d.d2 { transform: translate(-50%, -50%) rotate(-45deg); }
.char { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  line-height: 1; font-family: ${FONT_STACKS[fontKey] || FONT_STACKS.kai}; }
.char.demo { color: ${pal.demo}; }
.char.trace { color: ${pal.trace}; }
.erow { position: relative; width: 100%; }
.eline { position: absolute; left: 0; right: 0; border-top: 1px solid ${pal.line}; }
.eline.l1 { top: 0; }
.eline.l2 { top: 33.33%; border-top: 1px dashed ${pal.lineDashed}; }
.eline.l3 { top: 66.66%; }
.eline.l4 { top: 100%; }
.etext { position: absolute; left: 0; top: 0; height: 66.66%; display: flex; align-items: flex-end;
  line-height: 1; white-space: nowrap; font-family: "LXGW WenKai", "Helvetica Neue", Arial, sans-serif; }
.ecell.trace { color: ${pal.trace}; }
.ecell.blank { color: transparent; }
.ecell { display: inline-block; text-align: center; flex-shrink: 0; }
.hrow { font-size: 4mm; color: #3a2e25; padding: 1.2mm 0 1.8mm; font-weight: 500; }
.fgrow { display: flex; gap: 1.5mm; margin-bottom: ${'2.5mm'}; }
.fcell { width: 9mm; height: 9mm; border: 0.5mm solid #5b9e7d; border-radius: 1mm; box-sizing: border-box; }
@page { size: A4; margin: 8mm; }
@media print {
  body { background: #fff; }
  .toolbar { display: none; }
  .page { margin: 0 auto; box-shadow: none; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
}
@media (max-width: 820px) {
  .page { width: 100%; min-height: 0; padding: 4mm; }
}
`;
}


/** 数学题卡打印页：三列口算 / 竖式框 / 应用题 / 答案页 */
function mathToHtml(sheet) {
  const { clockSvg } = require('../layout/clock');
  const esc = escapeHtml;
  const header = `<header><h1>${esc(sheet.title)}</h1><div class="head-line"><span>姓名：________</span><span>日期：________</span><span>用时：________</span><span>得分：________</span></div></header>`;
  const pages = sheet.pages.map((page) => {
    const rows = page.rows.map((row) => {
      if (row.kind === 'section') return `<h2>${esc(row.text)}</h2>`;
      const columns = row.columns || (row.kind === 'word' ? 1 : row.kind === 'vertical' ? 2 : 3);
      const items = (row.items || []).map((item) => {
        if (row.kind === 'clock') return `<div class="clock"><div>${item.no}. ${item.clock.blank ? esc(item.answer) : '写出时间'}</div>${clockSvg(item.clock)}${item.clock.blank ? '' : '<div>时间：________</div>'}</div>`;
        return `<div class="question">${item.no}. ${esc(item.stem)}</div>`;
      }).join('');
      return `<div class="row ${row.kind}" style="grid-template-columns:repeat(${columns},1fr);min-height:${row.heightMm || 11}mm">${items}</div>`;
    }).join('');
    return `<section class="page">${header}${rows}<footer>第 ${page.number} 页 / 共 ${sheet.pages.length} 页</footer></section>`;
  });
  if (sheet.answerPage) pages.push(`<section class="page"><h1>${esc(sheet.title)} · 答案</h1><div class="answers">${sheet.answerPage.rows.flatMap((r) => r.items).map((i) => `<div>${i.no}. ${esc(String(i.answer))}</div>`).join('')}</div></section>`);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(sheet.title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef0f2;color:#222;font-family:"Kaiti SC","STKaiti",KaiTi,serif}
  .page{position:relative;width:210mm;min-height:297mm;margin:16px auto;padding:8mm;background:white;break-after:page}
  h1{font-size:16pt;text-align:center;margin:4mm 0 6mm}h2{font-size:12pt;height:9mm;margin:0;padding:2mm 0}
  .head-line{display:flex;justify-content:space-between;font-size:9.5pt;margin-bottom:6mm}
  .row{display:grid;gap:0 3mm;break-inside:avoid;font-size:11pt;padding-top:2mm}
  .question{min-width:0;overflow-wrap:anywhere}.word{text-align:left;font-size:11pt;line-height:1.6;border-bottom:1px dashed #bbb}
  .clock{font-size:9pt}.clock svg{display:block;width:100%;height:42mm}
  .answers{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm;font-size:10pt}
  footer{position:absolute;bottom:6mm;left:0;right:0;text-align:center;color:#777;font-size:9pt}
  @page{size:A4;margin:0}@media print{body{background:white}.page{margin:0;box-shadow:none}.page:last-child{break-after:auto}}
  </style></head><body>${pages.join('')}</body></html>`;
}

function sheetToHtml(sheet) {
  if (sheet.type === 'math') return mathToHtml(sheet);
  const opts = sheet.options || {};
  const isChinese = sheet.type === 'chinese';
  const pal = PALETTE[opts.paper] || PALETTE.classic;
  const fontKey = isChinese && opts.font === 'xingkai' ? 'xingkai' : 'kai';
  const m = isChinese ? chineseMetrics(opts) : englishMetrics(opts);
  const title = escapeHtml(sheet.title || '字帖练习');
  const dateText = new Date(sheet.createdAt || Date.now()).toLocaleDateString('zh-CN');
  const typeText = isChinese
    ? `语文${sheet.subtype ? ' · ' + sheet.subtype : ''} · ${sheet.charCount} 字`
    : `英语${sheet.wordBank ? ' · 默写帖' : ''} · ${sheet.charCount} 字符`;

  const pagesHtml = sheet.pages.map((page, index) => {
    let head = '';
    if (index === 0) {
      head = `<header class="sheet-head"><h1>${title}</h1><p>${typeText} · 共 ${sheet.pages.length} 页 · ${dateText}</p></header>` +
        `<div class="head-line"><span>姓名：<span class="blank">＿＿＿＿＿＿</span></span>` +
        `<span>班级：<span class="blank">＿＿＿＿＿＿</span></span>` +
        `<span>日期：<span class="blank">＿＿＿＿＿＿</span></span></div>`;
      const hints = sheet.wordHints || {};
      const words = sheet.wordBank && sheet.wordBank.length
        ? sheet.wordBank
        : Object.keys(hints);
      if (words.length) {
        const label = sheet.wordBank ? '报词栏' : '词义栏';
        const entries = words.map((w) => (hints[w] ? `${escapeHtml(w)} <i>${escapeHtml(hints[w])}</i>` : escapeHtml(w)));
        head += `<div class="bank"><b>${label}</b>${entries.join('<s> / </s>')}</div>`;
      }
      if (sheet.dictationNote) {
        head += `<div class="bank-note">${escapeHtml(sheet.dictationNote)}</div>`;
      }
    }
    const rows = page.rows.map((row) => (isChinese ? chineseRowHtml(row, m, opts, pal) : englishRowHtml(row, m, pal))).join('\n');
    return `<section class="page">${head}${rows}</section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css(pal, fontKey)}</style>
</head>
<body>
<div class="toolbar">
  <div class="tb-title">${title}</div>
  <div class="tb-tip">打印时选择「另存为 PDF」可导出文件</div>
  <button class="btn" onclick="window.print()">打印 / 保存为 PDF</button>
</div>
<main>
${pagesHtml}
</main>
</body>
</html>
`;
}

module.exports = { sheetToHtml, PALETTE };
