Page({
  openSubject(e) {
    const urls = { chinese: '/pages/chinese/chinese', math: '/pages/math/index/index', english: '/pages/english/english' };
    wx.navigateTo({ url: urls[e.currentTarget.dataset.key] });
  },
  goRadicals() { wx.navigateTo({ url: '/pages/radicals/radicals' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  comingSoon() { wx.showToast({ title: '将在后续打印版本开放', icon: 'none' }); }
});
