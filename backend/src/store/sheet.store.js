'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 字帖存储：内存 Map + JSON 文件持久化。
 * 数据量小的场景够用；后续可平滑替换成数据库实现（接口不变）。
 *
 * 写入采用「临时文件 + 原子改名」，进程崩溃不会写坏主文件；
 * 记录保留 10 天自动清理（启动时 + 每日一次），PDF 反正是实时生成的。
 */

const RETENTION_DAYS = 10;

let cache = null;

function dataFile() {
  const dir = process.env.COPYBOOK_DATA_DIR || path.join(__dirname, '..', '..', 'data');
  return path.join(dir, 'sheets.json');
}

function load() {
  if (cache) return cache;
  try {
    const arr = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    cache = new Map(arr.map((record) => [record.id, record]));
  } catch {
    cache = new Map();
  }
  cleanup();
  // 常驻定时清理（不阻止进程退出）
  setInterval(cleanup, 24 * 3600 * 1000).unref();
  return cache;
}

function persist() {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...load().values()], null, 2));
  fs.renameSync(tmp, file);
}

/** 删除超过保留期的字帖，返回清理数量 */
function cleanup() {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;
  let removed = 0;
  if (!cache) return removed;
  for (const [id, record] of cache) {
    const created = Date.parse(record.createdAt || 0);
    if (Number.isFinite(created) && created < cutoff) {
      cache.delete(id);
      removed += 1;
    }
  }
  if (removed) persist();
  return removed;
}

function create(sheet) {
  load().set(sheet.id, sheet);
  persist();
  return sheet;
}

function get(id) {
  return load().get(id) || null;
}

function list() {
  return [...load().values()]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);
}

function remove(id) {
  const ok = load().delete(id);
  if (ok) persist();
  return ok;
}

module.exports = { create, get, list, remove, cleanup, RETENTION_DAYS };
