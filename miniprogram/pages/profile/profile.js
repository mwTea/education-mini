// 个人中心
const { request } = require('../../utils/request');
const { api } = require('../../config/index');

Page({
  data: { vip: false, vipUntil: '', quotaRemaining: null, grade: 0, grades: [1, 2, 3, 4, 5, 6] },

  onShow() {
    this.setData({ grade: wx.getStorageSync('cb_grade') || 0 });
    const vip = wx.getStorageSync('cb_vip') || false;
    this.setData({ vip, vipUntil: wx.getStorageSync('cb_vip_until') || '' });
    request({ url: api.quota })
      .then((r) => this.setData({ quotaRemaining: r.remaining }))
      .catch(() => {});
  },

  onGradeTap(e) {
    const g = Number(e.currentTarget.dataset.g);
    this.setData({ grade: g });
    try { wx.setStorageSync('cb_grade', g); } catch (err) { /* 忽略 */ }
    wx.showToast({ title: `已设为${g}年级，教材将默认该年级`, icon: 'none' });
  },

  goHistory() { wx.switchTab({ url: '/pages/history/history' }); },
  goRadicals() { wx.navigateTo({ url: '/pages/radicals/radicals' }); },
  goMath() { wx.navigateTo({ url: '/pages/math/index/index' }); },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); },

  onShareAppMessage() {
    return { title: '字帖出题器 · 语数英三科练习', path: '/pages/index/index', imageUrl: '/assets/share-card.png' };
  },

  onShareTimeline() {
    return { title: '字帖出题器 · 语数英三科练习', query: '', imageUrl: '/assets/share-card.png' };
  },
});