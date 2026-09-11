'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 教材生字表服务。
 * 数据是代码的一部分（src/data/textbooks/*.json），按需增删文件即可，
 * 后续数据量大了再迁到数据库，接口保持不变。
 */

const DATA_DIR = path.join(__dirname, '..', 'data', 'textbooks');

function loadAll() {
  try {
    return fs.readdirSync(DATA_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')));
  } catch (e) {
    return [];
  }
}

function list() {
  return loadAll().map(({ id, name, subject, note, lessons }) => ({
    id,
    name,
    subject,
    note,
    lessonCount: lessons.length,
  }));
}

/** 全库统计：册数 / 课文数 / 去重生字数（首页展示用，数据更新后自动变化） */
function stats() {
  const books = loadAll();
  const chars = new Set();
  let lessons = 0;
  books.forEach((b) => {
    lessons += b.lessons.length;
    b.lessons.forEach((l) => Array.from(String(l.chars || '')).forEach((ch) => chars.add(ch)));
  });
  return { books: books.length, lessons, distinctChars: chars.size };
}

function get(id) {
  return loadAll().find((book) => book.id === id) || null;
}

module.exports = { list, get, stats };
