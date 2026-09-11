'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function harness() {
  const store = new Map();
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  const wx = { getStorageSync: (k) => store.get(k), setStorageSync: (k, v) => store.set(k, JSON.parse(JSON.stringify(v))), showToast() {} };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../miniprogram/utils/learning.js'), 'utf8'), { wx, module, Date: Clock });
  return { learning: module.exports, advance: (days) => { now += days * 86400000; } };
}

test('复习按册别隔离，立即重练不算掌握，两次间隔复习后移出', () => {
  const { learning, advance } = harness();
  const cfg = { version: 'jijiao', bookId: 'math-2b' }, q = { type: 'add-100', stem: '20 + 30 =', answer: '50' };
  learning.record(cfg, [q], [q], 10, false);
  assert.equal(learning.reviewQuestions(cfg).length, 0);
  assert.equal(learning.reviewQuestions({ ...cfg, bookId: 'math-1a' }, false).length, 0);
  learning.record(cfg, [q], [], 5, true);
  assert.equal(learning.summary(cfg).pending, 1);
  advance(1);
  assert.equal(learning.reviewQuestions(cfg).length, 1);
  learning.record(cfg, [q], [], 5, true);
  assert.equal(learning.summary(cfg).pending, 1);
  advance(3);
  learning.record(cfg, [q], [], 5, true);
  assert.equal(learning.summary(cfg).pending, 0);
});

test('错题重练把原错题传入 start 的第一个参数', () => {
  let page, captured;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../miniprogram/pages/math/quiz/quiz.js'), 'utf8'), { require: () => ({}), Page: (p) => { page = p; } });
  const wrongs = [{ stem: '2 + 3 =', answer: '5' }];
  page.onWrongRetry.call({ _wrongs: wrongs, start: (questions) => { captured = questions; } });
  assert.equal(captured[0], wrongs[0]);
  assert.notEqual(captured, wrongs);
});

test('小数等值输入可自动提交；提交期间重复点击不会重复加分', () => {
  let page, advances = 0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../miniprogram/pages/math/quiz/quiz.js'), 'utf8'), {
    require: () => ({}), Page: (p) => { page = p; }, setTimeout: () => { advances += 1; },
  });
  const ctx = { data: { stage: 'quiz', input: '', feedback: '', score: 0, cur: { answer: '3.0' } }, setData(p) { Object.assign(this.data, p); } };
  page.onKey.call(ctx, { currentTarget: { dataset: { k: '3' } } });
  page.onKey.call(ctx, { currentTarget: { dataset: { k: '3' } } });
  assert.equal(ctx.data.score, 1);
  assert.equal(advances, 1);
});
