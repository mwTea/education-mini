// pages/index/index.js
const { getHistory } = require('../../utils/history');
const { request } = require('../../utils/request');
const { api } = require('../../config/index');

Page({
  data: {
    recent: [],
    stats: { lessons: 0, chars: 0 },
  },

  onShow() {
    this.setData({ recent: getHistory().slice(0, 3) });
    this.loadStats();
  },

  /** 首页「同步课文/生字」数字取自后端统计 */
  loadStats() {
    if (this._statsOk) return;
    request({ url: api.textbooks })
      .then((d) => {
        if (d && d.stats) {
          this._statsOk = true;
          this.setData({
            stats: { lessons: d.stats.lessons || 0, chars: d.stats.distinctChars || 0 },
          });
        }
      })
      .catch(() => { /* 统计拉取失败不影响使用 */ });
  },


  goChinese() {
    wx.navigateTo({ url: '/pages/chinese/chinese' });
  },

  goEnglish() {
    wx.navigateTo({ url: '/pages/english/english' });
  },

  goNameSheet() {
    wx.showModal({
      title: '名字字帖',
      editable: true,
      placeholderText: '输入孩子姓名，如：李小明',
      success: (r) => {
        if (!r.confirm || !r.content || !r.content.trim()) return;
        const name = r.content.trim();
        wx.navigateTo({
          url: `/pages/chinese/chinese?chars=${encodeURIComponent(name)}&title=${encodeURIComponent(`${name}的名字`)}`,
        });
      },
    });
  },

  goDictation() {
    wx.navigateTo({ url: '/pages/chinese/chinese?mode=dictation' });
  },

  goEnglishDictation() {
    wx.navigateTo({ url: '/pages/english/english?mode=dictation' });
  },

  openSheet(e) {
    wx.navigateTo({ url: `/pages/preview/preview?id=${e.currentTarget.dataset.id}` });
  },

  goTextbookPick() {
    wx.navigateTo({ url: '/pages/chinese/chinese?from=textbook' });
  },

  goAbout() {
    wx.navigateTo({ url: '/pages/about/about' });
  },

  goRadicals() {
    wx.navigateTo({ url: '/pages/radicals/radicals' });
  },

  goMath() {
    wx.navigateTo({ url: '/pages/math/index/index' });
  },

  /** 首页直达在线口算：用上次配置（无则默认），跳过二级选择页 */
  goQuizFast() {
    let cfg = null;
    try { cfg = wx.getStorageSync('cb_math_last'); } catch (e) { /* 忽略 */ }
    if (!cfg || !cfg.bookId) cfg = { version: 'jijiao', bookId: 'math-4a', difficulty: 'standard', label: '冀教·四上·巩固' };
    const q = `version=${cfg.version}&bookId=${cfg.bookId}&diff=${cfg.difficulty || 'standard'}&label=${encodeURIComponent(cfg.label || '口算练习')}`;
    wx.navigateTo({ url: `/pages/math/quiz/quiz?${q}` });
  },

  onShareAppMessage() {
    return {
      title: '字帖出题器 · 生字/单词一键成帖，打印即练',
      path: '/pages/index/index',
      imageUrl: '/assets/share-card.png',
    };
  },

  /** 朋友圈分享（单页模式打开，页面为静态展示） */
  onShareTimeline() {
    return {
      title: '字帖出题器 · 生字/单词一键成帖，打印即练',
      query: '',
      imageUrl: '/assets/share-card.png',
    };
  },
});
