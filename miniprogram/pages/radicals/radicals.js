// pages/radicals/radicals.js
// 常用偏旁部首练习：后端预生成的静态 PDF，直接下载打开，不占每日配额。
const { BASE_URL } = require('../../config/index');

Page({
  data: {
    loading: true,
    error: '',
    keyword: '',
    overviewPdf: '',
    items: [],
    filtered: [],
  },

  onLoad() {
    this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: `${BASE_URL}/assets/radicals/index.json`,
          success: (r) => (r.statusCode === 200 ? resolve(r.data) : reject(new Error(`加载失败（${r.statusCode}）`))),
          fail: () => reject(new Error('网络异常，请稍后再试')),
        });
      });
      const items = (res.items || []).map((it) => ({ ...it, exampleCharsText: (it.exampleChars || []).slice(0, 4).join(' ') }));
      this.setData({ items, filtered: items, overviewPdf: res.overviewPdf || '', loading: false });
      this._overviewPdf = res.overviewPdf || '';
    } catch (e) {
      this.setData({ loading: false, error: e.message });
    }
  },

  onSearch(e) {
    const kw = (e.detail.value || '').trim();
    this.setData({ keyword: kw, filtered: this.filter(kw) });
  },

  filter(kw) {
    if (!kw) return this.data.items;
    return this.data.items.filter((it) => it.name.indexOf(kw) >= 0 || it.id.indexOf(kw) >= 0);
  },

  onOpenOverview() {
    this.openPdfByUrl(`${BASE_URL}/assets/radicals/overview.pdf`);
  },

  openPdfByUrl(url) {
    wx.showLoading({ title: '打开中…' });
    wx.downloadFile({
      url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          wx.showModal({ title: '打开失败', content: `文件返回 ${res.statusCode}，请稍后再试。`, showCancel: false });
          return;
        }
        wx.openDocument({ filePath: res.tempFilePath, fileType: 'pdf', showMenu: true, fail: () => wx.showToast({ title: '打开 PDF 失败', icon: 'none' }) });
      },
      fail: () => { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }); },
    });
  },

  onOpen(e) {
    const item = this.data.filtered[Number(e.currentTarget.dataset.idx)];
    if (!item) return;
    this.openPdfByUrl(`${BASE_URL}${item.pdf}`);
  },

  onShareAppMessage() {
    return {
      title: '常用偏旁部首练习 · 点开即打印',
      path: '/pages/radicals/radicals',
      imageUrl: '/assets/share-card.png',
    };
  },

  onShareTimeline() {
    return {
      title: '常用偏旁部首练习 · 点开即打印',
      query: '',
      imageUrl: '/assets/share-card.png',
    };
  },
});
