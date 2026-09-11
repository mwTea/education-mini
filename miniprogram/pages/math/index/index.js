// 数学 · 二级页：在线练习（高频）+ 打印流配置（版本/年级/难度）
const { request } = require('../../../utils/request');
const { api } = require('../../../config/index');
const learning = require('../../../utils/learning');

const DIFFS = [
  { id: 'basic', name: '基础', tip: '本学期最小要求，如 100 以内不进位' },
  { id: 'standard', name: '巩固', tip: '常规练习难度，含进退位' },
  { id: 'advanced', name: '培优', tip: '在本册所选知识点内增加练习难度' },
];
const V_LABEL = { pep: '人教', jijiao: '冀教' };

Page({
  data: { books: [], bookIndex: 0, version: 'jijiao', diffs: DIFFS, diffIndex: 1, quizDesc: '', diffName: '巩固' },

  onLoad() { this.load(); },
  onShow() { this.syncDesc(); },

  async load() {
    try {
      const d = await request({ url: `${api.mathbooks}?version=${this.data.version}` });
      const books = (d.items || []).map((b) => {
        const m = b.name.match(/数学(.+)/);
        return { ...b, short: m ? m[1].replace('年级', '').replace('册', '') : b.name.slice(4) };
      });
      // 默认年级：个人中心所属年级（上册）> 上次配置 > 第一册
      let idx = 0;
      try {
        const last = wx.getStorageSync('cb_math_last');
        const grade = wx.getStorageSync('cb_grade');
        if (grade && books.some((b) => b.id === `math-${grade}a`)) idx = books.findIndex((b) => b.id === `math-${grade}a`);
        else if (last && last.bookId && books.some((b) => b.id === last.bookId)) idx = books.findIndex((b) => b.id === last.bookId);
      } catch (e) { /* 忽略 */ }
      this.setData({ books, bookIndex: idx });
      this.syncDesc();
    } catch (e) {
      wx.showToast({ title: '教材加载失败', icon: 'none' });
    }
  },
  syncDesc() {
    const b = this.data.books[this.data.bookIndex];
    const quizDesc = `${V_LABEL[this.data.version]}·${b ? b.short : ''}`;
    const diffName = DIFFS[this.data.diffIndex].name;
    this.setData({ quizDesc, diffName });
    this.setData({ learning: b ? learning.summary({ version: this.data.version, bookId: b.id }) : null });
    // 记忆当前教材与练习难度。
    if (b) {
      try {
        wx.setStorageSync('cb_math_last', { version: this.data.version, bookId: b.id, difficulty: DIFFS[this.data.diffIndex].id, label: `${quizDesc}·${diffName}` });
      } catch (e) { /* 忽略 */ }
    }
  },

  onVersionTap(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.version) return;
    this.setData({ version: v, bookIndex: 0 });
    this.load();
  },
  onBookTap(e) { this.setData({ bookIndex: Number(e.currentTarget.dataset.index) }); this.syncDesc(); },
  onDiffTap(e) { this.setData({ diffIndex: Number(e.currentTarget.dataset.index) }); this.syncDesc(); },

  goReview() {
    const b = this.data.books[this.data.bookIndex];
    if (!b) { wx.showToast({ title: '教材加载中，稍候', icon: 'none' }); return; }
    if (!this.data.learning || !this.data.learning.pending) {
      wx.showToast({ title: '本册暂无待复习错题', icon: 'none' }); return;
    }
    wx.navigateTo({ url: '/pages/math/quiz/quiz?review=1&version=' + this.data.version + '&bookId=' + b.id + '&diff=' + DIFFS[this.data.diffIndex].id });
  },

  goQuiz() {
    const b = this.data.books[this.data.bookIndex];
    if (!b) { wx.showToast({ title: '教材加载中，稍候', icon: 'none' }); return; }
    const q = `version=${this.data.version}&bookId=${b.id}&diff=${DIFFS[this.data.diffIndex].id}&label=${encodeURIComponent(this.data.quizDesc + '·' + DIFFS[this.data.diffIndex].name)}&from=page`;
    wx.navigateTo({ url: `/pages/math/quiz/quiz?${q}` });
  },
  goConfig() {
    const b = this.data.books[this.data.bookIndex];
    if (!b) { wx.showToast({ title: '教材加载中，稍候', icon: 'none' }); return; }
    const q = `version=${this.data.version}&bookId=${b.id}&bookName=${encodeURIComponent(b.name)}&diff=${DIFFS[this.data.diffIndex].id}&count=50&answer=1`;
    wx.navigateTo({ url: `/pages/math/config/config?${q}` });
  },
  get diffName() { return DIFFS[this.data.diffIndex].name; },

  onShareAppMessage() {
    return { title: '数学口算 · 跟课本进度，在线练+打印', path: '/pages/math/index/index', imageUrl: '/assets/share-math.png' };
  },

  onShareTimeline() {
    return { title: '数学口算 · 跟课本进度', query: '', imageUrl: '/assets/share-math.png' };
  },
});
