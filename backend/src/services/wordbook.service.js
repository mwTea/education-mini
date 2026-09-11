'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 英语词库：教材同步词表（pep-*.json，脚本爬取）+ 主题词包（packs.json，编录）。
 * 统一 shape：{ id, name, kind: 'textbook' | 'pack', units: [{ title, words }] }
 */

const DIR = path.join(__dirname, '..', 'data', 'wordbooks');

function loadAll() {
  try {
    return fs.readdirSync(DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
      .flatMap((b) => {
        if (Array.isArray(b.items)) return b.items; // 词包文件：{ items: [...] }
        return b && b.id ? [b] : []; // 教材文件：单册对象
      });
  } catch (e) {
    return [];
  }
}

function list() {
  return loadAll()
    .filter((b) => b.id && b.units)
    .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'textbook' ? -1 : 1))
    .map(({ id, name, kind, note, legacy, units }) => ({
      id,
      name,
      kind,
      note,
      legacy: legacy === true, // 旧版教材词表（新版启用前的年级下册等）
      unitCount: units.length,
      wordCount: units.reduce((n, u) => n + (u.words || []).length, 0),
    }));
}

function get(id) {
  return loadAll().find((b) => b.id === id) || null;
}

module.exports = { list, get };
