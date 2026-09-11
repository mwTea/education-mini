'use strict';

/** 管理后台：Token 鉴权的统计/会员接口 + 手机 H5 单页（/admin）。 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../store/user.store');
const sheetStore = require('../store/sheet.store');
const quota = require('../middleware/quota.middleware');

const router = express.Router();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'copybook-admin';
const VIP_FILE = path.join(__dirname, '..', '..', 'data', 'vip-openids.txt');

function auth(req, res, next) {
  const t = req.query.token || req.get('x-admin-token') || (req.body && req.body.token);
  if (t !== ADMIN_TOKEN) return res.status(401).json({ error: '管理口令错误' });
  return next();
}

router.get('/stats', auth, (req, res) => {
  const all = sheetStore.list();
  const today = new Date().toISOString().slice(0, 10);
  const byDay = {};
  const byType = {};
  all.forEach((s) => {
    const d = String(s.createdAt).slice(0, 10);
    byDay[d] = (byDay[d] || 0) + 1;
    byType[s.type] = (byType[s.type] || 0) + 1;
  });
  res.json({
    ...store.stats(),
    sheetsKept: all.length,
    generatedToday: byDay[today] || 0,
    byDay,
    byType,
  });
});

router.post('/vip', auth, (req, res) => {
  const { openid, days } = req.body || {};
  if (!openid || !Number(days)) return res.status(400).json({ error: '需要 openid 和天数' });
  const u = store.setVip(String(openid).slice(0, 64), Number(days));
  res.json({ ok: true, openid: u.openid, vipUntil: u.vipUntil });
});

// 白名单后门：data/vip-openids.txt 一行一个 openid
router.post('/vip-file', auth, (req, res) => {
  const { openid } = req.body || {};
  if (!openid) return res.status(400).json({ error: '需要 openid' });
  fs.appendFileSync(VIP_FILE, `${openid}\n`);
  res.json({ ok: true, file: 'data/vip-openids.txt', note: '重启 copybook 后生效' });
});

module.exports = router;
