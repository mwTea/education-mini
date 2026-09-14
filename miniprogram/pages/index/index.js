// pages/index/index.js
const { getHistory } = require('../../utils/history');
const learning = require('../../utils/learning');

/** 今日练习目标题数，用于首页进度条与「已练 x/y 题」 */
const DAILY_GOAL = 10;

Page({
  data: {
    recent: [],
    todayCount: 0,
    dailyGoal: DAILY_GOAL,
    todayPercent: 0,
  },

  onShow() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const now = Date.now();
    const todayCount = learning.read().runs
      .filter((run) => run.at >= start.getTime() && run.at <= now)
      .reduce((sum, run) => sum + Math.max(0, Number(run.count) || 0), 0);
    const recent = getHistory().slice(0, 2).map((item) => {
      const saved = new Date(item.savedAt);
      const dateText = item.dateText || (Number.isFinite(saved.getTime())
        ? `${saved.getMonth() + 1}月${saved.getDate()}日` : '');
      return { ...item, dateText };
    });
    this.setData({
      recent,
      todayCount,
      todayPercent: Math.min(100, Math.round((todayCount / DAILY_GOAL) * 100)),
    });
  },

  /** 首页 banner「开启今日学习」直达学习 tab */
  goLearn() {
    wx.switchTab({ url: '/pages/learn/learn' });
  },


  goChinese() {
    wx.navigateTo({ url: '/pages/chinese/chinese' });
  },

  goEnglish() {
    wx.navigateTo({ url: '/pages/english/english' });
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

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
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

  goChineseQuiz() { wx.navigateTo({ url: '/pages/chinese/quiz/quiz' }); },
  goEnglishQuiz() { wx.navigateTo({ url: '/pages/english/quiz/quiz' }); },

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
