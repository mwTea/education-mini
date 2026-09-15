'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const { buildCurriculumEnglishSheet } = require('../src/services/layout/english.service');
const { sheetToHtml } = require('../src/services/render/html.service');
const { sheetToPdfBuffer, internals } = require('../src/services/render/pdf.service');

const ROOT = path.join(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'output', 'pdf');
const TEMP = path.join(ROOT, 'tmp', 'pdfs');

const sampleBook = { id: 'sample', name: '英语字体校准样张' };
const sampleUnit = {
  unitNo: 1,
  title: 'Handwriting calibration',
  words: [
    { word: 'giraffe', meaning: '长颈鹿' },
    { word: 'elephant', meaning: '大象' },
    { word: 'panda', meaning: '熊猫' },
    { word: 'tiger', meaning: '老虎' },
    { word: 'monkey', meaning: '猴子' },
    { word: 'happy', meaning: '开心的' },
    { word: 'teacher', meaning: '教师' },
    { word: 'doctor', meaning: '医生' },
    { word: 'farmer', meaning: '农场主；农民' },
    { word: 'nurse', meaning: '护士' },
    { word: 'worker', meaning: '工人' },
    { word: 'busy', meaning: '忙碌的' },
    { word: 'tired', meaning: '疲倦的' },
    { word: 'family', meaning: '家庭；家人' },
    { word: 'room', meaning: '房间' },
    { word: 'sweep', meaning: '打扫' },
    { word: 'floor', meaning: '地板；地面' },
    { word: 'together', meaning: '在一起；共同' },
    { word: 'children', meaning: '儿童；小孩' },
    { word: 'clean', meaning: '打扫；干净的' },
  ],
  sentences: [
    { text: 'Practice makes progress.', translation: '练习带来进步。', level: 1 },
  ],
};

function makeSheet(practiceMode) {
  return buildCurriculumEnglishSheet({
    title: practiceMode === 'copy' ? '单词描红 · 衡水体样张' : '听写单词 · 衡水体样张',
    book: sampleBook,
    unit: practiceMode === 'copy' ? { ...sampleUnit, words: sampleUnit.words.slice(0, 10) } : sampleUnit,
    options: {
      exerciseType: 'word',
      practiceMode,
      englishFont: 'hengshui',
      showTranslation: true,
      traceCount: 1,
      blankCount: 1,
      paper: 'classic',
    },
  });
}

function makeSentenceDictationSheet() {
  const unit = {
    ...sampleUnit,
    sentences: [
      { text: 'What does your mother do?', translation: '你妈妈做什么工作？' },
      { text: 'She is a doctor.', translation: '她是医生。' },
      { text: 'My parents are busy. What can we do for them?', translation: '爸爸妈妈又忙又累。我们能为他们做些什么？' },
      { text: 'We can do some housework.', translation: '我们可以做一些家务活。' },
    ],
  };
  return buildCurriculumEnglishSheet({
    title: '听写句子 · 衡水体样张',
    book: sampleBook,
    unit,
    options: { exerciseType: 'sentence', practiceMode: 'zh2en', englishFont: 'hengshui', blankCount: 1, paper: 'plain' },
  });
}

function comparisonPdf() {
  const { loadFont, loadEnglishFont, drawText, line, A4, MARGIN, CONTENT_W } = internals;
  const kai = loadFont('kai');
  const styles = [
    ['hengshui', '衡水体（默认）'],
    ['print', '标准印刷体'],
    ['rounded', '圆润体'],
  ];
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.rect(0, 0, A4.width, A4.height).fill('#fff');
    drawText(doc, kai, '英语书写字体对比', 0, 45, 18, '#263b59', { width: A4.width, align: 'center' });
    drawText(doc, kai, '相同字号 · 相同四线格 · 相同基线', 0, 66, 9, '#64748b', { width: A4.width, align: 'center' });

    let y = 102;
    styles.forEach(([key, label]) => {
      const font = loadEnglishFont({ englishFont: key });
      drawText(doc, kai, label, MARGIN, y, 12, '#263b59');
      y += 18;
      const unit = 22;
      const height = unit * 3;
      line(doc, MARGIN, y, MARGIN + CONTENT_W, y, '#5b9e7d', 0.9, false);
      line(doc, MARGIN, y + unit, MARGIN + CONTENT_W, y + unit, '#a8cbb6', 0.8, true);
      line(doc, MARGIN, y + unit * 2, MARGIN + CONTENT_W, y + unit * 2, '#5b9e7d', 0.9, false);
      line(doc, MARGIN, y + height, MARGIN + CONTENT_W, y + height, '#5b9e7d', 0.9, false);
      drawText(doc, font, 'Aa Bb Cc  giraffe elephant panda', MARGIN + 8, y + unit * 2, 30, '#f09892');
      y += height + 34;
      drawText(doc, font, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', MARGIN + 8, y, 20, '#263b59');
      y += 28;
      drawText(doc, font, 'abcdefghijklmnopqrstuvwxyz  0123456789  . , ! ?', MARGIN + 8, y, 20, '#263b59');
      y += 54;
    });
    drawText(doc, kai, '检查项：大写高度、小写主体、升部、降部、字距和标点位置', MARGIN, A4.height - 42, 9, '#64748b');
    doc.end();
  });
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.mkdirSync(TEMP, { recursive: true });
  const copy = makeSheet('copy');
  const wordDictation = makeSheet('zh2en');
  const sentenceDictation = makeSentenceDictationSheet();
  fs.writeFileSync(path.join(OUTPUT, '单词描红-PDF样张.pdf'), await sheetToPdfBuffer(copy));
  fs.writeFileSync(path.join(OUTPUT, '听写单词-PDF样张.pdf'), await sheetToPdfBuffer(wordDictation));
  fs.writeFileSync(path.join(OUTPUT, '听写句子-PDF样张.pdf'), await sheetToPdfBuffer(sentenceDictation));
  fs.writeFileSync(path.join(OUTPUT, '英语字体对比-PDF样张.pdf'), await comparisonPdf());
  fs.writeFileSync(path.join(TEMP, 'english-hengshui-preview.html'), sheetToHtml(copy));
  console.log('English font samples generated.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
