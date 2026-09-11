const learning = require('../../utils/learning');
Page({
  data: { summary: { count: 0, rate: null, days: 0, pending: 0 } },
  onShow() { this.setData({ summary: learning.summary() }); },
  goLearn() { wx.switchTab({ url: '/pages/learn/learn' }); }
});
