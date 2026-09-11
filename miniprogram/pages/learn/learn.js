// 学习页：在线练习专区。数学口算、语文看拼音选字、英语记词拼单词。
Page({
  goQuiz() { wx.navigateTo({ url: '/pages/math/quiz/quiz' }); },

  goChineseQuiz() { wx.navigateTo({ url: '/pages/chinese/quiz/quiz' }); },

  goEnglishQuiz() { wx.navigateTo({ url: '/pages/english/quiz/quiz' }); },

  /** 沿用上次口算配置（无则默认），直达在线作答 */
  goQuizFast() {
    let cfg = null;
    try { cfg = wx.getStorageSync('cb_math_last'); } catch (e) { /* 忽略 */ }
    if (!cfg || !cfg.bookId) cfg = { version: 'jijiao', bookId: 'math-4a', difficulty: 'standard', label: '冀教·四上·巩固' };
    const q = `version=${cfg.version}&bookId=${cfg.bookId}&diff=${cfg.difficulty || 'standard'}&label=${encodeURIComponent(cfg.label || '口算练习')}`;
    wx.navigateTo({ url: `/pages/math/quiz/quiz?${q}` });
  },

  comingSoon() {
    wx.showToast({ title: '在线练习即将开放', icon: 'none' });
  }
});
