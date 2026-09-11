'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 汉字静态数据服务（生字卡片用）。
 * 数据源：
 *   - makemeahanzi dictionary.txt（assets/hanzi/，脚本下载）：部首、构字分解（→结构）
 *   - hanzi-writer-data（npm 依赖，同源 Make Me a Hanzi / Arphic PL）：逐笔 SVG 路径，按字懒加载
 *   - words-index.json（assets/hanzi/）：单字组词索引（由 scripts/build-word-index.js 从结巴词库生成）
 * 数据缺失时相应字段为空，渲染自动降级（不出信息栏/笔顺/组词）。
 */

const DATA_DIR = path.join(__dirname, '..', '..', 'assets', 'hanzi');

// 构字分解首字符 → 结构名（IDS 描述符）
const STRUCTURE_BY_IDS = {
  '⿰': '左右结构',
  '⿱': '上下结构',
  '⿲': '左中右结构',
  '⿳': '上中右结构',
  '⿴': '全包围结构',
  '⿵': '半包围结构',
  '⿶': '半包围结构',
  '⿷': '半包围结构',
  '⿸': '半包围结构',
  '⿹': '半包围结构',
  '⿺': '半包围结构',
  '⿻': '镶嵌结构',
};

let dictionary = null; // Map char -> {radical, decomposition}
let words = null; // Map char -> [word, ...]
const graphicsCache = new Map(); // char -> [strokePath, ...] | null（来自 hanzi-writer-data，按字懒加载）

function fileExists(name) {
  return fs.existsSync(path.join(DATA_DIR, name));
}

function loadDictionary() {
  if (dictionary) return dictionary;
  dictionary = new Map();
  if (!fileExists('dictionary.txt')) return dictionary;
  const lines = fs.readFileSync(path.join(DATA_DIR, 'dictionary.txt'), 'utf8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const { character, radical, decomposition } = JSON.parse(line);
      if (character) dictionary.set(character, { radical, decomposition });
    } catch (e) {
      // 跳过坏行
    }
  }
  return dictionary;
}

function loadGraphics() {
  return graphicsCache;
}

/** 按字取逐笔路径（hanzi-writer-data 每字一个 JSON，require 缓存即为内存缓存） */
function strokesOf(ch) {
  if (graphicsCache.has(ch)) return graphicsCache.get(ch);
  let strokes = null;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    strokes = require(`hanzi-writer-data/${ch}`).strokes || null;
  } catch (e) {
    strokes = null;
  }
  graphicsCache.set(ch, strokes);
  return strokes;
}

function loadWords() {
  if (words) return words;
  words = new Map();
  if (!fileExists('words-index.json')) return words;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'words-index.json'), 'utf8'));
    Object.entries(raw).forEach(([ch, list]) => words.set(ch, list));
  } catch (e) {
    // 数据缺失时保持空表
  }
  return words;
}

function structureOf(decomposition) {
  if (!decomposition) return null;
  return STRUCTURE_BY_IDS[decomposition[0]] || null;
}

/**
 * 查询单字静态信息。
 * 返回 null（无数据）或：
 *   { radical, strokeCount, structure, words: [w1..w3], strokePaths: [...] }
 */
function lookup(ch) {
  const dict = loadDictionary().get(ch) || {};
  const strokes = strokesOf(ch);
  const wordList = loadWords().get(ch) || [];

  const radical = dict.radical || null;
  const structure = structureOf(dict.decomposition);
  const meta = {
    radical,
    strokeCount: Array.isArray(strokes) ? strokes.length : null,
    structure,
    words: wordList.slice(0, 3),
  };

  const hasMeta = meta.radical || meta.strokeCount || meta.structure || meta.words.length;
  if (!hasMeta && !strokes) return null;

  return { ...meta, strokePaths: strokes || [] };
}

function strokePaths(ch) {
  return strokesOf(ch);
}

/** 数据可用性（供健康检查/测试条件断言） */
function available() {
  let graphics = false;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    require.resolve('hanzi-writer-data/package.json');
    graphics = true;
  } catch (e) {
    graphics = false;
  }
  return {
    dictionary: fileExists('dictionary.txt'),
    graphics,
    words: fileExists('words-index.json'),
  };
}

module.exports = { lookup, strokePaths, available };
