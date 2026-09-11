'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 测试数据写到临时目录，不污染仓库
process.env.COPYBOOK_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'copybook-test-'));
// 放开限流，避免用例间互相触发 429
process.env.RATE_LIMIT_PER_MIN = '1000';
process.env.DAILY_SHEET_LIMIT = '1000';

const app = require('../src/app');

const FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'LXGWWenKai-Regular.ttf');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('健康检查', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
});

test('创建语文字帖（自动注音）→ 详情 → 打印页 → PDF → 删除', async () => {
  const created = await fetch(`${base}/api/v1/sheets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'chinese',
      title: '第一课生字',
      content: { chars: '大小口' },
      options: { grid: 'mi', showPinyin: true, demoCount: 1, traceCount: 1, blankCount: 2 },
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.ok(createdBody.id);
  assert.equal(createdBody.pageCount, 1);

  const detail = await fetch(`${base}/api/v1/sheets/${createdBody.id}`);
  assert.equal(detail.status, 200);
  const { sheet } = await detail.json();
  assert.equal(sheet.type, 'chinese');
  assert.equal(sheet.options.grid, 'mi');
  assert.equal(sheet.pages[0].rows[0].cells[0].pinyin, 'dà'); // 自动注音
  assert.equal(sheet.pages[0].rows[0].cells[0].style, 'demo');

  const print = await fetch(`${base}/api/v1/sheets/${createdBody.id}/print`);
  assert.equal(print.status, 200);
  const html = await print.text();
  assert.ok(html.includes('class="cell mi"'));
  assert.ok(html.includes('class="char demo"'));
  assert.ok(html.includes('姓名'));

  if (fs.existsSync(FONT_PATH)) {
    const pdf = await fetch(`${base}/api/v1/sheets/${createdBody.id}/pdf`);
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    const buf = Buffer.from(await pdf.arrayBuffer());
    assert.ok(buf.length > 1000);
    assert.equal(buf.subarray(0, 4).toString('utf8'), '%PDF');
  } else {
    console.warn('跳过 PDF 断言：字体未安装（运行 backend/scripts/fetch-fonts.sh）');
  }

  const removed = await fetch(`${base}/api/v1/sheets/${createdBody.id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  const gone = await fetch(`${base}/api/v1/sheets/${createdBody.id}`);
  assert.equal(gone.status, 404);
});

test('创建英语默写帖（报词栏）并渲染打印页', async () => {
  const created = await fetch(`${base}/api/v1/sheets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'english',
      content: { text: 'good morning' },
      options: { mode: 'dictation', blankCount: 1 },
    }),
  });
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const detail = await fetch(`${base}/api/v1/sheets/${id}`);
  const { sheet } = await detail.json();
  assert.deepEqual(sheet.wordBank, ['good', 'morning']);

  const print = await fetch(`${base}/api/v1/sheets/${id}/print`);
  const html = await print.text();
  assert.ok(html.includes('class="erow"'));
  assert.ok(html.includes('报词栏'));
});

test('教材生字表接口（1-6 年级真实数据）', async () => {
  const listRes = await fetch(`${base}/api/v1/textbooks`);
  assert.equal(listRes.status, 200);
  const { items } = await listRes.json();
  assert.ok(items.length >= 12); // 一年级 2 册 + 二至六年级 10 册
  assert.ok(items.some((i) => i.id === 'rj-yuwen-6b'), '应有六年级下册');

  const bookRes = await fetch(`${base}/api/v1/textbooks/rj-yuwen-1a`);
  const { book } = await bookRes.json();
  assert.ok(book.lessons.length >= 30);

  const autumn = book.lessons.find((l) => l.title.includes('秋天'));
  assert.equal(Array.from(autumn.chars).sort().join(''), '了人大子');

  // 逐字拼音（在线看拼音选字用）：带调拼音且与生字一一对应
  assert.equal(autumn.items.length, 4, 'items 应去重后与生字数一致');
  const byChar = Object.fromEntries(autumn.items.map((it) => [it.ch, it.py]));
  assert.equal(byChar['人'], 'rén');
  assert.match(Object.values(byChar).join(' '), /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s]+$/);

  const missing = await fetch(`${base}/api/v1/textbooks/no-such-book`);
  assert.equal(missing.status, 404);
});

test('古诗词库与英语词库接口', async () => {
  const poemsRes = await fetch(`${base}/api/v1/poems`);
  assert.equal(poemsRes.status, 200);
  const { items: poems } = await poemsRes.json();
  assert.ok(poems.length >= 60);
  assert.ok(poems[0].grade && poems[0].title && poems[0].text);
  assert.ok(poems.every((p) => p.text.replace(/[^\u4e00-\u9fff]/g, '').length <= 60));

  const wbRes = await fetch(`${base}/api/v1/wordbooks`);
  const { items: wbs } = await wbRes.json();
  assert.ok(wbs.length >= 2); // 少儿高频 + 核心词汇（教材词表后续并入）
  const kids = wbs.find((b) => b.id === 'pack-kids');
  assert.ok(kids && kids.wordCount >= 100);

  const detail = await fetch(`${base}/api/v1/wordbooks/pack-core`);
  const { book } = await detail.json();
  assert.ok(book.units.length >= 6);
});

test('参数校验：空汉字返回 400', async () => {
  const res = await fetch(`${base}/api/v1/sheets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'chinese', content: { chars: '   ' } }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error);
});

test('参数校验：未知 type 返回 400', async () => {
  const res = await fetch(`${base}/api/v1/sheets`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'math', content: {} }),
  });
  assert.equal(res.status, 400);
});

test('数学：钟表混排、友好文件名和数字口算接口', async () => {
  const create = await fetch(`${base}/api/v1/sheets`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'math', content: { version: 'jijiao', bookId: 'math-2b' },
      options: { count: 20, types: ['clock-read', 'clock-draw', 'word-problem', 'add-10000'] } }),
  });
  assert.equal(create.status, 201);
  const { id } = await create.json();
  const { sheet } = await (await fetch(`${base}/api/v1/sheets/${id}`)).json();
  assert.match(sheet.fileName, /冀教版.*20题_\d{8}\.pdf$/);
  const print = await (await fetch(`${base}/api/v1/sheets/${id}/print`)).text();
  assert.ok(print.includes('<svg') && print.includes('认识钟表') && print.includes('应用题'));
  const pdf = await fetch(`${base}/api/v1/sheets/${id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.ok(pdf.headers.get('content-disposition').includes(encodeURIComponent(sheet.fileName)));
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
  const quiz = await fetch(`${base}/api/v1/math/quiz`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: 'jijiao', bookId: 'math-2b', count: 50 }),
  });
  assert.equal(quiz.status, 200);
  const { questions } = await quiz.json();
  assert.equal(questions.length, 50);
  assert.ok(questions.every((q) => /^\d+(\.\d+)?$/.test(q.answer) && !q.type.startsWith('clock')));
  const invalid = await fetch(`${base}/api/v1/math/quiz`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bookId: 'missing' }),
  });
  assert.equal(invalid.status, 400);
});
