// pages/preview/preview.js
const { request } = require('../../utils/request');
const { api } = require('../../config/index');
const { removeHistory } = require('../../utils/history');

Page({
  data: {
    id: '',
    sheet: null,
    loading: true,
    error: '',
  },

  onLoad(query) {
    const id = query.id || '';
    this.setData({ id });
    // 朋友圈单页模式（scene 1154）：不能发网络请求，展示静态引导
    let scene = 0;
    try {
      scene = (wx.getLaunchOptionsSync() || {}).scene || 0;
    } catch (e) { /* 保底 */ }
    if (scene === 1154) {
      this.setData({
        loading: false,
        error: `《${decodeURIComponent(query.title || '') || '这份字帖'}》来自朋友圈分享。\n朋友圈内为单页模式，请点击下方「前往小程序」查看和打印完整字帖。`,
      });
      return;
    }
    this.fetchSheet(id);
  },

  async fetchSheet(id) {
    if (!id) {
      this.setData({ loading: false, error: '缺少字帖编号' });
      return;
    }
    this.setData({ loading: true, error: '' });
    try {
      const data = await request({ url: api.sheetDetail(id) });
      this.setData({ sheet: data.sheet, loading: false });
      wx.setNavigationBarTitle({ title: data.sheet.title || '字帖预览' });
    } catch (err) {
      const gone = (err.message || '').indexOf('不存在') >= 0;
      this.setData({
        loading: false,
        error: gone ? '该字帖已过期（记录保留 10 天）。返回编辑页可随时重新生成。' : err.message,
      });
    }
  },

  /** 下载 PDF 并用微信内置查看器打开；右上角菜单可转发到电脑打印 */
  openPdf() {
    if (!this.data.id) return;
    wx.showLoading({ title: '生成中…' });
    wx.downloadFile({
      url: api.sheetPdf(this.data.id),
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          // 常见于域名未配置：微信对 downloadFile 有独立白名单
          wx.showModal({
            title: '打开失败',
            content: `服务器返回 ${res.statusCode}，请稍后再试或联系开发者。`,
            showCancel: false,
          });
          return;
        }
        const sheet = this.data.sheet || {};
        const name = (sheet.fileName || `${sheet.title || '练习'}.pdf`).replace(/[\\/:*?"<>|\x00-\x1f]/g, '').slice(0, 100);
        const filePath = `${wx.env.USER_DATA_PATH}/${name}`;
        wx.getFileSystemManager().copyFile({
          srcPath: res.tempFilePath,
          destPath: filePath,
          success: () => wx.openDocument({
          filePath,
          fileType: 'pdf',
          showMenu: true,
          fail: () => wx.showToast({ title: '打开 PDF 失败', icon: 'none' }),
          }),
          fail: () => wx.showToast({ title: '保存 PDF 失败，请清理存储后重试', icon: 'none' }),
        });
      },
      fail: (err) => {
        wx.hideLoading();
        const msg = (err && err.errMsg) || '';
        // url not in domain list = downloadFile 合法域名没配置
        const hint = msg.includes('domain')
          ? '域名未配置：请在小程序后台「服务器域名-downloadFile合法域名」添加后端域名'
          : `下载失败：${msg.slice(0, 60)}`;
        wx.showModal({ title: '下载失败', content: hint, showCancel: false });
      },
    });
  },

  copyPrintUrl() {
    wx.setClipboardData({
      data: api.sheetPrint(this.data.id),
      success: () => {
        wx.showModal({
          title: '打印链接已复制',
          content: '在电脑浏览器打开该链接，点击「打印 / 保存为 PDF」即可打印字帖。',
          showCancel: false,
        });
      },
    });
  },

  /** 重新编辑：删除当前生成的字帖，返回编辑页调整参数 */
  redoEdit() {
    wx.showModal({
      title: '重新编辑',
      content: '将删除当前字帖并返回编辑页，继续调整后再生成。',
      confirmText: '返回编辑',
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await request({ url: api.sheetDelete(this.data.id), method: 'DELETE' });
        } catch (e) {
          // 后端可能已删除，本地记录照常清理
        }
        removeHistory(this.data.id);
        wx.navigateBack();
      },
    });
  },

  /** 分享：卡片带字帖名，点开直达这份字帖（服务器保留 10 天内有效） */
  onShareAppMessage() {
    const t = (this.data.sheet && this.data.sheet.title) || '字帖';
    return {
      title: `${t}｜字帖出题器`,
      path: `/pages/preview/preview?id=${this.data.id}`,
      imageUrl: '/assets/share-card.png',
    };
  },

  /** 朋友圈分享：朋友圈里以「单页模式」打开（仅静态展示） */
  onShareTimeline() {
    const sheet = this.data.sheet;
    const t = (sheet && sheet.title) || '字帖';
    return {
      title: `${t}｜字帖出题器`,
      query: `id=${this.data.id}&title=${encodeURIComponent(t)}`,
      imageUrl: '/assets/share-card.png',
    };
  },
});
