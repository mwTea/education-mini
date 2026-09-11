'use strict';

const express = require('express');

const textbookService = require('../services/textbook.service');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ items: textbookService.list(), stats: textbookService.stats() });
});

router.get('/:id', (req, res) => {
  const book = textbookService.get(req.params.id);
  if (!book) return res.status(404).json({ error: '教材不存在' });
  return res.json({ book });
});

module.exports = router;
