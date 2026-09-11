// 无感登录：wx.login 换会话 token（后端存 openid），失败回落设备 ID
const { request } = require('./request');

let token = '';
let vip = false;

function ensureSession() {
  wx.login({
    success: ({ code }) => {
      const devId = wx.getStorageSync('cb_client_id') || '';
      request({ url: '/api/v1/session', method: 'POST', data: { code, devId } })
        .then((d) => {
          token = d.token || '';
          vip = !!d.vip;
          wx.setStorageSync('cb_vip', vip);
          if (d.vipUntil) wx.setStorageSync('cb_vip_until', d.vipUntil);
        })
        .catch(() => { /* 旧包/未配密钥时回落设备配额 */ });
    },
  });
}

module.exports = { ensureSession, getToken: () => token, isVip: () => vip };
