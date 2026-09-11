// components/sheet-view/index.js
// 把后端返回的 layout JSON 渲染成字帖预览。
// 尺寸算法与后端打印页/PDF 保持一致：格子宽 = 可用宽 / 每行格数。
// 纸张配色 classic/plain 与后端 PALETTE 一一对应。

const { ensureFonts } = require('../../utils/font');

const PALETTES = {
  classic: {
    border: '#5b9e7d', guide: '#a8cbb6', demo: '#2f2a26', trace: '#f09892',
    line: '#5b9e7d', lineDashed: '#a8cbb6',
  },
  plain: {
    border: '#7f878e', guide: '#c3cad1', demo: '#2b3137', trace: '#d5dae0',
    line: '#7f878e', lineDashed: '#c3cad1',
  },
};

function windowWidth() {
  try {
    const info = wx.getSystemInfoSync();
    return info.windowWidth || 375;
  } catch (e) {
    return 375;
  }
}

/** 解析 MMTH 的 SVG 路径（绝对坐标 M/L/Q/C/Z，与后端 PDF 同一套） */
function parseSvgPath(d) {
  const tokens = (d || '').match(/[MLQCZ]|-?\d+(?:\.\d+)?/g) || [];
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
  tokens.forEach((t) => {
    if (/[A-Z]/.test(t)) {
      flush();
      cmd = t;
    } else {
      nums.push(t);
    }
  });
  flush();
  return segs;
}

/** 在 canvas 上画一笔（MMTH 坐标系，与 PDF drawStrokePath 完全一致：y=900 基面翻转，1024 等比） */
function drawStroke(ctx, segs, x0, y0, size) {
  const px = (v) => x0 + (v * size) / 1024;
  const py = (v) => y0 + ((900 - v) * size) / 1024;
  ctx.beginPath();
  segs.forEach((s) => {
    if (s.c === 'M') ctx.moveTo(px(s.x), py(s.y));
    else if (s.c === 'L') ctx.lineTo(px(s.x), py(s.y));
    else if (s.c === 'Q') ctx.quadraticCurveTo(px(s.x1), py(s.y1), px(s.x), py(s.y));
    else if (s.c === 'C') ctx.bezierCurveTo(px(s.x1), py(s.y1), px(s.x2), py(s.y2), px(s.x), py(s.y));
    else if (s.c === 'Z') ctx.closePath();
  });
  ctx.fill();
}

/** 顶栏笔顺演示条：逐笔累加，已完成深色、最新一笔红色（同 PDF） */
function drawStrokeStrip(canvas, ctx, dpr, strokes) {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.clearRect(0, 0, w, h);
  const n = strokes.length;
  const cell = Math.min(h - 6, (w - 8) / n);
  const offY = (h - cell) / 2;
  const segsList = strokes.map(parseSvgPath);
  for (let k = 0; k < n; k += 1) {
    const x0 = 4 + k * cell;
    for (let j = 0; j <= k; j += 1) {
      ctx.fillStyle = j === k ? '#d95f52' : '#3f3a34';
      drawStroke(ctx, segsList[j], x0, offY, cell);
    }
  }
}

Component({
  properties: {
    sheet: { type: Object, value: null },
  },

  lifetimes: {
    attached() {
      ensureFonts();
    },
  },

  data: {
    vm: null,
  },

  observers: {
    sheet(sheet) {
      if (!sheet || !Array.isArray(sheet.pages)) {
      this.setData({ vm: null });
        return;
      }

      // 可用宽度 = 屏宽 - 预览页内边距(20rpx×2) - 纸张内边距(20rpx×2) = 40px，
      // 之前少算了这 40px，田字格/卡片会横向溢出
      const usable = windowWidth() - 40;

      // 服务端没有下发 wx:key 用的稳定字段，这里补上
      const pages = sheet.pages.map((page, pi) => ({
        key: `p${pi}`,
        number: page.number || pi + 1,
        rows: (page.rows || []).map((row, ri) => ({
          key: `p${pi}r${ri}`,
          kind: row.kind || 'practice',
          style: row.style || '',
          text: row.text || '',
          columns: row.columns || 3,
          heightMm: row.heightMm || 0,
          char: row.char || '',
          pinyin: row.pinyin || '',
          meta: row.meta || null,
          words: row.words || null,
          strokes: row.strokes || null, // 生字卡片笔顺 SVG（离屏 canvas 绘制后转图片）
          strokeImg: '',
          kind: row.kind || '',
          width: row.width || 0,
          count: row.count || 0,
          items: (row.items || []).map((item) => ({
            no: item.no,
            stem: item.stem || '',
            clock: item.clock || null,
            clockImage: item.clockImage || '',
            answer: item.answer || '',
            parts0: (item.stem || '').split(' ')[0],
            parts2: (item.stem || '').split(' ')[2] || '',
          })),
          cells: (row.cells || []).map((cell, ci) => ({
            key: `p${pi}r${ri}c${ci}`,
            char: cell.char,
            style: cell.style,
            pinyin: cell.pinyin,
          })),
          practiceRows: (row.practiceRows || []).map((prow, pr) => ({
            key: `p${pi}r${ri}pr${pr}`,
            cells: (prow.cells || []).map((cell, ci) => ({
              key: `p${pi}r${ri}pr${pr}c${ci}`,
              char: cell.char,
              style: cell.style,
              pinyin: cell.pinyin,
            })),
          })),
          wordRows: (row.wordRows || []).map((wrow, wr) => ({
            key: `p${pi}r${ri}w${wr}`,
            cells: (wrow.cells || []).map((cell, ci) => ({
              key: `p${pi}r${ri}w${wr}c${ci}`,
              char: cell.char,
              style: cell.style,
              pinyin: cell.pinyin,
            })),
          })),
        })),
      }));

      let metrics;
      if (sheet.type === 'math') {
        metrics = {};
      } else if (sheet.type === 'chinese') {
        const perRow = (sheet.options && sheet.options.charsPerRow) || 10;
        const cell = Math.max(16, Math.floor(usable / perRow));
        // 行楷笔画偏粗，字号收细一档
        const factor = (sheet.options && sheet.options.font) === 'xingkai' ? 0.66 : 0.72;
        // 生字卡片（与 PDF 同构）：左栏大范字约 92px，右栏 12 格描红/组词
        const cardLeft = 92;
        const cardPad = 8;
        const rightW = Math.max(160, usable - cardPad * 2 - cardLeft - 8);
        const cardCellR = Math.max(12, Math.floor(rightW / 12));
        metrics = {
          cell,
          char: Math.round(cell * factor),
          pinyin: Math.max(9, Math.round(cell * 0.26)),
          pinyinH: Math.max(12, Math.round(cell * 0.34)),
          cardDemoChar: Math.round(92 * 0.6),
          cardCellR,
          cardCharR: Math.round(cardCellR * factor),
        };
      } else {
        const perLine = (sheet.options && sheet.options.cellsPerLine) || 24;
        const advance = usable / perLine;
        const font = Math.round(advance / 0.62);
        const unit = Math.max(5, Math.round(font * 0.52));
        metrics = {
          advance: Math.round(advance * 100) / 100,
          font,
          unit,
          rowH: unit * 3,
          rowGap: Math.round(unit * 0.8),
        };
      }

      const answerRows = sheet.answerPage && sheet.answerPage.rows ? sheet.answerPage.rows : null;
      this.setData({
        vm: {
          type: sheet.type,
          title: sheet.title,
          options: sheet.options || {},
          pages,
          metrics,
          pal: PALETTES[(sheet.options && sheet.options.paper) || 'classic'],
          wordBank: sheet.wordBank ? sheet.wordBank.join('  /  ') : null,
          bankLabel: sheet.wordBank ? '报词栏' : (sheet.wordHints ? '词义栏' : ''),
          bankHintText: sheet.wordBank
            ? null
            : (sheet.wordHints ? Object.keys(sheet.wordHints)
                .map((w) => `${w} ${sheet.wordHints[w]}`).join('  /  ') : null),
          answerRows,
        },
      }, () => this.drawStrokeCanvases(pages));
    },
  },

  methods: {
    /**
     * 笔顺演示条：在隐藏画板上逐卡绘制并导出图片回填。
     * 不直接把 canvas 放进卡片——canvas 是原生组件，部分机型不随页面
     * 滚动（会钉在屏幕上），image 同层渲染没有这个问题。
     */
    drawStrokeCanvases(pages) {
      const cards = [];
      pages.forEach((p, pi) => (p.rows || []).forEach((r, ri) => {
        if (r.kind === 'card' && r.strokes && r.strokes.length) cards.push({ pi, ri, strokes: r.strokes });
      }));
      if (!cards.length) return;
      wx.nextTick(() => {
        this.createSelectorQuery().select('#cb-stroke-cv').fields({ node: true }).exec((res) => {
          const canvas = res[0] && res[0].node;
          if (!canvas) return;
          let dpr = 2;
          try {
            dpr = wx.getSystemInfoSync().pixelRatio || 2;
          } catch (e) { /* 保底 */ }
          const W = 320;
          const H = 48;
          canvas.width = W * dpr;
          canvas.height = H * dpr;
          const ctx = canvas.getContext('2d');
          const drawNext = (i) => {
            if (i >= cards.length) return;
            const c = cards[i];
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(dpr, dpr);
            drawStrokeStrip(canvas, ctx, dpr, c.strokes);
            wx.canvasToTempFilePath({
              canvas,
              fileType: 'png',
              success: (r) => {
                this.setData({ [`vm.pages[${c.pi}].rows[${c.ri}].strokeImg`]: r.tempFilePath });
                drawNext(i + 1);
              },
              fail: () => drawNext(i + 1),
            });
          };
          drawNext(0);
        });
      });
    },
  },
});
