'use strict';

/**
 * 从结巴词库（MIT）构建「单字 → 组词」索引。
 * 规则：取含该字的 2~3 字词，按词频降序，每字最多保留 6 个词，
 * 运行时再按需取前 3。只保留纯汉字词。
 *
 * 用法：node scripts/build-word-index.js
 * 输出：assets/hanzi/words-index.json
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'assets', 'hanzi');
const SRC = path.join(DIR, 'jieba-dict.txt');
const OUT = path.join(DIR, 'words-index.json');

const MAX_PER_CHAR = 6;

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`词库不存在：${SRC}（先运行 scripts/fetch-hanzi-data.sh）`);
    process.exit(1);
  }

  const index = new Map(); // char -> [[word, freq], ...]

  const lines = fs.readFileSync(SRC, 'utf8').split('\n');
  for (const line of lines) {
    const parts = line.trim().split(' ');
    if (parts.length < 2) continue;
    const word = parts[0];
    const freq = Number(parts[1]);
    if (!Number.isFinite(freq) || freq <= 0) continue;
    if (word.length < 2 || word.length > 3) continue;
    if (!/^[\u3400-\u9fff]{2,3}$/.test(word)) continue;

    for (const ch of new Set(Array.from(word))) {
      if (!index.has(ch)) index.set(ch, []);
      index.get(ch).push([word, freq]);
    }
  }

  const out = {};
  for (const [ch, list] of index) {
    list.sort((a, b) => b[1] - a[1]);
    const seen = new Set();
    const words = [];
    for (const [w] of list) {
      if (seen.has(w)) continue;
      seen.add(w);
      words.push(w);
      if (words.length >= MAX_PER_CHAR) break;
    }
    if (words.length) out[ch] = words;
  }

  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`组词索引：${Object.keys(out).length} 字，输出 ${OUT}`);
}

main();
