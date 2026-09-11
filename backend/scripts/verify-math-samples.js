'use strict';
const fs = require('fs');
const path = require('path');
const { buildMathSheet } = require('../src/services/layout/math.service');
const { sheetToPdfBuffer } = require('../src/services/render/pdf.service');
const { sheetToHtml } = require('../src/services/render/html.service');
const dir = path.resolve(__dirname, '../../output/pdf');

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const examples = [
    ['jijiao-2b-mixed', 'math-2b', 20, ['add-10000', 'word-problem', 'clock-read', 'clock-draw']],
    ['jijiao-1a-oral', 'math-1a', 50, ['add-10', 'add-20', 'chain-add']],
    ['jijiao-4a-vertical', 'math-4a', 50, ['vertical-div', 'vertical-mul', 'word-problem']],
  ];
  for (const [name, bookId, count, types] of examples) {
    const sheet = buildMathSheet({ bookId, options: { version: 'jijiao', difficulty: 'standard', count, types } });
    fs.writeFileSync(path.join(dir, `${name}.pdf`), await sheetToPdfBuffer(sheet));
    fs.writeFileSync(path.join(dir, `${name}.html`), sheetToHtml(sheet));
    console.log(`${name}: ${sheet.charCount} questions, ${sheet.pages.length} exercise pages + answer page`);
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });
