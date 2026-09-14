'use strict';

/** 会话：wx.login code 换 openid（AppSecret 存服务器）；未配置密钥时接受 devId 便于联调。 */
const express = require('express');
const https = require('https');
const store = require('../store/user.store');

const router = express.Router();

function code2Session(appid, secret, code) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          const d = JSON.parse(raw);
          if (d.openid) resolve({ openid: d.openid, sessionKey: d.session_key || '' });
          else reject(new Error(d.errmsg || 'code2Session 失败'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

router.post('/', async (req, res) => {
  const appid = process.env.WXA_APPID || '';
  const secret = process.env.WXA_SECRET || '';
  const code = req.body && req.body.code;
  const devId = req.body && req.body.devId;
  try {
    let openid = null;
    let sessionKey = '';
    if (code && appid && secret) {
      const wxSession = await code2Session(appid, secret, code);
      openid = wxSession.openid;
      sessionKey = wxSession.sessionKey;
    } else if (devId) {
      openid = `dev_${String(devId).slice(0, 40)}`;
    } else if (code) {
      return res.status(503).json({ error: '服务端未配置小程序密钥', code: 'NO_SECRET' });
    }
    if (!openid) return res.status(400).json({ error: '缺少 code 或 devId' });
    const user = store.upsert(openid);
    res.json({ token: store.issueToken(openid, sessionKey), vip: store.isVip(user), vipUntil: user.vipUntil || null });
  } catch (e) {
    res.status(400).json({ error: `登录失败：${e.message}` });
  }
});

module.exports = router;
