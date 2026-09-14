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

test('应用题：同知识点多场景，不再是单句式换数字', () => {
  const patterns = new Set();
  for (let i = 0; i < 5; i += 1) {
    const s = buildMathSheet({ bookId: 'math-1a', options: { version: 'jijiao', count: 10, types: ['word-problem'] } });
    s.questions.forEach((q) => patterns.add(q.stem.replace(/\d+/g, '#')));
  }
  assert.ok(patterns.size >= 3, `场景只有 ${patterns.size} 种: ${[...patterns].join(' | ')}`);
});

test('应用题：数值范围跟本册教材走（五下表内复习不出大数除法，三上分数初步分母≤9）', () => {
  let divides = [], fracs = [];
  for (let i = 0; i < 5; i += 1) {
    const s5 = buildMathSheet({ bookId: 'math-5b', options: { version: 'pep', count: 10, types: ['word-problem'] } });
    divides = divides.concat(s5.questions.filter((q) => q.knowledge === 'divide'));
    const s3 = buildMathSheet({ bookId: 'math-3a', options: { version: 'pep', count: 10, types: ['word-problem'], difficulty: 'advanced' } });
    fracs = fracs.concat(s3.questions.filter((q) => q.knowledge === 'fraction'));
  }
  assert.ok(divides.length >= 3, '五下未抽到除法应用题');
  divides.forEach((q) => {
    const max = Math.max(...q.stem.match(/\d+/g).map(Number));
    assert.ok(max <= 81, `五下除法应用超出表内范围: ${q.stem}`);
  });
  assert.ok(fracs.length >= 3, '三上未抽到分数应用题');
  fracs.forEach((q) => {
    q.stem.match(/\/(\d+)/g)?.forEach((f) => assert.ok(Number(f.slice(1)) <= 9, `三上分数分母超初步范围: ${q.stem}`));
  });
});

test('应用题：分数答案均为最简（不出现 5/5、11/11 之类未化简结果）', () => {
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  for (const [version, v] of Object.entries(VERSIONS)) {
    for (const bookId of Object.keys(v.books)) {
      for (let i = 0; i < 3; i += 1) {
        const s = buildMathSheet({ bookId, options: { version, count: 10, types: ['word-problem'], difficulty: 'advanced' } });
        s.questions.forEach((q) => {
          const m = String(q.answer).match(/^(\d+)\/(\d+)/);
          if (!m) return;
          const [a, b] = [Number(m[1]), Number(m[2])];
          assert.ok(a < b && gcd(a, b) === 1, `${version}/${bookId} 分数答案未化简: ${q.answer}（${q.stem}）`);
        });
      }
    }
  }
});

test('单位换算：数量不再恒为 1 或 10 的倍数', () => {
  for (const [version, bookId] of [['pep', 'math-2a'], ['jijiao', 'math-3a']]) {
    const s = buildMathSheet({ bookId, options: { version, count: 60, types: ['unit-convert'] } });
    const ns = s.questions.map((q) => Number(q.stem.match(/^(\d+)/)[1]));
    assert.ok(new Set(ns).size >= 8, `${bookId} 换算数值单一: ${[...new Set(ns)].join(',')}`);
    assert.ok(ns.some((n) => n % 10 !== 0), `${bookId} 换算数量全是 10 的倍数`);
    assert.ok(!ns.includes(1) || ns.filter((n) => n === 1).length < ns.length / 4, `${bookId} 换算数量以 1 为主`);
  }
});

test('渲染：题目区小题不带序号，大题序号与答案页序号保留', () => {
  const { sheetToHtml } = require('../src/services/render/html.service');
  const s = buildMathSheet({ bookId: 'math-2a', options: { version: 'jijiao', count: 40, withAnswer: true } });
  const html = sheetToHtml(s);
  assert.ok(/<h2>\d+、/.test(html), '大题序号应保留');
  assert.ok(!/class="question">\d+\.|class="clock"><div>\d+\./.test(html), '题目区不应出现"序号. "');
  assert.ok(html.includes('class="answers"><div>1. '), '答案页应保留"题号. 答案"');
});

test('几何计算：周长/面积/多边形/圆按教材册别收录，答案与公式一致', () => {
  assert.ok(VERSIONS.pep.books['math-3a'].types.includes('perimeter'));
  assert.ok(VERSIONS.jijiao.books['math-3a'].types.includes('perimeter'));
  assert.ok(VERSIONS.pep.books['math-3b'].types.includes('area'));
  assert.ok(VERSIONS.jijiao.books['math-3b'].types.includes('area'));
  assert.ok(VERSIONS.pep.books['math-5a'].types.includes('polygon-area'));
  assert.ok(VERSIONS.jijiao.books['math-5a'].types.includes('polygon-area'));
  assert.ok(VERSIONS.pep.books['math-6a'].types.includes('circle'));
  assert.ok(VERSIONS.jijiao.books['math-6a'].types.includes('circle'));

  const nums = (s) => s.match(/\d+(?:\.\d+)?/g).map(Number);
  for (const q of buildMathSheet({ bookId: 'math-3a', options: { version: 'pep', count: 20, types: ['perimeter'] } }).questions) {
    const [a, b] = nums(q.stem);
    assert.equal(Number(q.answer), q.stem.includes('正方形') ? 4 * a : 2 * (a + b), q.stem);
  }
  for (const q of buildMathSheet({ bookId: 'math-3b', options: { version: 'jijiao', count: 20, types: ['area'] } }).questions) {
    const [a, b] = nums(q.stem);
    assert.equal(Number(q.answer), q.stem.includes('正方形') ? a * a : a * b, q.stem);
  }
  for (const q of buildMathSheet({ bookId: 'math-5a', options: { version: 'pep', count: 20, types: ['polygon-area'] } }).questions) {
    const n = nums(q.stem);
    const expect = q.stem.includes('平行四边形') ? n[0] * n[1]
      : q.stem.includes('三角形') ? n[0] * n[1] / 2
        : (n[0] + n[1]) * n[2] / 2;
    assert.equal(Number(q.answer), expect, q.stem);
  }
  for (const q of buildMathSheet({ bookId: 'math-6a', options: { version: 'jijiao', count: 20, types: ['circle'] } }).questions) {
    const n = nums(q.stem);
    const answer = Number(q.answer);
    if (q.stem.startsWith('圆的周长')) assert.equal(answer, Math.round(n[0] / 3.14), q.stem);
    else if (q.stem.includes('周长')) assert.ok(Math.abs(answer - 2 * 3.14 * n[0]) < 0.005, q.stem);
    else assert.ok(Math.abs(answer - 3.14 * n[0] * n[0]) < 0.005, q.stem);
  }
  // 三下起面积单位（平方米/平方分米/平方厘米）进入换算池
  const s3 = buildMathSheet({ bookId: 'math-3b', options: { version: 'pep', count: 30, types: ['unit-convert'] } });
  assert.ok(s3.questions.some((q) => /平方/.test(q.stem)), '三下换算应含面积单位');
  // 周长/面积同步进入应用题知识点
  let knowledges = new Set();
  for (let i = 0; i < 5; i += 1) {
    const w = buildMathSheet({ bookId: 'math-3a', options: { version: 'pep', count: 10, types: ['word-problem'] } });
    w.questions.forEach((q) => knowledges.add(q.knowledge));
  }
  assert.ok(knowledges.has('perimeter'), '三上应用题应含周长应用');
});
