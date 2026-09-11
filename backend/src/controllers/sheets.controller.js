'use strict';

const store = require('../store/sheet.store');
const { parseCreatePayload, buildSheet } = require('../utils/validate');
const { sheetToHtml } = require('../services/render/html.service');
const { sheetToPdfBuffer } = require('../services/render/pdf.service');
const { newId } = require('../utils/id');
const sheetFilename = require('../utils/sheet-filename');

const userStore = require('../store/user.store');

exports.create = (req, res) => {
  const payload = parseCreatePayload(req.body);
  const sheet = buildSheet(newId(), payload);
  const openid = userStore.openidOf(req.headers['x-user-token']);
  if (openid) sheet.ownerOpenid = openid; // 云端历史按用户归档
  store.create(sheet);
  res.status(201).json({
    id: sheet.id,
    type: sheet.type,
    title: sheet.title,
    pageCount: sheet.pages.length,
    createdAt: sheet.createdAt,
    printUrl: `/api/v1/sheets/${sheet.id}/print`,
  });
};

exports.list = (req, res) => {
  let records = store.list();
  // mine=1：按登录用户（openid）返回云端历史
  if (req.query.mine === '1') {
    const openid = userStore.openidOf(req.headers['x-user-token']);
    records = openid ? records.filter((s) => s.ownerOpenid === openid) : [];
  }
  const items = records.map(({ id, type, title, createdAt, charCount, pages }) => ({
    id,
    type,
    title,
    createdAt,
    charCount,
    pageCount: pages.length,
  }));
  res.json({ items });
};

exports.detail = (req, res) => {
  const sheet = store.get(req.params.id);
  if (!sheet) return res.status(404).json({ error: '字帖不存在或已删除' });
  return res.json({ sheet: { ...sheet, fileName: sheetFilename(sheet) } });
};

exports.print = (req, res) => {
  const sheet = store.get(req.params.id);
  if (!sheet) return res.status(404).json({ error: '字帖不存在或已删除' });
  return res.type('html').send(sheetToHtml(sheet));
};

exports.pdf = async (req, res, next) => {
  try {
    const sheet = store.get(req.params.id);
    if (!sheet) return res.status(404).json({ error: '字帖不存在或已删除' });
    const buffer = await sheetToPdfBuffer(sheet);
    res.setHeader('Content-Type', 'application/pdf');
    // 文件名用字帖标题（微信另存/转发时显示友好），RFC5987 编码中文
    res.setHeader('Content-Disposition', `inline; filename="practice.pdf"; filename*=UTF-8''${encodeURIComponent(sheetFilename(sheet))}`);
    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
};

exports.remove = (req, res) => {
  const ok = store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: '字帖不存在或已删除' });
  return res.json({ ok: true });
};
