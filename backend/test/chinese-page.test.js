'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let pageDefinition;
const oldPage = global.Page;
global.Page = (definition) => { pageDefinition = definition; };
require('../../miniprogram/pages/chinese/chinese');
global.Page = oldPage;

function context() {
  return {
    data: {
      modalBookIndex: 0,
      modalSections: [{
        label: '课文',
        lessons: [
          { index: 0, title: '第1课', charCount: 2, selected: false },
          { index: 1, title: '第2课', charCount: 3, selected: false },
        ],
      }],
    },
    books: [{ id: 'book-1' }],
    lessonsCache: {
      'book-1': [
        { title: '第1课', chars: '天地' },
        { title: '第2课', chars: '人山水' },
      ],
    },
    selectedLessonIndex: -1,
    refreshSelection: pageDefinition.refreshSelection,
    setData(patch) { this.data = { ...this.data, ...patch }; },
  };
}

test('语文教材课文一次只能选择一课，选择新课替换旧课', () => {
  const ctx = context();
  pageDefinition.onModalLessonClick.call(ctx, { currentTarget: { dataset: { index: 0 } } });
  assert.equal(ctx.selectedLessonIndex, 0);
  assert.equal(ctx.data.selectedCount, 1);
  assert.equal(ctx.data.selectedCharCount, 2);
  assert.deepEqual(ctx.data.modalSections[0].lessons.map((lesson) => lesson.selected), [true, false]);

  pageDefinition.onModalLessonClick.call(ctx, { currentTarget: { dataset: { index: 1 } } });
  assert.equal(ctx.selectedLessonIndex, 1);
  assert.equal(ctx.data.selectedCount, 1);
  assert.equal(ctx.data.selectedCharCount, 3);
  assert.deepEqual(ctx.data.modalSections[0].lessons.map((lesson) => lesson.selected), [false, true]);
});

test('再次点击当前课会取消选择', () => {
  const ctx = context();
  pageDefinition.onModalLessonClick.call(ctx, { currentTarget: { dataset: { index: 0 } } });
  pageDefinition.onModalLessonClick.call(ctx, { currentTarget: { dataset: { index: 0 } } });
  assert.equal(ctx.selectedLessonIndex, -1);
  assert.equal(ctx.data.selectedCount, 0);
  assert.equal(ctx.data.selectedCharCount, 0);
});
