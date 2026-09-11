'use strict';

const express = require('express');

const poemService = require('../services/poem.service');
const wordbookService = require('../services/wordbook.service');

const router = express.Router();

// 古诗词库（语文）
router.get('/poems', (req, res) => {
  res.json({ items: poemService.list() });
});

// 英语词库：教材同步词表 + 主题词包
router.get('/wordbooks', (req, res) => {
  res.json({ items: wordbookService.list() });
});

router.get('/wordbooks/:id', (req, res) => {
  const book = wordbookService.get(req.params.id);
  if (!book) return res.status(404).json({ error: '词库不存在' });
  return res.json({ book });
});

const { listBooks, TYPE_LABELS, exampleFor } = require('../services/layout/math.service');
const { scopeFor, wordTopics, WORD_LABELS } = require('../services/layout/math-curriculum');

// 数学册别 + 各册题型（出题页数据源）
router.get('/mathbooks', (req, res) => {
  const version = req.query.version === 'pep' ? 'pep' : 'jijiao';
  const books = require('../services/layout/math.service').VERSIONS[version].books;
  res.json({
    version,
    items: listBooks(version).map((b) => ({
      ...b,
      wordTopics: wordTopics(scopeFor(version, b.id, books[b.id].types)).map((id) => ({ id, name: WORD_LABELS[id] })),
      types: (books[b.id].types || []).map((t) => ({ id: t, name: TYPE_LABELS[t] || t, eg: exampleFor(version, b.id, t) })),
    })),
  });
});

const { buildMathSheet } = require('../services/layout/math.service');

// 在线练习：按配置出一组口算题（不落库、不占生成配额）
router.post('/math/quiz', (req, res) => {
  const { version, bookId, difficulty, count } = req.body || {};
  const n = Math.min(Math.max(5, Number(count) || 20), 50);
  // 只出口算题型（竖式/应用题在线输入体验差）：直接按口算题型出整卷
  const QUIZ_TYPES = ['word-problem', 'vertical-mul', 'vertical-div', 'vertical-add', 'vertical-sub', 'vertical-decimal', 'compare', 'fraction-add', 'fraction-add2', 'div-remainder', 'clock-read', 'clock-draw'];
  const books = require('../services/layout/math.service').VERSIONS[version === 'pep' ? 'pep' : 'jijiao'].books;
  if (!books[bookId || 'math-1a']) return res.status(400).json({ error: '请选择有效的年级学期' });
  const all = books[bookId || 'math-1a'].types;
  const inlineTypes = all.filter((t) => !QUIZ_TYPES.includes(t) && !t.startsWith('fraction-'));
  const sheet = buildMathSheet({
    bookId: bookId || 'math-1a',
    options: {
      version: version === 'pep' ? 'pep' : 'jijiao',
      difficulty: difficulty || 'standard',
      count: n,
      withAnswer: true,
      types: inlineTypes.length ? inlineTypes : all,
    },
  });
  const questions = sheet.questions.map((q) => ({ stem: q.stem, answer: q.answer, type: q.type, version: q.version, bookId: q.bookId }));
  res.json({ questions, title: sheet.title });
});

module.exports = router;
