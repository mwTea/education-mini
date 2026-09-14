'use strict';

const express = require('express');
const crypto = require('crypto');
const userStore = require('../store/user.store');
const shareStore = require('../store/share-reward.store');

const router = express.Router();

function session(req) {
  return userStore.sessionOf(req.get('x-user-token'));
}

function requireSession(req, res, next) {
  const current = session(req);
  if (!current || !current.openid) return res.status(401).json({ error: '请重新打开小程序后再分享', code: 'SESSION_REQUIRED' });
  req.shareSession = current;
  return next();
}

function decryptGroupId(sessionKey, encryptedData, iv) {
  if (!sessionKey || !encryptedData || !iv) return '';
  try {
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(sessionKey, 'base64'),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAutoPadding(true);
    const raw = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'base64')),
      decipher.final(),
    ]).toString('utf8');
    const data = JSON.parse(raw);
    const appid = process.env.WXA_APPID || '';
    if (appid && data.watermark && data.watermark.appid && data.watermark.appid !== appid) return '';
    return typeof data.openGId === 'string' ? data.openGId.slice(0, 128) : '';
  } catch (e) {
    return '';
  }
}

router.post('/intents', requireSession, (req, res) => {
  res.status(201).json(shareStore.createIntent(req.shareSession.openid));
});

router.post('/claim', requireSession, (req, res) => {
  const { id, encryptedData, iv } = req.body || {};
  if (!id) return res.status(400).json({ error: '缺少分享奖励标识', code: 'SHARE_INTENT_REQUIRED' });
  let groupId = '';
  if (encryptedData || iv) {
    groupId = decryptGroupId(req.shareSession.sessionKey, encryptedData, iv);
    if (!groupId) return res.status(400).json({ error: '群分享校验失败', code: 'GROUP_PROOF_INVALID' });
  }
  const result = shareStore.claimIntent({ id: String(id).slice(0, 80), claimantOpenid: req.shareSession.openid, groupId });
  if (!result.ok) return res.status(400).json({ error: result.message, code: result.code });
  return res.json({
    reward: result.reward,
    duplicate: result.duplicate,
    kind: result.kind,
  });
});

module.exports = router;
