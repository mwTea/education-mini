'use strict';

/**
 * 用 hanzi-park 的部编版识字数据（GitHub: cjp1016/hanzi-park）回填
 * 智慧山写字表缺失的课文。
 *
 * 两种用法：
 *   指定映射：node scripts/backfill-from-hanzi-park.js <pep.ts> <json>...
 *             （按文件顶部 BACKFILL 映射表，一年级用）
 *   自动模式：node scripts/backfill-from-hanzi-park.js --auto <pep1.ts> [pep2.ts ...] -- <json1> [json2 ...]
 *             （按课名匹配自动回填缺失课：课文/识字缺失即在 hanzi-park 中找同名课，
 *              编号取该分区现有最大号顺延，排序保持教材顺序）
 *
 * 回填的课带 source: "know"（识字表字，略多于写字表），主数据 source: "write"。
 */

const fs = require('fs');

// 智慧山缺的课 → [编号, 类型]（一年级手工映射，自动模式可覆盖更多册）
const BACKFILL = {
  'rj-yuwen-1a': {
    画: { section: '识字', number: 6 },
    小小的船: { section: '课文', number: 2 },
    四季: { section: '课文', number: 4 },
  },
  'rj-yuwen-1b': {
    文具的家: { section: '课文', number: 15 },
    一分钟: { section: '课文', number: 16 },
    动物王国开大会: { section: '课文', number: 17 },
    小猴子下山: { section: '课文', number: 18 },
    棉花姑娘: { section: '课文', number: 19 },
    咕咚: { section: '课文', number: 20 },
    小壁虎借尾巴: { section: '课文', number: 21 },
  },
};

const SECTION_RANK = { 识字: 0, 拼音: 1, 课文: 2 };

/** 解析 hanzi-park 的 TS 数据，返回 课名 → 汉字数组 */
function parseHanziPark(tsPath) {
  const src = fs.readFileSync(tsPath, 'utf8');
  const map = new Map();
  const re = /title: '([^']+)',\s*\n\s*characters: \[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(src))) {
    const chars = (m[2].match(/'([^']+)'/g) || []).map((s) => s.replace(/'/g, ''));
    if (chars.length && !map.has(m[1])) map.set(m[1], chars);
  }
  return map;
}

function sortLessons(lessons) {
  return lessons.sort((a, b) => {
    const pa = a.title.match(/^(识字|拼音|课文)(\d+)/);
    const pb = b.title.match(/^(识字|拼音|课文)(\d+)/);
    if (!pa || !pb) return 0;
    return (SECTION_RANK[pa[1]] - SECTION_RANK[pb[1]]) || (Number(pa[2]) - Number(pb[2]));
  });
}

function applyBook(jsonPath, hanziPark, useAuto) {
  const book = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const existing = new Set(book.lessons.map((l) => l.title.replace(/^(识字|拼音|课文)\d+\s*/, '')));
  const added = [];

  if (useAuto) {
    // 按课名匹配：hanzi-park 有、智慧山缺的课文/识字课，编号按分区顺延
    const plan = [];
    for (const [name, chars] of hanziPark) {
      if (existing.has(name)) continue;
      plan.push({ name, chars });
    }
    for (const { name, chars } of plan) {
      // 判断分区：与同名策略无据可依时默认课文；这里保守处理——
      // 智慧山缺失的通常是课文，识字单元基本齐全
      const section = '课文';
      const nums = book.lessons
        .map((l) => l.title.match(/^(课文)(\d+)/))
        .filter(Boolean)
        .map((m) => Number(m[2]));
      const number = (nums.length ? Math.max(...nums) : 0) + 1;
      book.lessons.push({
        title: `${section}${number} ${name}`,
        chars: chars.join(''),
        source: 'know',
      });
      added.push(`${section}${number} ${name}(${chars.length})`);
    }
  } else {
    const plan = BACKFILL[book.id] || {};
    for (const [name, meta] of Object.entries(plan)) {
      if (existing.has(name)) continue;
      const chars = hanziPark.get(name);
      if (!chars || !chars.length) {
        console.warn(`⚠ 未在 hanzi-park 找到《${name}》，跳过`);
        continue;
      }
      book.lessons.push({
        title: `${meta.section}${meta.number} ${name}`,
        chars: chars.join(''),
        source: 'know',
      });
      added.push(`${meta.section}${meta.number} ${name}(${chars.length})`);
    }
  }

  book.lessons = sortLessons(book.lessons.map((l) => ({ source: 'write', ...l })));

  book.note = [
    `主数据：智慧山逐课写字表（${new Date().toISOString().slice(0, 10)} 抓取，scripts/crawl-zhihuishan.js）`,
    '个别缺失课按 hanzi-park 部编版识字数据回填（source: "know"，字数略多于写字表）',
  ].join('；');

  fs.writeFileSync(jsonPath, JSON.stringify(book, null, 2) + '\n');
  console.log(`${book.name}: 共 ${book.lessons.length} 课${added.length ? '，回填 ' + added.join('、') : ''}`);
  return added.length;
}

function main() {
  const args = process.argv.slice(2);
  const useAuto = args[0] === '--auto';
  const rest = useAuto ? args.slice(1) : args;
  const sep = rest.indexOf('--');
  const tsPaths = sep === -1 ? rest : rest.slice(0, sep);
  const jsonPaths = sep === -1 ? [] : rest.slice(sep + 1);

  const hanziPark = new Map();
  tsPaths.forEach((p) => parseHanziPark(p).forEach((v, k) => { if (!hanziPark.has(k)) hanziPark.set(k, v); }));

  if (useAuto) {
    if (!jsonPaths.length) {
      console.error('自动模式用法: --auto <pep1.ts> [pep2.ts ...] -- <json1> [json2 ...]');
      process.exit(1);
    }
    jsonPaths.forEach((p) => applyBook(p, hanziPark, true));
  } else {
    const [tsPath, ...books] = rest;
    if (!tsPath || !books.length) {
      console.error('用法: node backfill-from-hanzi-park.js <pep.ts> <json>...');
      process.exit(1);
    }
    books.forEach((p) => applyBook(p, hanziPark, false));
  }
}

main();
