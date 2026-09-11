'use strict';

const fs = require('fs');
const path = require('path');

/** 古诗词库（公版内容，随代码维护） */
const FILE = path.join(__dirname, '..', 'data', 'poems', 'poems.json');

function list() {
  const { items } = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  return items;
}

function get(id) {
  return list().find((p) => p.id === id) || null;
}

module.exports = { list, get };
