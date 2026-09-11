const learning = require('../../utils/learning');
Page({
  data: {
    summary: { count: 0, rate: null, days: 0, pending: 0 },
    subjects: { zh: { count: 0, rate: null, days: 0 }, math: { count: 0, rate: null, days: 0 }, en: { count: 0, rate: null, days: 0 } },
  },
  onShow() {
    this.setData({ summary: learning.summary(), subjects: learning.subjectSummary() });
  },
  goLearn() { wx.switchTab({ url: '/pages/learn/learn' }); }
});
