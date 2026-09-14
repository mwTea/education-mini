'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const textbooks = require('../src/services/textbook.service');
const root = path.resolve(__dirname, '../../miniprogram');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const tap = (dataset) => ({ currentTarget: { dataset } });

function loadPage(file, modules, wx = {}, extra = {}) {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    require: (id) => {
      const name = id.split('/').pop();
      assert.ok(name in modules, `Unexpected dependency: ${id}`);
      return modules[name];
    },
    Page: (definition) => { page = definition; }, wx,
    setTimeout: () => 1, clearTimeout() {}, ...extra,
  });
  page.setData = function (patch) { Object.assign(this.data, patch); };
  return page;
}

function chinese(customRequest, storage = new Map()) {
  const requests = [], toasts = [], logs = [];
  const request = ({ url }) => {
    requests.push(url);
    if (customRequest) return customRequest(url);
    return Promise.resolve(url === '/books' ? { items: textbooks.list() } : { book: textbooks.detail(url.split('/').pop()) });
  };
  const page = loadPage('pages/chinese/quiz/quiz.js', {
    request: { request }, index: { api: { textbooks: '/books', textbook: (id) => `/books/${id}` } },
    learning: { logRun: (...args) => logs.push(args) },
  }, {
    getStorageSync: (k) => storage.get(k), setStorageSync: (k, v) => storage.set(k, v),
    removeStorageSync: (k) => storage.delete(k), showToast: (v) => toasts.push(v), showModal() {},
  });
  return { page, requests, storage, toasts, logs };
}

test('语文按档案默认年级打开，全部12册均可选课并生成本册练习', async () => {
  const { page, storage } = chinese(undefined, new Map([['cb_grade', '4']]));
  page.onLoad();
  await flush();
  assert.equal(page.bookId(), 'rj-yuwen-4a');
  assert.equal(page.data.grades.length, 6);
  assert.equal(page.data.books.length, 12);
  for (let grade = 1; grade <= 6; grade++) {
    page.onGradeTap(tap({ grade }));
    await flush();
    for (const sem of ['a', 'b']) {
      page.onSemTap(tap({ sem }));
      await flush();
      assert.equal(page._book.id, `rj-yuwen-${grade}${sem}`);
      assert.equal(page.data.semesters.length, 2);
      assert.ok(page.data.lessons.length > 0);
      assert.equal(page.data.outdated, false);
      page.onLessonTap(tap({ index: 0 }));
      assert.equal(page.data.stage, 'quiz');
      assert.ok(page.data.total > 0 && page.data.total <= 10);
      assert.ok(page._book.lessons[0].items.some((it) => it.ch === page.data.cur.answer));
      assert.equal(storage.get('cb_zh_quiz_progress').bookId, page._book.id);
      page.backToPick();
      await flush();
    }
  }
  assert.equal(storage.get('cb_grade'), '4', '练习切换不修改档案年级');
});

test('快速切换教材后，较慢的旧响应和旧错误都不能覆盖新册', async () => {
  const pending = [];
  const { page } = chinese((url) => {
    if (url === '/books') return Promise.resolve({ items: textbooks.list() });
    return new Promise((resolve, reject) => pending.push({ url, resolve, reject }));
  });
  page.onLoad();
  await flush();
  page.onGradeTap(tap({ grade: 3 }));
  page.onSemTap(tap({ sem: 'b' }));
  assert.equal(page._book, null);
  page.onLessonTap(tap({ index: 0 }));
  assert.equal(page.data.stage, 'pick');
  pending[2].resolve({ book: textbooks.detail('rj-yuwen-3b') });
  await flush();
  pending[0].resolve({ book: textbooks.detail('rj-yuwen-1a') });
  pending[1].reject(new Error('old request failed'));
  await flush();
  assert.equal(page._book.id, 'rj-yuwen-3b');
  assert.equal(page.data.bookName, textbooks.get('rj-yuwen-3b').name);
  assert.equal(page.data.loadError, '');
  assert.equal(page.data.loading, false);
});

test('列表失败可重试；缺少档案年级和上册时选择实际存在的教材', async () => {
  let failed = true;
  const { page } = chinese((url) => {
    if (failed) return Promise.reject(new Error('offline'));
    return Promise.resolve(url === '/books'
      ? { items: [textbooks.list().find((b) => b.id === 'rj-yuwen-2b')] }
      : { book: textbooks.detail('rj-yuwen-2b') });
  });
  await page.loadBooks();
  assert.match(page.data.loadError, /列表加载失败/);
  failed = false;
  await page.onReload();
  assert.equal(page.bookId(), 'rj-yuwen-2b');
  assert.equal(page.data.grades.length, 1);
  assert.equal(page.data.semesters[0].value, 'b');
  page.onGradeTap(tap({ grade: 6 }));
  page.onSemTap(tap({ sem: 'a' }));
  assert.equal(page.bookId(), 'rj-yuwen-2b');
});

test('课本失败清空旧课，重试后恢复，不能误点旧题', async () => {
  let failed = false;
  const { page } = chinese((url) => {
    if (url === '/books') return Promise.resolve({ items: textbooks.list() });
    if (failed) return Promise.reject(new Error('offline'));
    return Promise.resolve({ book: textbooks.detail(url.split('/').pop()) });
  });
  await page.loadBooks();
  failed = true;
  page.onGradeTap(tap({ grade: 2 }));
  await flush();
  assert.equal(page.data.lessons.length, 0);
  assert.match(page.data.loadError, /课本加载失败/);
  page.onLessonTap(tap({ index: 0 }));
  assert.equal(page.data.stage, 'pick');
  failed = false;
  await page.onReload();
  assert.equal(page._book.id, 'rj-yuwen-2a');
  assert.equal(page.data.loadError, '');
});

test('跨年级续练在目录返回前恢复，返回选课/重练/记账均使用续练册', async () => {
  let resolveList;
  const { page, logs } = chinese((url) => {
    if (url === '/books') return new Promise((resolve) => { resolveList = resolve; });
    return Promise.resolve({ book: textbooks.detail(url.split('/').pop()) });
  });
  page.onLoad();
  const lesson = textbooks.detail('rj-yuwen-6b').lessons[0];
  page.resume({ grade: 6, sem: 'b', bookName: '六下', qs: [{ py: 'zì', answer: '字', options: ['字', '子'] }], idx: 0, score: 0, lesson });
  await flush();
  resolveList({ items: textbooks.list() });
  await flush();
  assert.equal(page.data.stage, 'quiz');
  assert.equal(page._book.id, 'rj-yuwen-6b');
  page.finish();
  assert.equal(logs[0][1].bookId, 'rj-yuwen-6b');
  page.onRetry();
  assert.ok(page.data.cur.options.every((ch) => page._allChars.includes(ch)));
  page.backToPick();
  await flush();
  assert.equal(page._book.id, 'rj-yuwen-6b');
  assert.equal(page.data.semesters.length, 2);
  assert.equal(page.data.lessons[0].title, lesson.title);
});

test('目录为空有明确状态，非法档案年级回退一年级', async () => {
  const empty = chinese(() => Promise.resolve({ items: [] })).page;
  await empty.loadBooks();
  assert.match(empty.data.loadError, /暂无可用教材/);
  const { page } = chinese(undefined, new Map([['cb_grade', 99]]));
  page.onLoad();
  await flush();
  assert.equal(page.bookId(), 'rj-yuwen-1a');
});

test('首页汇总当天三科记录，排除昨天/未来记录；最近生成只取两条', () => {
  const now = new Date(2026, 8, 11, 14).getTime();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const dayStart = new Date(2026, 8, 11).getTime();
  let runs = [
    { at: dayStart - 1, count: 99 }, { at: dayStart, count: 10, subject: 'zh' },
    { at: now - 1, count: 20, subject: 'math' }, { at: now, count: 5, subject: 'en' },
    { at: now + 1, count: 99 },
  ];
  let history = [
    { id: 'a', title: '题卡', savedAt: now, dateText: '' },
    { id: 'b', title: '字帖', dateText: '今天' }, { id: 'c', title: '旧记录' },
  ];
  const page = loadPage('pages/index/index.js', {
    history: { getHistory: () => history }, learning: { read: () => ({ runs }) },
  }, {}, { Date: Clock });
  page.onShow();
  assert.equal(page.data.todayCount, 35);
  assert.equal(page.data.recent.length, 2);
  assert.equal(page.data.recent[0].dateText, '9月11日');
  assert.equal(page.data.recent[1].dateText, '今天');
  runs = []; history = [];
  page.onShow();
  assert.equal(page.data.todayCount, 0);
  assert.equal(page.data.recent.length, 0);
});

test('首页练习与打印进入不同页面，全部历史与单条预览入口有效', () => {
  const routes = [];
  const page = loadPage('pages/index/index.js', {
    history: { getHistory: () => [] }, learning: { read: () => ({ runs: [] }) },
  }, { navigateTo: ({ url }) => routes.push(url), getStorageSync: () => null });
  page.goChineseQuiz(); page.goQuizFast(); page.goEnglishQuiz();
  page.goChinese(); page.goMath(); page.goEnglish(); page.goHistory();
  page.openSheet(tap({ id: 'sheet-1' }));
  assert.equal(routes[0], '/pages/chinese/quiz/quiz');
  assert.match(routes[1], /^\/pages\/math\/quiz\/quiz\?/);
  assert.equal(routes[2], '/pages/english/quiz/quiz');
  assert.equal(routes[3], '/pages/chinese/chinese');
  assert.equal(routes[4], '/pages/math/index/index');
  assert.equal(routes[5], '/pages/english/english');
  assert.equal(routes[6], '/pages/history/history');
  assert.equal(routes[7], '/pages/preview/preview?id=sheet-1');
  const registered = JSON.parse(fs.readFileSync(path.join(root, 'app.json'))).pages;
  routes.forEach((url) => assert.ok(registered.includes(url.slice(1).split('?')[0])));
});
