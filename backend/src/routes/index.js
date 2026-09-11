'use strict';

const express = require('express');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'copybook-backend', uptime: Math.round(process.uptime()) });
});

// 今日剩余生成份数（只读，前端展示用）
const { quotaStatus } = require('../middleware/quota.middleware');
router.get('/v1/quota', (req, res) => res.json(quotaStatus(req)));

router.use('/v1/sheets', require('./sheets.routes'));
router.use('/v1/session', require('./session.routes'));
router.use('/v1/admin', require('./admin.routes'));
router.use('/v1/textbooks', require('./textbooks.routes'));
router.use('/v1', require('./library.routes'));

module.exports = router;
