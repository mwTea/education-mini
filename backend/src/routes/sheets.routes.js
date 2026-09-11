'use strict';

const express = require('express');

const router = express.Router();
const ctrl = require('../controllers/sheets.controller');
const { sheetQuota } = require('../middleware/quota.middleware');

router.post('/', sheetQuota, ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.detail);
router.get('/:id/print', ctrl.print);
router.get('/:id/pdf', ctrl.pdf);
router.delete('/:id', ctrl.remove);

module.exports = router;
