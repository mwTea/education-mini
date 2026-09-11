'use strict';

/**
 * 生成「常用偏旁部首」静态练习 PDF（assets/radicals/<id>.pdf + index.json）。
 * 静态资源不占生成配额、零等待；内容：偏旁大范字（田字格）+ 名称 +
 * 6 个含该部首的教材例字（带拼音）+ 空白练习格。
 * 例字来自教材生字表（真实学过的字），按 hanzi.service 的部首反查。
 *
 * 用法：node scripts/build-radicals.js
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { internals } = require('../src/services/render/pdf.service');
const hanzi = require('../src/services/hanzi.service');

const { loadFont, drawText, line, A4, MARGIN, CONTENT_W } = internals;

const OUT_DIR = path.join(__dirname, '..', 'assets', 'radicals');

/** 小学常用偏旁名称表（1-6 年级语文常见，约 60 个） */
const RADICALS = [
  ['冫', '两点水'], ['讠', '言字旁'], ['亻', '单人旁'], ['刂', '立刀旁'], ['丷', '八字头'],
  ['冖', '秃宝盖'], ['卜', '卜字边'], ['卩', '单耳刀'], ['阝', '双耳刀'], ['力', '力字旁'],
  ['又', '又字旁'], ['廴', '建之旁'], ['工', '工字旁'], ['土', '提土旁'], ['士', '士字旁'],
  ['扌', '提手旁'], ['艹', '草字头'], ['寸', '寸字底'], ['大', '大字头'], ['口', '口字旁'],
  ['囗', '国字框'], ['巾', '巾字旁'], ['山', '山字旁'], ['彳', '双人旁'], ['彡', '三撇儿'],
  ['夕', '夕字旁'], ['犭', '反犬旁'], ['饣', '食字旁'], ['广', '广字头'], ['门', '门字框'],
  ['氵', '三点水'], ['忄', '竖心旁'], ['宀', '宝盖头'], ['辶', '走之旁'], ['彐', '横山'],
  ['尸', '尸字头'], ['己', '己字旁'], ['子', '子字旁'], ['纟', '绞丝旁'], ['王', '王字旁'],
  ['木', '木字旁'], ['支', '支字旁'], ['攵', '反文旁'], ['日', '日字旁'], ['曰', '曰字旁'],
  ['月', '月字旁'], ['欠', '欠字旁'], ['止', '止字旁'], ['火', '火字旁'], ['灬', '四点底'],
  ['爫', '爪字头'], ['片', '片字旁'], ['牛', '牛字旁'], ['手', '手字底'], ['毛', '毛字旁'],
  ['气', '气字头'], ['攴', '攴字旁'], ['斤', '斤字旁'], ['方', '方字旁'], ['父', '父字头'],
  ['户', '户字头'], ['礻', '示字旁'], ['心', '心字底'], ['戈', '戈字旁'], ['皿', '皿字底'],
  ['目', '目字旁'], ['石', '石字旁'], ['禾', '禾木旁'], ['鸟', '鸟字边'], ['穴', '穴字头'],
  ['立', '立字旁'], ['竹', '竹字头'], ['米', '米字旁'], ['缶', '缶字旁'], ['羊', '羊字旁'],
  ['羽', '羽字旁'], ['耂', '老字头'], ['而', '而字旁'], ['耳', '耳字旁'], ['舟', '舟字旁'],
  ['虫', '虫字旁'], ['虍', '虎字头'], ['血', '血字旁'], ['行', '行字旁'], ['衣', '衣字旁'],
  ['衤', '衣字旁'], ['西', '西字头'], ['见', '见字边'], ['角', '角字旁'], ['言', '言字旁'],
  ['谷', '谷字旁'], ['豆', '豆字旁'], ['贝', '贝字旁'], ['走', '走字旁'], ['足', '足字旁'],
  ['身', '身字旁'], ['车', '车字旁'], ['辛', '辛字旁'], ['辰', '辰字旁'], ['邑', '右耳刀'],
  ['酉', '酉字旁'], ['里', '里字旁'], ['釒', '金字旁'], ['长', '长字旁'], ['雨', '雨字头'],
  ['青', '青字旁'], ['非', '非字旁'], ['面', '面字旁'], ['革', '革字旁'], ['音', '音字旁'],
  ['页', '页字边'], ['风', '风字边'], ['飞', '飞字旁'], ['食', '食字底'], ['马', '马字旁'],
  ['鱼', '鱼字旁'], ['鹿', '鹿字旁'], ['麦', '麦字旁'], ['齐', '齐字旁'], ['齿', '齿字旁'],
  ['龙', '龙字旁'], ['龟', '龟字旁'], ['鼻', '鼻字旁'], ['黑', '黑字旁'],
];

const pinyin = null; // 由 hanzi.service 提供（示例字用）

function drawGrid(doc, font, x, y, size, char, charColor) {
  doc.save();
  doc.lineWidth(1.1).strokeColor('#5b9e7d');
  doc.rect(x, y, size, size).stroke();
  doc.restore();
  line(doc, x + size / 2, y, x + size / 2, y + size, '#a8cbb6', 0.8, true);
  line(doc, x, y + size / 2, x + size, y + size / 2, '#a8cbb6', 0.8, true);
  if (char) {
    const baseline = y + size / 2 + 0.36 * size * 0.7;
    drawText(doc, font, char, x, baseline, size * 0.7, charColor, { width: size });
  }
}

async function buildRadicalPdf(radical, name, examples, outFile) {
  const kai = loadFont('kai');
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((r) => doc.on('end', r));

  doc.save();
  doc.rect(0, 0, A4.width, A4.height).fill('#fffdf6');
  doc.restore();

  drawText(doc, kai, `${name} ${radical[0]}`, 0, MARGIN + 16, 16, '#2f2a26', { width: A4.width, align: 'center' });
  drawText(doc, kai, `常用偏旁部首练习 · 例字来自人教版教材`, 0, MARGIN + 30, 8.5, '#8a929a', { width: A4.width, align: 'center' });

  // 大范字（居中田字格）
  const big = 150;
  const bigX = (A4.width - big) / 2;
  const bigY = MARGIN + 52;
  drawGrid(doc, kai, bigX, bigY, big, radical[0], '#2f2a26');
  drawText(doc, kai, name, 0, bigY + big + 24, 12, '#c07f4e', { width: A4.width, align: 'center' });

  // 例字行（带拼音，每字一格）
  let y = bigY + big + 56;
  drawText(doc, kai, '写一写 · 含这个部首的字', MARGIN, y, 10, '#6b5f51');
  y += 10;
  const cell = (CONTENT_W - 5 * 8) / 6;
  const row1 = (examples.length ? examples.slice(0, 6) : []);
  row1.forEach((ex, i) => {
    const x = MARGIN + i * (cell + 8);
    const pySize = cell * 0.26;
    drawText(doc, kai, ex.pinyin || '', x, y + 10, pySize, '#9a7b6b', { width: cell });
    drawGrid(doc, kai, x, y + 14, cell, ex.char, '#e2544e');
  });
  y += 14 + cell + 16;

  // 空白练习格（剩余页面，每行 8 格）
  drawText(doc, kai, '练一练', MARGIN, y, 10, '#6b5f51');
  y += 10;
  const pc = (CONTENT_W - 7 * 6) / 8;
  while (y + pc < A4.height - MARGIN - 16) {
    for (let i = 0; i < 8; i += 1) drawGrid(doc, kai, MARGIN + i * (pc + 6), y, pc, '', '');
    y += pc + 6;
  }

  doc.end();
  await done; // 先等流写完再拼缓冲
  fs.writeFileSync(outFile, Buffer.concat(chunks));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // 例字：教材字表按部首反查（取最多 6 个）
  const textbookChars = new Set();
  const dataDir = path.join(__dirname, '..', 'src', 'data', 'textbooks');
  fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).forEach((f) => {
    const book = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    book.lessons.forEach((l) => String(l.chars || '').split('').forEach((c) => textbookChars.add(c)));
  });

  const index = [];
  const seen = new Set();
  for (const [char, name] of RADICALS) {
    if (!char || seen.has(char)) continue;
    seen.add(char);
    const examples = [...textbookChars]
      .map((c) => ({ c, info: hanzi.lookup(c) }))
      .filter(({ info }) => info && info.radical === char)
      .slice(0, 6)
      .map(({ c, info }) => ({ char: c, pinyin: (info.strokePaths ? '' : '') || '' }));
    // 拼音补齐：用 pinyin-pro
    const { pinyin } = require('pinyin-pro');
    examples.forEach((ex) => {
      ex.pinyin = pinyin(ex.char, { toneType: 'symbol', type: 'array' })[0] || '';
    });
    const id = encodeURIComponent(char);
    const file = `radical-${Buffer.from(char).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')}.pdf`;
    await buildRadicalPdf(char, name, examples, path.join(OUT_DIR, file));
    index.push({ id: char, name, exampleChars: examples.map((e) => e.char), pdf: `/assets/radicals/${file}` });
    console.log(`${name} ${char} · 例字 ${examples.length}`);
  }
  // 部首归类描红练习册：每页 4 个偏旁块（范字格 + 例字红描 + 空白练习行）
  const doc2 = new PDFDocument({ size: 'A4', margin: MARGIN });
  const chunks2 = [];
  doc2.on('data', (c) => chunks2.push(c));
  const done2 = new Promise((r) => doc2.on('end', r));
  const kai = loadFont('kai');
  const withExamples = index.filter((it) => it.exampleChars.length >= 3);
  const perPage = 4;
  for (let pg = 0; pg * perPage < withExamples.length; pg += 1) {
    if (pg > 0) doc2.addPage();
    doc2.save();
    doc2.rect(0, 0, A4.width, A4.height).fill('#fffdf6');
    doc2.restore();
    if (pg === 0) {
      drawText(doc2, kai, '常用偏旁部首归类描红练习', 0, MARGIN + 16, 15, '#2f2a26', { width: A4.width, align: 'center' });
      drawText(doc2, kai, '例字来自人教版教材 · 红字描红 · 空格练习', 0, MARGIN + 30, 8.5, '#8a929a', { width: A4.width, align: 'center' });
    }
    let y = MARGIN + (pg === 0 ? 50 : 16);
    const blockH = (A4.height - y - MARGIN) / perPage;
    withExamples.slice(pg * perPage, (pg + 1) * perPage).forEach((it) => {
      // 块内：左范字格(48) + 右例字行(红) + 空白行
      drawGrid(doc2, kai, MARGIN, y + 4, 48, it.id, '#2f2a26');
      drawText(doc2, kai, it.name, MARGIN + 2, y + 66, 8.5, '#c07f4e', { width: 48 });
      const exX = MARGIN + 62;
      const exW = CONTENT_W - 62;
      const exCell = exW / Math.max(6, it.exampleChars.length);
      it.exampleChars.slice(0, 6).forEach((c, i) => {
        drawText(doc2, kai, c, exX + i * exCell, y + 38, 24, '#e2544e', { width: exCell });
      });
      // 空白练习行：6 格（浅格）
      const pc = (exW - 5 * 6) / 6;
      for (let i = 0; i < 6; i += 1) {
        doc2.save();
        doc2.lineWidth(0.9).strokeColor('#a8cbb6');
        doc2.rect(exX + i * (pc + 6), y + 52, pc, pc).stroke();
        doc2.restore();
      }
      y += blockH;
    });
  }
  doc2.end();
  await done2;
  fs.writeFileSync(path.join(OUT_DIR, 'overview.pdf'), Buffer.concat(chunks2));
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify({ items: index, overviewPdf: '/assets/radicals/overview.pdf' }, null, 2));
  console.log(`\n共 ${index.length} 个偏旁 → ${OUT_DIR}（含归类总表 overview.pdf）`);
}

main().catch((e) => { console.error(e); process.exit(1); });
