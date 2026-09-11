// pages/history/history.js
const { getHistory, removeHistory } = require('../../utils/history');
const { request } = require('../../utils/request');
const { api } = require('../../config/index');

Page({
  data: {
    list: [],
  },

  onShow() {
    this.setData({ list: getHistory() }); // 本地历史兜底
    this.loadCloud();
  },

  /** 云端历史：登录后按 openid 归档，换手机也能找到 */
  async loadCloud() {
    try {
      const d = await request({ url: api.mineSheets });
      const items = (d.items || []).map((it) => {
        const dt = it.createdAt ? new Date(it.createdAt) : null;
        const pad = (n) => String(n).padStart(2, '0');
        return {
          id: it.id,
          type: it.type,
          title: it.title,
          pageCount: it.pageCount,
          dateText: dt ? `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` : '',
        };
      });
      if (items.length) this.setData({ list: items });
    } catch (e) { /* 未登录/离线时用本地历史 */ }
  },

  open(e) {
    wx.navigateTo({ url: `/pages/preview/preview?id=${e.currentTarget.dataset.id}` });
  },

  remove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条字帖吗？',
      success: (r) => {
        if (!r.confirm) return;
        request({ url: api.sheetDelete(id), method: 'DELETE' }).catch(() => {});
        this.setData({ list: removeHistory(id) });
      },
    });
  },

  onShareAppMessage() {
    return { title: '我的字帖记录', path: '/pages/history/history', imageUrl: '/assets/share-card.png' };
  },

  onShareTimeline() {
    return { title: '字帖出题器 · 我的记录', query: '', imageUrl: '/assets/share-card.png' };
  },
});
