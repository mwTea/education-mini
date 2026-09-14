// 无感登录：wx.login 换会话 token（后端存 openid），失败回落设备 ID
const { request, clientId } = require('./request');
const { api } = require('../config/index');

let token = '';
let vip = false;
let pending = null;

function ensureSession() {
  if (token) return Promise.resolve({ token, vip });
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    wx.login({
      success: ({ code }) => {
      const devId = clientId();
      request({ url: api.session, method: 'POST', data: { code, devId } })
        .then((d) => {
          token = d.token || '';
          vip = !!d.vip;
          wx.setStorageSync('cb_vip', vip);
          if (d.vipUntil) wx.setStorageSync('cb_vip_until', d.vipUntil);
          resolve({ token, vip });
        })
        .catch(reject);
      },
      fail: reject,
    });
  }).finally(() => { pending = null; });
  return pending;
}

function clearSession() {
  token = '';
  vip = false;
  pending = null;
}

module.exports = {
  ensureSession,
  clearSession,
  getToken: () => token,
  isVip: () => vip,
};
