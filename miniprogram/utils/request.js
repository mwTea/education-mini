// utils/request.js
const { BASE_URL } = require('../config/index');

/** 设备 ID：本地生成一次持久保存，后端按它做每日生成配额（3 份/天） */
function clientId() {
  let id = '';
  try {
    id = wx.getStorageSync('cb_client_id') || '';
    if (!id) {
      id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      wx.setStorageSync('cb_client_id', id);
    }
  } catch (e) {
    id = '';
  }
  return id;
}

function request(options) {
  const { url, method = 'GET', data } = options;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: {
        'X-Client-ID': clientId(),
        ...(require('./session').getToken() ? { 'X-User-Token': require('./session').getToken() } : {}),
      },
      timeout: 10000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const message = (res.data && res.data.error) || `请求失败（${res.statusCode}）`;
        const err = new Error(message);
        err.code = res.data && res.data.code; // 如 DAILY_LIMIT / RATE_LIMIT
        err.statusCode = res.statusCode;
        reject(err);
      },
      fail() {
        reject(new Error('网络异常，请确认后端服务已启动'));
      },
    });
  });
}

module.exports = { request, clientId, BASE_URL };
