'use strict';

/**
 * 从智慧山（zhihuishan.com）人教版生字表页面抓取逐课生字，生成教材数据包。
 *
 * 用法：
 *   node scripts/crawl-zhihuishan.js <页面URL> <输出JSON路径> <教材名称> <教材ID>
 * 示例：
 *   node scripts/crawl-zhihuishan.js \
 *     https://www.zhihuishan.com/bishun-shengzibiao-24.html \
 *     src/data/textbooks/rj-yuwen-1a.json \
 *     人教版语文一年级上册（2024新教材） rj-yuwen-1a
 *
 * 页面结构：每课一个 <div class='item'>，
 *   课目： <h4><a ...>识字 第二课 金木水火土</a></h4>
 *   生字： <a title="点击查看 一 的笔顺动画">一</a>
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const SECTION_RANK = { 识字: 0, 汉语拼音: 1, 课文: 2 };

function cnToInt(str) {
  if (str === '十') return 10;
  if (str.length === 1) return CN_NUM[str];
  const i = str.indexOf('十');
  if (i === -1) return str.split('').reduce((a, c) => a * 10 + CN_NUM[c], 0);
  const head = str.slice(0, i) || '一';
  const tail = str.slice(i + 1);
  return CN_NUM[head] * 10 + (tail ? CN_NUM[tail] : 0);
}

function parse(html) {
  const items = html.split(/<div class='item-heading'>/).slice(1);
  const lessons = [];

  for (const item of items) {
    const headMatch = item.match(/<h4><a[^>]*>([^<]+)<\/a>/);
    if (!headMatch) continue;
    const rawTitle = headMatch[1].trim();

    const m = rawTitle.match(/^(识字|课文|汉语拼音)\s*第([一二三四五六七八九十]+)课\s*(.+)$/);
    if (!m) continue;

    const chars = [];
    const charRe = /点击查看\s(.)\s的笔顺动画/g;
    let cm;
    while ((cm = charRe.exec(item))) {
      const ch = cm[1];
      // 只要 CJK，滤掉拼音字母等
      if (/[\u3400-\u9fff]/.test(ch) && !chars.includes(ch)) chars.push(ch);
    }
    if (!chars.length) continue;

    lessons.push({
      section: m[1],
      number: cnToInt(m[2]),
      name: m[3].trim(),
      chars: chars.join(''),
    });
  }

  // 按教材顺序排序：识字 → 汉语拼音 → 课文，各自按课号
  lessons.sort((a, b) =>
    (SECTION_RANK[a.section] - SECTION_RANK[b.section]) || (a.number - b.number));

  return lessons.map((l) => ({
    title: `${l.section === '汉语拼音' ? '拼音' : l.section}${l.number} ${l.name}`,
    chars: l.chars,
  }));
}

function main() {
  const [url, out, name, id] = process.argv.slice(2);
  if (!url || !out || !name || !id) {
    console.error('用法: node crawl-zhihuishan.js <URL> <输出路径> <教材名> <教材ID>');
    process.exit(1);
  }

  let html;
  if (/^https?:\/\//.test(url)) {
    html = execFileSync('curl', ['-sL', '--max-time', '30', url], {
      maxBuffer: 20 * 1024 * 1024,
    }).toString('utf8');
  } else {
    html = fs.readFileSync(url, 'utf8'); // 支持直接解析已缓存的本地 HTML
  }

  const lessons = parse(html);
  if (lessons.length < 10) {
    console.error(`解析异常：只识别到 ${lessons.length} 课，请检查页面结构`);
    process.exit(1);
  }

  const allChars = lessons.flatMap((l) => Array.from(l.chars));
  const book = {
    id,
    name,
    subject: 'chinese',
    note: `数据抓取自智慧山逐课生字表（${new Date().toISOString().slice(0, 10)}），可用 scripts/crawl-zhihuishan.js 重新抓取`,
    lessons,
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(book, null, 2) + '\n');

  console.log(`${name}: ${lessons.length} 课，生字 ${allChars.length} 个（去重 ${new Set(allChars).size}）`);
  console.log(lessons.map((l) => `${l.title}(${l.chars.length})`).join('  '));
}

main();
