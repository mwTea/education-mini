'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMathSheet, BOOKS, VERSIONS, TYPES } = require('../src/services/layout/math.service');

test('数学：各册别×难度生成，题量正确、无重复、无空答案', () => {
  for (const id of Object.keys(BOOKS)) {
    for (const d of ['basic', 'standard', 'advanced']) {
      const s = buildMathSheet({ bookId: id, options: { difficulty: d, count: 50, withAnswer: true } });
      assert.equal(s.charCount, 50, `${id}/${d}`);
      const stems = s.questions.map((q) => q.stem + JSON.stringify(q.clock || ''));
      assert.equal(new Set(stems).size, stems.length, `${id}/${d} 有重复题`);
      s.questions.forEach((q) => assert.ok(q.answer !== undefined && q.answer !== '', `${id}/${d} 空答案: ${q.stem}`));
    }
  }
});

test('数学：进退位受难度控制（basic 的 20 内减法不退位）', () => {
  let ok = true;
  for (let i = 0; i < 60; i += 1) {
    const s = buildMathSheet({ bookId: 'math-1b', options: { difficulty: 'basic', count: 30, types: ['sub-20'] } });
    s.questions.forEach((q) => {
      const [a, , b] = q.stem.split(' ').map(Number);
      if (a % 10 < b % 10) ok = false; // basic 不应出现退位
    });
  }
  assert.ok(ok, 'basic 出现了退位减法');
});

test('数学：题量上限 100、应用题上限 10、自定义题型生效', () => {
  const s = buildMathSheet({ bookId: 'math-2b', options: { count: 500, types: ['word-problem'] } });
  assert.equal(s.charCount, 10); // 应用题上限
  const s2 = buildMathSheet({ bookId: 'math-1a', options: { count: 100, types: ['add-10'] } });
  assert.equal(s2.charCount, 100); // 总量上限
  assert.ok(s2.answerPage);
});

test('数学：非法参数回落默认（未知册别→一上，未知难度→巩固）', () => {
  const s = buildMathSheet({ bookId: 'xxx', options: { difficulty: 'xxx', count: -5 } });
  assert.equal(s.options.bookId, 'math-1a');
  assert.equal(s.options.difficulty, 'standard');
  assert.ok(s.options.count >= 1);
});

test('两版本所有册别：题型不越界、分页不超高、题号答案一致', () => {
  for (const [version, v] of Object.entries(VERSIONS)) {
    for (const bookId of Object.keys(v.books)) {
      for (const difficulty of ['basic', 'standard', 'advanced']) {
        const s = buildMathSheet({ bookId, options: { version, difficulty, count: 100 } });
        assert.equal(s.questions.length, 100);
        assert.ok(s.questions.every((q) => v.books[bookId].types.includes(q.type)));
        assert.ok(s.questions.every((q) => !/^[-]/.test(q.answer)));
        const printed = s.pages.flatMap((p) => p.rows.flatMap((r) => r.items || []));
        assert.deepEqual(printed.map((q) => q.no), s.answerPage.rows[0].items.map((q) => q.no));
        for (const page of s.pages) {
          assert.ok(page.rows.reduce((n, r) => n + r.heightMm, 0) <= 240);
          assert.notEqual(page.rows.at(-1).kind, 'section');
        }
      }
    }
  }
});

test('一年级应用题不包含乘除、分数、百分数；数字不超册别范围', () => {
  for (const version of Object.keys(VERSIONS)) {
    for (const bookId of ['math-1a', 'math-1b']) {
      const s = buildMathSheet({ bookId, options: { version, count: 10, types: ['word-problem'], difficulty: 'advanced' } });
      for (const q of s.questions) {
        assert.equal(q.knowledge, 'additive');
        assert.ok(!/平均|每盒|百分|%|\//.test(q.stem));
        assert.ok(Number.parseInt(q.answer, 10) <= (bookId.endsWith('a') ? 20 : 100));
      }
    }
  }
});

test('专项不混入其他题型，越册请求报错', () => {
  const s = buildMathSheet({ bookId: 'math-1a', options: { count: 100, types: ['add-10'] } });
  assert.ok(s.questions.every((q) => q.type === 'add-10'));
  assert.ok(s.notice.includes('重复'));
  assert.throws(() => buildMathSheet({ bookId: 'math-1a', options: { types: ['percent'] } }), /不属于本册/);
});

test('冀教二下换算仅使用本册单位；竖式除数与册别一致', () => {
  const s = buildMathSheet({ bookId: 'math-2b', options: { count: 100, types: ['unit-convert'] } });
  assert.ok(s.questions.every((q) => !/吨|升|千米|立方/.test(q.stem)));
  for (const id of ['math-3a', 'math-4a']) {
    const sheet = buildMathSheet({ bookId: id, options: { count: 30, types: ['vertical-div'] } });
    for (const q of sheet.questions) {
      const divisor = Number(q.stem.split(' ')[2]);
      assert.ok(id === 'math-3a' ? divisor < 10 : divisor >= 10);
    }
  }
});

test('钟表：半点时针居中，12点重合，题面与答案一致', () => {
  const { clockGeometry } = require('../src/services/layout/clock');
  const g = clockGeometry({ hour: 12, minute: 30 });
  assert.ok(g.hour.x > 60 && g.hour.y < 60);
  assert.ok(Math.abs(g.minute.x - 60) < 1e-8 && g.minute.y > 60);
  const noon = clockGeometry({ hour: 12, minute: 0 });
  assert.equal(noon.hour.x, 60); assert.equal(noon.minute.x, 60);
  const sheet = buildMathSheet({ bookId: 'math-2b', options: { count: 20, types: ['clock-read', 'clock-draw'] } });
  sheet.questions.forEach((q) => assert.equal(q.answer, `${q.clock.hour}:${String(q.clock.minute).padStart(2, '0')}`));
  assert.ok(sheet.pages.flatMap((p) => p.rows).filter((r) => r.kind === 'clock').every((r) => r.columns === 4 && r.items.every((q) => q.clockImage.startsWith('data:image/svg+xml;base64,'))));
});

test('分数无负答案，100以内加减进退位符合难度', () => {
  for (let i = 0; i < 500; i += 1) {
    assert.ok(Number.parseInt(TYPES['fraction-add2']().answer, 10) > 0);
    for (const d of ['basic', 'standard']) {
      const add = TYPES['add-100'](d), sub = TYPES['sub-100'](d);
      const [a, , b] = add.stem.split(' ').map(Number);
      const [c, , e] = sub.stem.split(' ').map(Number);
      assert.ok(a + b <= 100);
      assert.equal(a % 10 + b % 10 >= 10, d !== 'basic');
      assert.equal(c % 10 < e % 10, d !== 'basic');
    }
  }
});
