// 数学口算 · 题型配置页：摘要头就地调参 + 常用模板一键 + 题型例题预览
const { request } = require('../../../utils/request');
const { api } = require('../../../config/index');
const { addHistory } = require('../../../utils/history');

const DIFFS = [
  { id: 'basic', name: '基础' },
  { id: 'standard', name: '巩固' },
  { id: 'advanced', name: '培优' },
];

// 各题型的展示例题（与后端生成规则一致，仅作预览）
const TYPE_EG = {
  'clock-read': '看钟面写时间', 'clock-draw': '根据时间画时针和分针',
  'add-10': '3 + 5 =', 'sub-10': '9 - 4 =', 'add-20': '7 + 8 =', 'sub-20': '13 - 6 =',
  'add-100': '36 + 47 =', 'sub-100': '82 - 35 =', 'bracket-add': '( ) + 4 = 9',
  'bracket-sub': '15 - ( ) = 7', 'chain-add': '3 + 4 + 2 =', 'chain-sub': '10 - 3 - 2 =',
  'compare': '6 ○ 8', 'mul-table': '6 × 7 =', 'mul-inverse': '( ) × 6 = 42',
  'div-table': '56 ÷ 8 =', 'mul-1digit': '324 × 3 =', 'div-remainder': '47 ÷ 5 =',
  'add-10000': '1236 + 2857 =', 'sub-10000': '4300 - 1576 =', 'mul-2digit': '23 × 16 =',
  'mixed-2step': '20 + 4 × 6 =', 'mixed-paren': '(3 + 5) × 4 =', 'vertical-mul': '234 × 21（竖式）', 'vertical-decimal': '3.6 + 2.8（竖式）', 'div-2digit': '966 ÷ 23 =', 'time-elapsed': '8:20 出发经过 40 分钟', 'div-1digit': '84 ÷ 7 =',
  'decimal-sub': '7.9 - 1.1 =', 'decimal-div': '36.9 ÷ 9 =', 'fraction-add2': '3/5 + 1/5 =',
  'decimal-add': '3.6 + 2.8 =', 'decimal-mul': '2.5 × 4 =', 'fraction-add': '3/10 + 5/10 =',
  'percent': '120 的 25% =', 'unit-convert': '1米 = ( ) 厘米', 'word-problem': '应用题（含答题区）',
};

const PRESETS = {
  daily: { count: 50, useRecommend: true },
  vertical: { count: 16, types: ['vertical-mul', 'vertical-add', 'vertical-sub', 'vertical-div', 'vertical-decimal'] },
  word: { count: 10, types: ['word-problem'] },
};

Page({
  data: {
    bookId: '', bookName: '', version: 'pep', diff: 'standard', diffName: '巩固', count: 50, withAnswer: true,
    diffs: DIFFS, counts: [20, 50, 100],
    types: [], wordTopics: [], wordSelected: false, selectedCount: 0, preset: 'daily',
    submitting: false, quotaRemaining: null,
  },

  onLoad(q) {
    const diff = q.diff || 'standard';
    this.setData({
      bookId: q.bookId || 'math-1a',
      version: q.version === 'pep' ? 'pep' : 'jijiao',
      bookName: decodeURIComponent(q.bookName || '数学口算'),
      diff,
      diffName: (DIFFS.find((d) => d.id === diff) || DIFFS[1]).name,
      count: Number(q.count) || 50,
      withAnswer: q.answer !== '0',
    });
    this._recommendTypes = [];
    this.load();
    this.refreshQuota();
  },

  async load() {
    try {
      const d = await request({ url: `${api.mathbooks}?version=${this.data.version}` });
      const book = (d.items || []).find((b) => b.id === this.data.bookId);
      const all = ((book && book.types) || []).map((t) => ({ ...t, eg: t.eg || TYPE_EG[t.id] || '', selected: true }));
      this._recommendTypes = all.map((t) => t.id);
      this.setData({ types: all, selectedCount: all.length, wordSelected: all.some((t) => t.id === 'word-problem'),
        wordTopics: ((book && book.wordTopics) || []).map((t) => ({ ...t, selected: true })) });
      if (this._restoreSaved) {
        const s = wx.getStorageSync('cb_math_favorite');
        if (s && s.bookId === this.data.bookId && s.version === this.data.version) {
          const types = all.map((t) => ({ ...t, selected: s.types.includes(t.id) }));
          this.setData({ types, selectedCount: types.filter((t) => t.selected).length, diff: s.diff,
            diffName: (DIFFS.find((d) => d.id === s.diff) || DIFFS[1]).name, count: s.count, withAnswer: s.withAnswer, preset: '',
            wordSelected: types.some((t) => t.id === 'word-problem' && t.selected),
            wordTopics: this.data.wordTopics.map((t) => ({ ...t, selected: !s.wordTopics || s.wordTopics.includes(t.id) })) });
        }
      }
    } catch (e) {
      wx.showToast({ title: '题型加载失败', icon: 'none' });
    }
  },

  async refreshQuota() {
    try {
      const r = await request({ url: api.quota });
      this.setData({ quotaRemaining: r.remaining });
    } catch (e) { /* 忽略 */ }
  },

  onDiffTap(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ diff: id, diffName: (DIFFS.find((d) => d.id === id) || DIFFS[1]).name, preset: '' });
  },
  onCountTap(e) { this.setData({ count: Number(e.currentTarget.dataset.v), preset: '' }); },
  onAnswerToggle(e) { this.setData({ withAnswer: e.detail.value }); },

  onPresetTap(e) {
    const key = e.currentTarget.dataset.p;
    const p = PRESETS[key];
    if (!p) return;
    // 专项预设只在本册含该题型时生效，否则提示且不清空已选
    if (p.types) {
      const has = this.data.types.some((t) => p.types.includes(t.id));
      if (!has) {
        wx.showToast({ title: '本册暂无这个专项题型', icon: 'none' });
        return;
      }
    }
    const patch = { preset: key, count: p.count };
    if (p.types) {
      patch.types = this.data.types.map((t) => ({ ...t, selected: p.types.includes(t.id) }));
    } else if (p.useRecommend) {
      patch.types = this.data.types.map((t) => ({ ...t, selected: this._recommendTypes.includes(t.id) }));
    }
    patch.selectedCount = patch.types ? patch.types.filter((t) => t.selected).length : this.data.selectedCount;
    patch.wordSelected = (patch.types || this.data.types).some((t) => t.id === 'word-problem' && t.selected);
    this.setData(patch);
  },

  onTypeTap(e) {
    const i = Number(e.currentTarget.dataset.index);
    const next = !this.data.types[i].selected;
    this.setData({
      [`types[${i}].selected`]: next,
      selectedCount: this.data.selectedCount + (next ? 1 : -1),
      preset: '',
      wordSelected: this.data.types[i].id === 'word-problem' ? next : this.data.wordSelected,
    });
  },
  onSelectAll() { const ts = this.data.types.map((t) => ({ ...t, selected: true })); this.setData({ types: ts, selectedCount: ts.length, wordSelected: ts.some((t) => t.id === 'word-problem'), preset: '' }); },
  onClearAll() { this.setData({ types: this.data.types.map((t) => ({ ...t, selected: false })), selectedCount: 0, wordSelected: false, preset: '' }); },
  onRecommend() {
    const ts = this.data.types.map((t) => ({ ...t, selected: this._recommendTypes.includes(t.id) }));
    this.setData({ types: ts, selectedCount: ts.filter((t) => t.selected).length, wordSelected: ts.some((t) => t.id === 'word-problem' && t.selected), preset: 'daily' });
  },

  onWordTopicTap(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ wordTopics: this.data.wordTopics.map((t) => t.id === id ? { ...t, selected: !t.selected } : t) });
  },

  async onGenerate() {
    if (this.data.submitting) return;
    const picked = this.data.types.filter((t) => t.selected);
    const wordTopics = this.data.wordTopics.filter((t) => t.selected).map((t) => t.id);
    if (this.data.wordSelected && this.data.wordTopics.length && !wordTopics.length) {
      wx.showToast({ title: '请选择应用题知识点', icon: 'none' }); return;
    }
    if (!picked.length) {
      wx.showToast({ title: '请至少选择一种题型', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const res = await request({
        url: api.createSheet,
        method: 'POST',
        data: {
          type: 'math',
          title: `${this.data.bookName}练习`,
          content: { bookId: this.data.bookId, version: this.data.version },
          options: {
            difficulty: this.data.diff,
            count: this.data.count,
            withAnswer: this.data.withAnswer,
            types: picked.map((t) => t.id),
            wordTopics,
          },
        },
      });
      addHistory({ id: res.id, type: 'math', title: res.title, pageCount: res.pageCount, dateText: '' });
      wx.navigateTo({ url: `/pages/preview/preview?id=${res.id}` });
      this.refreshQuota();
    } catch (err) {
      if (err.code === 'DAILY_LIMIT') {
        wx.showModal({ title: '今日生成已达上限', content: `${err.message}。`, showCancel: false });
        this.setData({ quotaRemaining: 0 });
      } else {
        wx.showToast({ title: err.message, icon: 'none' });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },


  onShareAppMessage() {
    return { title: '配置口算题卡 · 题型跟教材', path: '/pages/math/index/index', imageUrl: '/assets/share-math.png' };
  },

  onShareTimeline() {
    return { title: '数学口算 · 跟课本进度', query: '', imageUrl: '/assets/share-math.png' };
  },
});
