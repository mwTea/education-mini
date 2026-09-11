'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildChineseSheet } = require('../src/services/layout/chinese.service');
const { buildEnglishSheet } = require('../src/services/layout/english.service');

test('语文：每字一行，范字固定 + 描红可选 + 空白补满', () => {
  const sheet = buildChineseSheet({
    title: '测试',
    chars: '你我他天',
    options: { traceCount: 2 },
  });

  assert.equal(sheet.type, 'chinese');
  assert.equal(sheet.charCount, 4);
  assert.equal(sheet.options.charsPerRow, 12); // A4 推导
  assert.equal(sheet.options.rowsPerPage, 14); // 不带拼音

  // 每字一行：4 行 × 12 格
  assert.equal(sheet.pages[0].rows.length, 4);
  const row = sheet.pages[0].rows[0].cells;
  assert.equal(row.length, 12);
  assert.equal(row[0].style, 'demo'); // 范字固定第 1 格
  assert.equal(row.filter((c) => c.style === 'trace').length, 2); // 描红 2 格
  assert.equal(row.filter((c) => c.style === 'blank').length, 9); // 其余空白
  assert.equal(sheet.pages[0].rows[1].cells[0].char, '我');
});

test('语文：拼音只标注在行首（范字上方）', () => {
  const sheet = buildChineseSheet({ title: 't', chars: '大小口', options: { showPinyin: true } });
  const rows = sheet.pages[0].rows;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].cells[0].pinyin, 'dà');
  assert.equal(rows[0].cells[1].pinyin, null);
  assert.equal(rows[1].cells[0].pinyin, 'xiǎo');
  assert.equal(rows[2].cells[0].pinyin, 'kǒu');
  assert.equal(sheet.options.rowsPerPage, 11); // 带拼音每页 11 行
});

test('语文：手工拼音优先，数量不匹配时回落自动注音', () => {
  const ok = buildChineseSheet({ title: 't', chars: '你我', pinyin: 'ni wo' });
  assert.equal(ok.pages[0].rows[0].cells[0].pinyin, 'ni');

  const bad = buildChineseSheet({ title: 't', chars: '你我他', pinyin: 'ni wo' });
  assert.equal(bad.pages[0].rows[0].cells[0].pinyin, 'nǐ');
});

test('语文：听写模式整行空白 + 行首拼音', () => {
  const sheet = buildChineseSheet({
    title: 't',
    chars: '你我他',
    options: { mode: 'dictation', showPinyin: false },
  });
  const rows = sheet.pages[0].rows;
  assert.equal(rows.length, 3);
  rows.forEach((row) => {
    assert.equal(row.cells.length, 12);
    assert.ok(row.cells.every((c) => c.style === 'blank'));
  });
  assert.equal(sheet.options.showPinyin, true); // 听写卷强制显示拼音
  assert.equal(sheet.subtype, '听写卷');
  assert.equal(rows[0].cells[0].pinyin, 'nǐ');
});

test('语文：非法配置回落到默认值', () => {
  const sheet = buildChineseSheet({
    title: 't',
    chars: '永',
    options: { grid: 'round', mode: 'magic', font: 'songti', traceCount: 99, charsPerRow: 4, rowsPerPage: 4 },
  });
  assert.equal(sheet.options.grid, 'tian');
  assert.equal(sheet.options.mode, 'copy');
  assert.equal(sheet.options.font, 'kai');
  assert.equal(sheet.options.traceCount, 11); // 上限 = 每行格数 - 1
  assert.equal(sheet.options.charsPerRow, 12); // 用户传入的排版参数被忽略，A4 推导
  assert.equal(sheet.options.rowsPerPage, 14);
});

test('语文：生字卡片模式（整卡布局）', () => {
  const sheet = buildChineseSheet({
    title: 't',
    chars: '据永',
    options: { mode: 'card', traceCount: 3 },
  });
  assert.equal(sheet.subtype, '生字卡片');
  const rows = sheet.pages[0].rows;
  assert.equal(rows.length, 2); // 每字一张卡
  assert.equal(rows[0].kind, 'card');
  assert.equal(rows[0].char, '据');
  assert.equal(rows[0].practiceRows.length, 2); // 两行描红
  const cells = rows[0].practiceRows[0].cells;
  assert.equal(cells.length, 12);
  assert.equal(cells[0].style, 'demo');
  assert.equal(cells.filter((c) => c.style === 'trace').length, 3);
  assert.equal(rows[0].wordRows.length, 2); // 两行组词练习空白格
  assert.ok(rows[0].wordRows[0].cells.every((c) => c.style === 'blank'));
  assert.equal(rows[0].wordRows[0].cells.length, 12);
  // 超过 3 张卡自动分页（每页 3 卡）
  const many = buildChineseSheet({ title: 't', chars: '一二三四五六七八九十', options: { mode: 'card' } });
  assert.equal(many.pages.length, 4);
});

test('语文：生字卡片数据完备时带部首/笔画/结构/组词', () => {
  const { available } = require('../src/services/hanzi.service');
  if (!available().dictionary || !available().words) {
    console.warn('跳过：汉字数据未安装（运行 scripts/fetch-hanzi-data.sh）');
    return;
  }
  const sheet = buildChineseSheet({ title: 't', chars: '据', options: { mode: 'card' } });
  const card = sheet.pages[0].rows[0];
  assert.equal(card.pinyin, 'jù');
  assert.equal(card.meta.radical, '扌');
  assert.ok(card.meta.strokes >= 8);
  assert.ok(card.words.includes('根据'));
});

test('语文：字体选项正楷/行楷', () => {
  const xk = buildChineseSheet({ title: 't', chars: '永', options: { font: 'xingkai' } });
  assert.equal(xk.options.font, 'xingkai');
});

test('语文：超过每页行数自动分页', () => {
  const chars = Array.from({ length: 15 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('');
  const sheet = buildChineseSheet({ title: 't', chars }); // 不带拼音 → 每页 14 行
  assert.equal(sheet.pages.length, 2);
  assert.equal(sheet.pages[0].rows.length, 14);
  assert.equal(sheet.pages[1].rows.length, 1);
});

test('英语：抄写模式每词一组（描红×N + 练习×M 依次排列）', () => {
  const sheet = buildEnglishSheet({
    title: 't',
    text: 'good day',
    options: { letterCase: 'upper', traceCount: 1, blankCount: 1, cellsPerLine: 30, rowsPerPage: 10 },
  });

  assert.equal(sheet.type, 'english');
  assert.equal(sheet.pages.length, 1);

  const cells = sheet.pages[0].rows[0].cells;
  const joined = cells.map((c) => c.char).join('');
  assert.equal(joined, 'GOOD GOOD DAY DAY'); // 每词：1 描红 + 1 空白
  const goodCells = cells.slice(0, 4);
  const goodBlank = cells.slice(5, 9);
  assert.ok(goodCells.every((c) => c.style === 'trace'));
  assert.ok(goodBlank.every((c) => c.style === 'blank'));
  assert.equal(cells[4].style, 'gap'); // 单词间隔格
  // 词义携带
  // 释义格式随词表版本可为「adj. 好的」或纯释义「好的」（2024 新版课本无词性前缀）
  assert.ok(/^adj\. 好的$|^好的$/.test(sheet.wordHints.GOOD));
});

test('英语：默写方向——中译英提示中文、英译汉提示英文', () => {
  const zh2en = buildEnglishSheet({
    title: 't',
    text: 'mom dad',
    options: { mode: 'dictation', dictationDir: 'zh2en', blankCount: 1 },
  });
  const rows = zh2en.pages[0].rows;
  assert.equal(rows[0].kind, 'hint');
  assert.ok(rows[0].text.includes('妈妈'));
  assert.equal(rows[1].kind, 'erow');
  assert.ok(rows[1].width >= 6); // 四线格宽度与单词长度一致

  const en2zh = buildEnglishSheet({
    title: 't',
    text: 'mom dad',
    options: { mode: 'dictation', dictationDir: 'en2zh', blankCount: 1 },
  });
  const rows2 = en2zh.pages[0].rows;
  assert.equal(rows2[0].kind, 'hint');
  assert.ok(rows2[0].text.includes('mom'));
  assert.equal(rows2[1].kind, 'fang');
  assert.equal(rows2[1].count, 4); // 写中文：方格行

  // 非法方向回落默认
  const bad = buildEnglishSheet({ title: 't', text: 'mom', options: { mode: 'dictation', dictationDir: 'xx' } });
  assert.equal(bad.options.dictationDir, 'zh2en');
});

test('英语：默写模式出报词栏 + 全空白行', () => {
  const sheet = buildEnglishSheet({
    title: 't',
    text: 'good morning',
    options: { mode: 'dictation', blankCount: 2 },
  });
  assert.deepEqual(sheet.wordBank, ['good', 'morning']);
  const rows = sheet.pages[0].rows;
  assert.equal(rows.length, 6); // 每词：1 提示行 + 2 书写行
  assert.equal(rows[0].kind, 'hint');
  assert.ok(rows[0].text.includes('好的'));
  assert.equal(rows[1].kind, 'erow');
  assert.ok(rows[2].kind === 'erow');
  assert.ok(rows[3].text.includes('早晨'));
});

test('英语：字符流按每行格数折行、行首无空格', () => {
  const sheet = buildEnglishSheet({
    title: 't',
    text: 'international hello',
    options: { cellsPerLine: 12, traceCount: 1, blankCount: 1 },
  });
  const rows = sheet.pages[0].rows;
  rows.forEach((r) => {
    assert.ok(r.cells.length <= 12);
    assert.notEqual(r.cells[0].style, 'gap'); // 行首不留空格格
  });
  // international 为 13 字母 > 行宽，硬切分为 12+1；hello 正常同排
  assert.equal(rows.length, 5);
  assert.equal(rows[0].cells.length, 12);
  assert.equal(rows[1].cells.length, 1);
  assert.equal(rows[4].cells.map((c) => c.char).join(''), 'hello hello');
});

test('体量上限：语文练习/听写单份最多 30 字（超出截断）', () => {
  const chars = Array.from({ length: 40 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('');
  const sheet = buildChineseSheet({ title: 't', chars });
  assert.equal(sheet.charCount, 30);
});

test('体量上限：生字卡片单份最多 20 字', () => {
  const chars = Array.from({ length: 28 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('');
  const sheet = buildChineseSheet({ title: 't', chars, options: { mode: 'card' } });
  assert.equal(sheet.charCount, 20);
  // 每页 3 卡 → 7 页
  assert.equal(sheet.pages.length, 7);
});

test('体量上限：英语单份最多 30 词（按词截断，不切半个词）', () => {
  const words = Array.from({ length: 50 }, (_, i) => `w${i}`).join(' ');
  const sheet = buildEnglishSheet({ title: 't', text: words, options: { mode: 'dictation' } });
  assert.equal(sheet.wordBank.length, 30);
  assert.equal(sheet.wordBank[29], 'w29');
  assert.ok(!sheet.wordBank.includes('w30'));
});

test('默写：中译英遇到无释义单词时整卷自动降级为英译汉', () => {
  // zzqqxx 一定查不到中文释义
  const sheet = buildEnglishSheet({
    title: 't',
    text: 'apple zzqqxx',
    options: { mode: 'dictation', dictationDir: 'zh2en', blankCount: 1 },
  });
  assert.equal(sheet.options.dictationDir, 'en2zh');
  assert.ok(sheet.dictationNote && sheet.dictationNote.includes('英译汉'));
  // 全部有释义时保持中译英
  const keep = buildEnglishSheet({
    title: 't',
    text: 'apple banana',
    options: { mode: 'dictation', dictationDir: 'zh2en', blankCount: 1 },
  });
  assert.equal(keep.options.dictationDir, 'zh2en');
});

test('英语：默写时按词典还原短语（gingerbread house 不拆成两个词）', () => {
  const sheet = buildEnglishSheet({
    title: 't',
    text: 'was climb gingerbread house new zealand paris',
    options: { mode: 'dictation', dictationDir: 'zh2en', blankCount: 1 },
  });
  assert.deepEqual(sheet.wordBank, ['was', 'climb', 'gingerbread house', 'new zealand', 'paris']);
  // 短语释义齐全 → 不降级
  assert.equal(sheet.options.dictationDir, 'zh2en');
  assert.ok(sheet.wordHints['gingerbread house']);
  const hints = sheet.pages[0].rows.filter((r) => r.kind === 'hint').map((r) => r.text);
  assert.ok(hints[2].includes('姜饼屋'), `提示行应含短语释义: ${hints[2]}`);
});
