'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 英语内容库：教材同步内容 + 主题词包。
 * 教材新格式使用 words: [{ word, meaning }]、
 * sentences: [{ text, translation, level }]。旧字符串数组仍兼容。
 */

const DIR = path.join(__dirname, '..', 'data', 'wordbooks');
const zhDict = require('../data/wordbooks/zh-dict.json').dict;

function normalizeWord(raw) {
  if (typeof raw === 'string') {
    const word = raw.trim();
    return word ? { word, meaning: zhDict[word] || zhDict[word.toLowerCase()] || '' } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const word = typeof raw.word === 'string' ? raw.word.trim() : '';
  if (!word) return null;
  const meaning = typeof raw.meaning === 'string' ? raw.meaning.trim() : '';
  const normalized = { word, meaning: meaning || zhDict[word] || zhDict[word.toLowerCase()] || '' };
  // 新教材包目前主要提供单词和释义；以下字段为后续更完整词库预留，
  // 仅在源数据真实存在时透传，打印端不会猜测或补造。
  ['phonetic', 'partOfSpeech', 'plural', 'collocation'].forEach((key) => {
    if (typeof raw[key] === 'string' && raw[key].trim()) normalized[key] = raw[key].trim();
  });
  return normalized;
}

function normalizeSentence(raw) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? { text, translation: '', level: 1 } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const translation = typeof raw.translation === 'string' ? raw.translation.trim() : '';
  const level = [1, 2, 3].includes(Number(raw.level)) ? Number(raw.level) : 1;
  return { text, translation, level };
}

function normalizeBook(raw) {
  if (!raw || !raw.id || !Array.isArray(raw.units)) return null;
  return {
    ...raw,
    units: raw.units.map((unit, index) => ({
      ...unit,
      unitNo: Number.isFinite(Number(unit.unitNo)) ? Number(unit.unitNo) : index + 1,
      title: String(unit.title || `Unit ${index + 1}`).trim(),
      words: (unit.words || []).map(normalizeWord).filter(Boolean),
      sentences: (unit.sentences || []).map(normalizeSentence).filter(Boolean),
    })),
  };
}

function loadAll() {
  const byId = new Map();
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((file) => file.endsWith('.json')).sort();
  } catch (e) {
    return [];
  }

  files.forEach((file) => {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
      const candidates = Array.isArray(parsed.items) ? parsed.items : [parsed];
      candidates.forEach((candidate) => {
        const book = normalizeBook(candidate);
        if (!book) return;
        const current = byId.get(book.id);
        // 同 ID 时优先 id.json，避免历史 jj-3a-sentences.json 抢占详情。
        if (!current || file === `${book.id}.json`) byId.set(book.id, { book, file });
      });
    } catch (e) {
      // 单文件异常不应让整个内容库变空。
    }
  });
  return [...byId.values()].map((entry) => entry.book);
}

function list({ includeReview = false } = {}) {
  return loadAll()
    .filter((book) => includeReview || book.coverage !== 'core_review_needed')
    .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'textbook' ? -1 : 1))
    .map(({ id, name, kind, note, legacy, coverage, publisher, edition, grade, semester, units }) => ({
      id,
      name,
      kind,
      note,
      legacy: legacy === true,
      coverage: coverage || (legacy ? 'legacy' : 'full_core'),
      publisher: publisher || '',
      edition: edition || '',
      grade: Number(grade) || null,
      semester: semester || '',
      unitCount: units.length,
      wordCount: units.reduce((count, unit) => count + unit.words.length, 0),
      sentenceCount: units.reduce((count, unit) => count + unit.sentences.length, 0),
    }));
}

function get(id) {
  return loadAll().find((book) => book.id === id) || null;
}

function getUnit(bookId, unitNo) {
  const book = get(bookId);
  if (!book) return null;
  const unit = book.units.find((item) => item.unitNo === Number(unitNo));
  return unit ? { book, unit } : null;
}

module.exports = { list, get, getUnit, normalizeBook };
