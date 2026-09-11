'use strict';

module.exports = function sheetFilename(sheet) {
  const title = (sheet.title || '练习').replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 60);
  const date = new Date(sheet.createdAt || Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(/-/g, '');
  const count = sheet.type === 'math' ? `_${sheet.charCount}题` : '';
  return `${title}${count}_${date}.pdf`;
};
