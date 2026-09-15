'use strict';

const { HttpError } = require('./http-error');
const { buildChineseSheet } = require('../services/layout/chinese.service');
const { buildEnglishSheet, buildCurriculumEnglishSheet } = require('../services/layout/english.service');
const { buildMathSheet } = require('../services/layout/math.service');
const wordbookService = require('../services/wordbook.service');

function asRecord(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, message);
  }
  return value;
}

function parseTitle(payload, fallback) {
  const t = typeof payload.title === 'string' ? payload.title.trim() : '';
  return (t || fallback).slice(0, 30);
}

/** 把请求体归一成 {type, title, content, options}，非法直接抛 400 */
function parseCreatePayload(body) {
  const payload = asRecord(body, '请求体必须是 JSON 对象');
  if (payload.type === 'chinese') {
    const content = asRecord(payload.content, 'content 必须是对象');
    if (typeof content.chars !== 'string' || content.chars.replace(/\s+/g, '').length === 0) {
      throw new HttpError(400, '请输入要练习的汉字');
    }
    return {
      type: 'chinese',
      title: parseTitle(payload, '语文生字练习'),
      content: { chars: content.chars, pinyin: content.pinyin },
      options: payload.options || {},
    };
  }
  if (payload.type === 'math') {
    const content = asRecord(payload.content, 'content 必须是对象');
    if (typeof content.bookId !== 'string' || !content.bookId) {
      throw new HttpError(400, '请选择年级学期');
    }
    return {
      type: 'math',
      title: parseTitle(payload, ''),
      content: { bookId: content.bookId, version: content.version === 'jijiao' ? 'jijiao' : 'pep' },
      options: payload.options || {},
    };
  }
  if (payload.type === 'english') {
    const content = asRecord(payload.content, 'content 必须是对象');
    const hasBookUnit = typeof content.bookId === 'string' && content.bookId && Number.isFinite(Number(content.unitNo));
    const hasText = typeof content.text === 'string' && content.text.trim();
    if (!hasBookUnit && !hasText) {
      throw new HttpError(400, '请输入要练习的英文内容');
    }
    return {
      type: 'english',
      title: parseTitle(payload, '英语书写练习'),
      content: hasBookUnit
        ? { bookId: content.bookId, unitNo: Number(content.unitNo) }
        : { text: content.text },
      options: payload.options || {},
    };
  }
  throw new HttpError(400, 'type 必须是 chinese 或 english');
}

/** 排版并挂上 id / createdAt，生成完整字帖记录 */
function buildSheet(id, payload) {
  const createdAt = new Date().toISOString();
  if (payload.type === 'chinese') {
    const sheet = buildChineseSheet({
      title: payload.title,
      chars: payload.content.chars,
      pinyin: payload.content.pinyin,
      options: payload.options,
    });
    if (sheet.charCount === 0) throw new HttpError(400, '未识别到有效汉字');
    return { id, createdAt, ...sheet };
  }
  if (payload.type === 'math') {
    const sheet = buildMathSheet({
      title: payload.title,
      bookId: payload.content.bookId,
      options: { ...payload.options, version: payload.content.version },
    });
    if (!sheet.pages.length) throw new HttpError(400, '未能生成题目');
    return { id, createdAt, ...sheet };
  }
  let sheet;
  if (payload.content.bookId) {
    const source = wordbookService.getUnit(payload.content.bookId, payload.content.unitNo);
    if (!source) throw new HttpError(400, '请选择有效的英语教材单元');
    if (source.book.coverage === 'core_review_needed') throw new HttpError(400, '该册教材内容待复核，暂不支持生成');
    sheet = buildCurriculumEnglishSheet({
      title: payload.title || `${source.book.name} ${source.unit.title}`,
      book: source.book,
      unit: source.unit,
      options: payload.options,
    });
  } else {
    sheet = buildEnglishSheet({
      title: payload.title,
      text: payload.content.text,
      options: payload.options,
    });
  }
  if (sheet.charCount === 0 || sheet.pages.length === 0) throw new HttpError(400, '未识别到有效英文内容');
  return { id, createdAt, ...sheet };
}

module.exports = { parseCreatePayload, buildSheet };
