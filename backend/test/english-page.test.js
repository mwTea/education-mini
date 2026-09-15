'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let pageDefinition;
const oldPage = global.Page;
const oldWx = global.wx;
global.wx = {
  getSystemInfoSync: () => ({ platform: 'devtools' }),
  setNavigationBarTitle: () => {},
};
global.Page = (definition) => { pageDefinition = definition; };
require('../../miniprogram/pages/english/english');
global.Page = oldPage;
global.wx = oldWx;

function context(data = {}) {
  return {
    data: {
      ...pageDefinition.data,
      ...data,
    },
    books: [],
    setData(patch, callback) {
      this.data = { ...this.data, ...patch };
      if (callback) callback();
    },
    refreshPreview: pageDefinition.refreshPreview,
    refreshSummary: pageDefinition.refreshSummary,
  };
}

test('英语入口通过真实页面路由进入教材选择并重置推荐模式', () => {
  const ctx = context({
    sourceKind: 'pack',
    versionIndex: 0,
    gradeIndex: 0,
    semesterIndex: 0,
    practiceIndex: 2,
  });
  ctx.books = [{ id: 'pep-3a', name: '人教PEP英语三年级上册' }];
  ctx.prepareExercise = pageDefinition.prepareExercise;
  ctx.saveFlowDraft = pageDefinition.saveFlowDraft;
  ctx.navigateStage = pageDefinition.navigateStage;

  const savedWx = global.wx;
  let route = '';
  global.wx = { navigateTo: ({ url }) => { route = url; } };
  pageDefinition.chooseExercise.call(ctx, { currentTarget: { dataset: { type: 'sentence' } } });
  global.wx = savedWx;

  assert.equal(ctx.data.sourceKind, 'textbook');
  assert.equal(ctx.data.practiceIndex, 0);
  assert.match(route, /^\/pages\/english\/english\?stage=select&type=sentence&source=textbook/);
  assert.equal(ctx.data.stage, 'home');
});

test('英语配置预览覆盖听写单词和听写句子', () => {
  const unit = {
    words: [{ word: 'friend', meaning: '朋友' }],
    sentences: [{ text: "Let's play!", translation: '我们一起玩吧！' }],
  };
  const ctx = context({
    currentUnit: unit,
    exerciseType: 'word',
    practiceModes: [{ id: 'copy' }, { id: 'zh2en' }],
    practiceIndex: 1,
  });

  pageDefinition.refreshPreview.call(ctx);
  assert.equal(ctx.data.preview.primary, '朋友');
  assert.equal(ctx.data.preview.answer, 'friend');

  ctx.data.exerciseType = 'sentence';
  ctx.data.practiceModes = [{ id: 'copy' }, { id: 'zh2en' }];
  ctx.data.practiceIndex = 1;
  pageDefinition.refreshPreview.call(ctx);
  assert.equal(ctx.data.preview.primary, '我们一起玩吧！');
  assert.equal(ctx.data.preview.answer, "Let's play!");
});

test('英语字体默认衡水体，切换字体后写入样式摘要', () => {
  const ctx = context({ fontIndex: 0 });
  pageDefinition.refreshSummary.call(ctx);
  assert.match(ctx.data.styleSummary, /^衡水体/);
  ctx.data.fontIndex = 2;
  pageDefinition.refreshSummary.call(ctx);
  assert.match(ctx.data.styleSummary, /^圆润体/);
});

test('英语听写样式固定为每题一行四线三格', () => {
  const ctx = context({
    exerciseType: 'sentence',
    practiceIndex: 1,
    blankCount: 4,
  });
  pageDefinition.refreshSummary.call(ctx);
  assert.match(ctx.data.styleSummary, /每题一行四线三格/);
  assert.doesNotMatch(ctx.data.styleSummary, /每题 4 行/);
});
