'use strict';

/**
 * 数学口算题卡生成 —— 册别/难度双轴（人教版数学核心计算单元）。
 *
 * 册别（book）定"学什么"：每册映射若干题型（计算单元）；
 * 难度（difficulty）在同一单元内调制：basic 基础 / standard 巩固 / advanced 培优。
 * 防呆规则：不出结果 0/负数、避免 a×1 / a+0 类低价值题、同卷题干去重、
 * 表内乘法等小空间题型题量超限自动混入相邻题型。
 *
 * 产出 layout JSON：{type:'math', pages:[{rows}], answerPage}，
 * rows: inline（三列口算）/ vertical（竖式计算框）/ word（应用题）。
 */

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const { scopeFor, wordTopics } = require('./math-curriculum');
const { HttpError } = require('../../utils/http-error');
const { clockSvg } = require('./clock');

// ---- 题型生成器：返回 { stem, answer, layout } ----
const TYPES = {
  'ratio-fill': () => {
    const a = rand(2, 9), b = rand(2, 9), n = rand(2, 12);
    return { stem: `${a} : ${b} = ( ) : ${b * n}`, answer: String(a * n) };
  },
  'volume-cuboid': () => {
    const a = rand(3, 12), b = rand(2, 9), h = rand(2, 8);
    return { stem: `长${a}cm、宽${b}cm、高${h}cm，体积=( )cm³`, answer: String(a * b * h) };
  },
  'fraction-mul': () => {
    const den = rand(3, 12), numerator = rand(1, den - 1), n = rand(2, 20);
    return { stem: `${n} × ${numerator}/${den} =`, answer: fraction(n * numerator, den) };
  },
  'fraction-div': () => {
    const den = rand(3, 12), numerator = rand(1, den - 1), n = rand(2, 9);
    return { stem: `${numerator}/${den} ÷ ${n} =`, answer: fraction(numerator, den * n) };
  },
  'add-10': (d) => { const a = rand(1, d === 'basic' ? 5 : 9); const b = rand(1, 10 - a); return { stem: `${a} + ${b} =`, answer: `${a + b}` }; },
  'sub-10': (d) => { const a = rand(d === 'basic' ? 3 : 5, 10); const b = rand(1, a - 1); return { stem: `${a} - ${b} =`, answer: `${a - b}` }; },
  'add-20': (d) => { const carry = d !== 'basic'; const a = carry ? rand(5, 9) : rand(1, 9); const b = rand(carry ? 11 - a : 1, 20 - a); return { stem: `${a} + ${b} =`, answer: `${a + b}` }; },
  'sub-20': (d) => { const a = rand(11, 18); const ones = a % 10; const b = d === 'basic' ? rand(1, ones) : rand(ones + 1, 9); return { stem: `${a} - ${b} =`, answer: `${a - b}` }; },
  'add-100': (d) => { let a, b; do { a = rand(11, 88); b = rand(11, 100 - a); } while ((a % 10 + b % 10 >= 10) !== (d !== 'basic')); return { stem: `${a} + ${b} =`, answer: `${a + b}` }; },
  'sub-100': (d) => { let a, b; do { a = rand(22, 99); b = rand(11, a - 1); } while ((a % 10 < b % 10) !== (d !== 'basic')); return { stem: `${a} - ${b} =`, answer: `${a - b}` }; },
  'bracket-add': (d) => { const sum = rand(6, d === 'advanced' ? 20 : 10); const a = rand(1, sum - 1); return { stem: `( ) + ${a} = ${sum}`, answer: `${sum - a}` }; },
  'bracket-sub': (d) => { const a = rand(8, d === 'advanced' ? 20 : 15); const b = rand(1, a - 2); return { stem: `${a} - ( ) = ${b}`, answer: `${a - b}` }; },
  'chain-add': (d) => { const m = d === 'basic' ? 10 : 20; const a = rand(1, m - 2); const b = rand(1, m - a - 1); const c = rand(1, m - a - b); return { stem: `${a} + ${b} + ${c} =`, answer: `${a + b + c}` }; },
  'chain-sub': () => { const a = rand(10, 20); const b = rand(1, 5); const c = rand(1, a - b - 1); return { stem: `${a} - ${b} - ${c} =`, answer: `${a - b - c}` }; },
  'compare': (d) => { const m = d === 'basic' ? 20 : d === 'advanced' ? 100 : 50; let a = rand(1, m); let b = rand(1, m); if (a === b) b = b % m + 1; return { stem: `${a} ○ ${b}`, answer: a > b ? '>' : '<' }; },
  'mul-table': () => { const a = rand(2, 9); const b = rand(2, 9); return { stem: `${a} × ${b} =`, answer: `${a * b}` }; },
  'mul-inverse': () => { const a = rand(2, 9); const b = rand(2, 9); return { stem: `( ) × ${b} = ${a * b}`, answer: `${a}` }; },
  'div-table': () => { const b = rand(2, 9); const q = rand(2, 9); return { stem: `${b * q} ÷ ${b} =`, answer: `${q}` }; },
  'mul-1digit': (d) => { const a = d === 'advanced' ? rand(500, 2999) : rand(102, 999); const b = rand(2, 9); return { stem: `${a} × ${b} =`, answer: `${a * b}` }; },
  'div-remainder': (d) => { const b = rand(3, 9); const q = rand(6, d === 'advanced' ? 60 : 30); const r = rand(1, b - 1); return { stem: `${b * q + r} ÷ ${b} =`, answer: `${q}……${r}` }; },
  'add-10000': (d) => { const hi = d === 'basic' ? 999 : d === 'advanced' ? 9999 : 4999; const a = rand(105, hi); const b = rand(95, hi); return { stem: `${a} + ${b} =`, answer: `${a + b}` }; },
  'sub-10000': (d) => { const hi = d === 'basic' ? 999 : 4999; let a = rand(300, hi); let b = rand(95, a - 20); return { stem: `${a} - ${b} =`, answer: `${a - b}` }; },
  'mul-2digit': (d) => { const a = d === 'advanced' ? rand(32, 99) : rand(11, 39); const b = d === 'basic' ? rand(11, 20) : rand(11, 49); return { stem: `${a} × ${b} =`, answer: `${a * b}` }; },
  'mixed-2step': (d) => { const b = rand(2, 9); const c = rand(3, 9); const plus = Math.random() > 0.5; const a = plus ? rand(10, 80) : rand(b * c + 5, b * c + 80); return { stem: `${a} ${plus ? '+' : '-'} ${b} × ${c} =`, answer: `${plus ? a + b * c : a - b * c}` }; },
  'mixed-paren': () => { const a = rand(2, 9); const b = rand(2, 9); const c = rand(2, 9); return { stem: `(${a} + ${b}) × ${c} =`, answer: `${(a + b) * c}` }; },
  'time-elapsed': () => { const h = rand(1, 9); const m = pick([0, 5, 10, 15, 20, 30, 40, 45]); const dur = pick([15, 20, 30, 40, 45, 50, 60, 90]); const total = h * 60 + m + dur; const eh = Math.floor(total / 60); const em = total % 60; const f = (x) => String(x).padStart(2, '0'); return { stem: `${h}:${f(m)} 出发，经过 ${dur} 分钟，( ):${f(em)} 到达`, answer: `${eh}` }; },
  'div-1digit': (d) => { const b = rand(2, 9); const q = d === 'advanced' ? rand(50, 999) : rand(11, 99); return { stem: `${b * q} ÷ ${b} =`, answer: `${q}` }; },
  'decimal-sub': () => { let a = rand(30, 95) / 10; let b = rand(11, 28) / 10; if (b >= a) b = a - 1; return { stem: `${a.toFixed(1)} - ${b.toFixed(1)} =`, answer: `${(a - b).toFixed(1)}` }; },
  'decimal-div': () => { const q = rand(2, 9); const a = rand(12, 96) / 10; const dividend = +(a * q).toFixed(1); return { stem: `${dividend} ÷ ${q} =`, answer: `${a.toFixed(1)}` }; },
  'fraction-add2': () => { const den = rand(4, 12); const sub = Math.random() > 0.5; const n1 = rand(2, den - 1); const n2 = rand(1, sub ? n1 - 1 : den - n1); return { stem: `${n1}/${den} ${sub ? '-' : '+'} ${n2}/${den} =`, answer: `${sub ? n1 - n2 : n1 + n2}/${den}` }; },
  'div-2digit': (d) => { const b = rand(11, 49); const q = d === 'advanced' ? rand(21, 49) : rand(11, 30); return { stem: `${b * q} ÷ ${b} =`, answer: `${q}` }; },
  'vertical-div': (d) => { const b = rand(3, 9); const q = d === 'advanced' ? rand(30, 99) : rand(12, 40); return { stem: `${b * q} ÷ ${b} =`, answer: `${q}`, layout: 'vertical' }; },
  'vertical-add': (d) => { const hi = d === 'advanced' ? 9999 : 999; const a = rand(105, hi); const b = rand(95, hi); return { stem: `${a} + ${b} =`, answer: `${a + b}`, layout: 'vertical' }; },
  'vertical-sub': (d) => { const a = rand(300, 999); const b = rand(95, a - 20); return { stem: `${a} - ${b} =`, answer: `${a - b}`, layout: 'vertical' }; },
  'vertical-decimal': (d) => {
    const plus = Math.random() > 0.45;
    let a = rand(12, d === 'advanced' ? 98 : 60) / 10;
    let b = rand(11, 80) / 10;
    if (!plus) b = Math.min(b, a - 0.5);
    const r = plus ? a + b : a - b;
    return { stem: `${a.toFixed(1)} ${plus ? '+' : '-'} ${b.toFixed(1)} =`, answer: `${r.toFixed(1)}`, layout: 'vertical' };
  },
  'vertical-mul': (d) => { const a = d === 'advanced' ? rand(112, 998) : rand(23, 98); const b = d === 'advanced' ? rand(12, 89) : rand(3, 9); return { stem: `${a} × ${b} =`, answer: `${a * b}`, layout: 'vertical' }; },
  'decimal-add': (d) => { const a = rand(11, d === 'advanced' ? 95 : 60) / 10; const b = rand(11, 60) / 10; return { stem: `${a.toFixed(1)} + ${b.toFixed(1)} =`, answer: `${(a + b).toFixed(1)}` }; },
  'decimal-mul': () => { const a = rand(12, 95) / 10; const b = rand(2, 9); return { stem: `${a.toFixed(1)} × ${b} =`, answer: `${(a * b).toFixed(1)}` }; },
  'fraction-add': () => { const n = rand(1, 8); const m = rand(1, 10 - n); return { stem: `${n}/10 + ${m}/10 =`, answer: `${n + m}/10` }; },
  'percent': () => { const p = pick([10, 20, 25, 50, 75, 80]); const base = pick([20, 40, 60, 80, 120, 200]); return { stem: `${base} 的 ${p}% =`, answer: `${base * p / 100}` }; },
  'unit-convert': (d, scope) => {
    // 参数化双向换算：大单位→小单位（乘进率）与小单位→大单位（除进率）随机
    const pairs = scope.units;
    const [big, small, ratio] = pick(pairs);
    const n = rand(1, Math.max(1, Math.min(Math.floor(scope.max / ratio), d === 'basic' ? 9 : d === 'advanced' ? 60 : 20)));
    if (Math.random() < 0.55) return { stem: `${n}${big} = ( ) ${small}`, answer: `${n * ratio}` };
    return { stem: `${n * ratio}${small} = ( ) ${big}`, answer: `${n}` };
  },
  'word-problem': (d, scope) => curriculumWord(d, scope),
  'clock-read': (d) => clockQuestion(d, false),
  'clock-draw': (d) => clockQuestion(d, true),
};

function fraction(n, d) {
  let a = n, b = d;
  while (b) { const r = a % b; a = b; b = r; }
  return d / a === 1 ? String(n / a) : `${n / a}/${d / a}`;
}

function clockQuestion(d, blank) {
  const hour = rand(1, 12);
  const minute = d === 'basic' ? pick([0, 30]) : d === 'standard' ? rand(0, 11) * 5 : rand(0, 59);
  const time = `${hour}:${String(minute).padStart(2, '0')}`;
  return { stem: blank ? `画出 ${time} 的时针和分针` : '看钟面，写时间', answer: time,
    layout: 'clock', clock: { hour, minute, blank } };
}

function curriculumWord(d, scope) {
  const topic = pick(scope.wordTopics || wordTopics(scope));
  let stem, answer;
  if (topic === 'additive') {
    const max = d === 'basic' ? Math.min(scope.max, 50) : scope.max;
    const total = rand(6, max), a = rand(2, total - 2), b = total - a;
    if (!scope.types.some((t) => t.startsWith('sub-')) || Math.random() < 0.5) { stem = `图书角有故事书 ${a} 本，绘本 ${b} 本，一共有多少本书？`; answer = `${total}本`; }
    else { stem = `图书角有 ${total} 本书，借走 ${a} 本，还剩多少本？`; answer = `${b}本`; }
  } else if (topic === 'multiply' || topic === 'divide') {
    const table = scope.bookId[5] <= '2';
    const n = rand(2, table ? 9 : d === 'basic' ? 20 : 90);
    const twoDigits = topic === 'multiply' ? scope.types.includes('mul-2digit') : scope.types.includes('div-2digit');
    const groups = rand(2, table || !twoDigits ? 9 : 30);
    if (topic === 'multiply') { stem = `每盒有 ${n} 支铅笔，${groups} 盒一共有多少支？`; answer = `${n * groups}支`; }
    else { stem = `${n * groups} 本书平均分给 ${groups} 个小组，每组分到多少本？`; answer = `${n}本`; }
  } else if (topic === 'decimal') {
    const a = rand(12, 90), b = rand(11, 80);
    if (scope.types.includes('decimal-mul') && d !== 'basic') {
      const weight = rand(12, 45);
      stem = `苹果每千克 ${(a / 10).toFixed(1)} 元，买 ${(weight / 10).toFixed(1)} 千克，应付多少元？`;
      answer = `${(a * weight / 100).toFixed(2)}元`;
    } else if (scope.types.includes('decimal-div') && Math.random() < 0.5) {
      const packs = rand(2, 9);
      stem = `${packs} 袋大米一共重 ${(a * packs / 10).toFixed(1)} 千克，平均每袋重多少千克？`;
      answer = `${(a / 10).toFixed(1)}千克`;
    } else {
      stem = `一本练习本 ${(a / 10).toFixed(1)} 元，一支笔 ${(b / 10).toFixed(1)} 元，一共多少元？`;
      answer = `${((a + b) / 10).toFixed(1)}元`;
    }
  } else if (topic === 'fraction-mul') {
    const den = rand(3, 12), numerator = rand(1, den - 1), whole = den * rand(5, 20);
    stem = `一本书有 ${whole} 页，已经看了全书的 ${numerator}/${den}，还剩多少页没看？`;
    answer = `${whole - whole * numerator / den}页`;
  } else if (topic === 'fraction-div') {
    const den = rand(3, 12), numerator = rand(1, den - 1), count = rand(2, 8);
    stem = `把 ${numerator}/${den} 米长的彩带平均分成 ${count} 段，每段长多少米？`;
    answer = `${fraction(numerator, den * count)}米`;
  } else if (topic === 'fraction') {
    const den = rand(4, 12), a = rand(1, den - 2), b = rand(1, den - a);
    stem = `一条彩带，第一次用了全长的 ${a}/${den}，第二次用了全长的 ${b}/${den}，一共用了全长的几分之几？`;
    answer = `${a + b}/${den}`;
  } else if (topic === 'ratio') {
    const a = rand(1, 4), b = rand(a + 1, 7), part = rand(5, 30);
    stem = `把 ${(a + b) * part} 本书按 ${a}:${b} 分给甲、乙两个班，乙班比甲班多分到多少本？`;
    answer = `${(b - a) * part}本`;
  } else if (topic === 'volume') {
    const a = rand(3, 12), b = rand(2, 9), h = rand(2, 8);
    stem = `一个长方体盒子，长 ${a} 厘米，宽 ${b} 厘米，高 ${h} 厘米，它的体积是多少立方厘米？`;
    answer = `${a * b * h}立方厘米`;
  } else {
    const price = rand(4, 30) * 20, pct = pick([10, 20, 25, 50]);
    stem = `一件衣服原价 ${price} 元，优惠 ${pct}%，现在售价多少元？`;
    answer = `${price * (100 - pct) / 100}元`;
  }
  return { stem, answer, layout: 'word', knowledge: topic };
}


// ---- 册别 → 核心计算单元（以课本为准；冀教版按其进度整理） ----
const PEP_BOOKS = {
  // 2024 新版（2024 起逐年替换，在读）——映射自电子课本网各册目录（2026-09 采集），
  // 注意新版单元迁移：万以内加减前移二下、两位数乘两位数移四上、除数两位数移四下
  'math-1a': { name: '一年级上册', types: ['add-10', 'sub-10', 'add-20', 'chain-add', 'chain-sub'] },
  'math-1b': { name: '一年级下册', types: ['sub-20', 'add-100', 'sub-100', 'vertical-add', 'vertical-sub', 'unit-convert'] }, // 退位减、口算、笔算、人民币
  'math-2a': { name: '二年级上册', types: ['mul-table', 'mul-inverse', 'div-table', 'add-100', 'sub-100', 'unit-convert'] }, // 表内乘除、厘米和米、复习
  'math-2b': { name: '二年级下册', types: ['div-remainder', 'add-10000', 'sub-10000', 'vertical-add', 'vertical-sub', 'unit-convert'] }, // 有余数、万以内笔算（新版前移）、时间
  'math-3a': { name: '三年级上册', types: ['mixed-2step', 'mixed-paren', 'mul-1digit', 'vertical-mul', 'unit-convert', 'fraction-add'] }, // 混合运算、乘法笔算、长度质量、分数初步
  'math-3b': { name: '三年级下册', types: ['div-1digit', 'vertical-div', 'decimal-add', 'vertical-decimal', 'unit-convert', 'word-problem'] }, // 除法笔算、小数初步、年月日
  'math-4a': { name: '四年级上册', types: ['mul-2digit', 'vertical-mul', 'vertical-div', 'vertical-decimal', 'add-10000', 'sub-10000', 'word-problem'] }, // 多位数乘两位数笔算 + 复习
  'math-5a': { name: '五年级上册', types: ['decimal-mul', 'decimal-div', 'decimal-add', 'decimal-sub', 'vertical-decimal', 'mixed-2step', 'word-problem'] }, // 小数乘除
  'math-6a': { name: '六年级上册', types: ['fraction-add2', 'fraction-add', 'percent', 'mixed-2step', 'word-problem'] }, // 分数乘除、百分数、负数
  // 2013 版（新版 2027 春才出，当前在读）
  'math-4b': { name: '四年级下册', types: ['mixed-2step', 'mixed-paren', 'decimal-add', 'decimal-sub', 'vertical-decimal', 'mul-2digit', 'vertical-mul', 'unit-convert', 'word-problem'] }, // 四则运算、运算律、小数意义（名数换算）、小数加减
  'math-5b': { name: '五年级下册', types: ['fraction-add2', 'fraction-add', 'div-table', 'unit-convert', 'word-problem'] }, // 分数加减、体积容积换算
  'math-6b': { name: '六年级下册', types: ['percent', 'mixed-2step', 'decimal-mul', 'vertical-decimal', 'word-problem'] }, // 百分数二、比例、总复习
};

// 冀教版数学（进度与人教略有差异：乘法口诀稍晚、除法更早入两三位数、分数/小数次序不同）
const JJ_BOOKS = {
  // 新课标版（2024 起逐年替换，在读）——映射自电子课本网各册目录（2026-09 采集）
  'math-1a': { name: '一年级上册', types: ['add-10', 'add-20', 'chain-add'] }, // 10以内加减、20以内加法（新版上册只学加法）
  'math-1b': { name: '一年级下册', types: ['sub-20', 'add-100', 'sub-100', 'vertical-add', 'vertical-sub'] }, // 20减法、100内口算、两位数±两位数笔算
  'math-2a': { name: '二年级上册', types: ['add-100', 'sub-100', 'mul-table', 'mul-inverse', 'div-table', 'unit-convert'] }, // 100内加减、口诀、求商、人民币
  'math-2b': { name: '二年级下册', types: ['div-remainder', 'add-10000', 'sub-10000', 'vertical-add', 'vertical-sub', 'unit-convert'] }, // 有余数除法、大数口算、三位数笔算、时间长度
  'math-3a': { name: '三年级上册', types: ['mul-1digit', 'div-1digit', 'vertical-mul', 'vertical-div', 'unit-convert'] }, // 多位数乘/除以一位数口算笔算、质量
  'math-3b': { name: '三年级下册', types: ['mul-2digit', 'vertical-mul', 'decimal-add', 'vertical-decimal', 'vertical-add', 'vertical-sub', 'unit-convert', 'word-problem'] }, // 两位数×两位数、小数初步、长度年月日
  'math-4a': { name: '四年级上册', types: ['div-2digit', 'vertical-div', 'mul-2digit', 'vertical-mul', 'vertical-decimal', 'vertical-add', 'vertical-sub', 'add-10000', 'sub-10000', 'unit-convert', 'word-problem'] }, // 除数两位数口算笔算、更大的数、度量衡
  'math-5a': { name: '五年级上册', types: ['decimal-add', 'decimal-sub', 'decimal-mul', 'decimal-div', 'vertical-decimal', 'vertical-mul', 'vertical-div', 'mixed-2step', 'word-problem'] }, // 小数认识与加减、小数乘除、小数应用
  'math-6a': { name: '六年级上册', types: ['fraction-add2', 'percent', 'ratio-fill', 'mixed-2step', 'word-problem'] }, // 比和比例、百分数
  // 经典版（新版 2027 春才出版，当前在读）
  'math-4b': { name: '四年级下册', types: ['mul-2digit', 'vertical-mul', 'fraction-add', 'decimal-add', 'decimal-sub', 'vertical-decimal', 'vertical-div', 'word-problem'] }, // 三位数×两位数、分数意义、小数认识、小数加减
  'math-5b': { name: '五年级下册', types: ['fraction-add2', 'fraction-mul', 'fraction-div', 'volume-cuboid', 'unit-convert', 'word-problem'] }, // 分数乘除、体积容积换算
  'math-6b': { name: '六年级下册', types: ['percent', 'mixed-2step', 'decimal-mul', 'vertical-decimal', 'vertical-mul', 'vertical-div', 'word-problem'] }, // 负数/正反比例/圆柱圆锥 + 数与代数总复习
};

const VERSIONS = { pep: { label: '人教版', books: PEP_BOOKS }, jijiao: { label: '冀教版', books: JJ_BOOKS } };
for (const [version, v] of Object.entries(VERSIONS)) {
  for (const [id, book] of Object.entries(v.books)) {
    const scope = scopeFor(version, id, book.types);
    if (!scope.units.length) book.types = book.types.filter((t) => t !== 'unit-convert');
    if (!book.types.includes('word-problem')) book.types.push('word-problem');
    if (id === 'math-2b') book.types.push('clock-read', 'clock-draw', 'time-elapsed');
  }
}
const BOOKS = PEP_BOOKS; // 向后兼容（测试/默认）

const DIFF_LABELS = { basic: '基础', standard: '巩固', advanced: '培优' };
const MAX_QUESTIONS = 100;
const MAX_WORDS = 10;

function listBooks(version) {
  const v = VERSIONS[version] || VERSIONS.pep;
  return Object.entries(v.books)
    .map(([id, b]) => ({ id, name: `${v.label}数学${b.name}` }))
    .sort((x, y) => {
      const g = (i) => Number(i.slice(5, 6)) || 0; // math-Nx → N
      const t = (i) => (i.slice(6) === 'a' ? 0 : 1); // 上册在前
      return g(x.id) - g(y.id) || t(x.id) - t(y.id);
    });
}

function scopedQuestion(type, difficulty, scope) {
  let q;
  const max = scope.max;
  if (type === 'div-remainder') {
    const b = rand(2, 9), n = rand(2, 9), r = rand(1, b - 1);
    q = { stem: `${b * n + r} ÷ ${b} =`, answer: `${n}……${r}` };
  } else if (type === 'mul-1digit') {
    const a = rand(12, Math.min(scope.max - 1, 999)), b = rand(2, 9);
    q = { stem: `${a} × ${b} =`, answer: `${a * b}` };
  } else if (['vertical-add', 'vertical-sub', 'add-10000', 'sub-10000'].includes(type)) {
    const top = difficulty === 'basic' ? Math.min(max, 999) : max;
    const total = rand(20, top), a = rand(10, total - 1), b = total - a;
    const sub = type.includes('sub');
    q = { stem: sub ? `${total} - ${a} =` : `${a} + ${b} =`,
      answer: String(sub ? b : total), layout: type.startsWith('vertical') ? 'vertical' : undefined };
  } else if (type === 'vertical-mul') {
    const two = scope.types.includes('mul-2digit');
    const a = rand(12, difficulty === 'basic' ? 99 : 999), b = rand(2, two ? 99 : 9);
    q = { stem: `${a} × ${b} =`, answer: String(a * b), layout: 'vertical' };
  } else if (type === 'vertical-div') {
    const b = rand(scope.types.includes('div-2digit') ? 11 : 2, scope.types.includes('div-2digit') ? 49 : 9);
    const n = rand(2, 99);
    q = { stem: `${b * n} ÷ ${b} =`, answer: String(n), layout: 'vertical' };
  } else {
    q = TYPES[type](difficulty, scope);
  }
  return { ...q, type, version: scope.version, bookId: scope.bookId };
}

function buildMathSheet({ title, bookId, options = {} }) {
  const version = VERSIONS[options.version] ? options.version : 'jijiao';
  const bookIdNorm = VERSIONS[version].books[bookId] ? bookId : 'math-1a';
  const book = VERSIONS[version].books[bookIdNorm];
  const difficulty = ['basic', 'standard', 'advanced'].includes(options.difficulty) ? options.difficulty : 'standard';
  const count = Math.min(Math.max(1, Math.floor(Number(options.count) || 50)), MAX_QUESTIONS);
  const types = [...new Set(Array.isArray(options.types) && options.types.length ? options.types : book.types)];
  if (types.some((t) => !TYPES[t] || !book.types.includes(t))) {
    throw new HttpError(400, '所选题型不属于本册，请重新选择');
  }
  const scope = scopeFor(version, bookIdNorm, book.types);
  if (Array.isArray(options.wordTopics) && options.wordTopics.length) {
    const allowed = wordTopics(scope);
    if (options.wordTopics.some((t) => !allowed.includes(t))) throw new HttpError(400, '应用题知识点不属于本册');
    scope.wordTopics = [...new Set(options.wordTopics)];
  }
  const questions = [], seen = new Set();
  const target = types.every((t) => t === 'word-problem') ? Math.min(count, MAX_WORDS) : count;
  // Keep the selected scope even when its finite question pool is exhausted.
  for (let i = 0; i < target; i += 1) {
    let q, unique = false;
    for (let offset = 0; offset < types.length && !unique; offset += 1) {
      const t = types[(i + offset) % types.length];
      for (let attempt = 0; attempt < 300; attempt += 1) {
        q = scopedQuestion(t, difficulty, scope);
        if (!seen.has(q.stem + JSON.stringify(q.clock || ''))) { unique = true; break; }
      }
    }
    seen.add(q.stem + JSON.stringify(q.clock || ''));
    questions.push(q);
  }
  const section = (q) => q.layout === 'word' ? '应用题' : q.layout === 'vertical' ? '竖式计算' :
    q.layout === 'clock' ? (q.clock.blank ? '画钟表' : '认识钟表') :
    q.type === 'unit-convert' ? '单位换算' : '口算题';
  const names = ['口算题', '单位换算', '竖式计算', '应用题', '认识钟表', '画钟表'];
  questions.sort((a, b) => names.indexOf(section(a)) - names.indexOf(section(b)));
  questions.forEach((q, i) => { q.no = i + 1; });
  const pages = [];
  let rows = [], used = 0, sectionNumber = 0;
  const capacity = 240;
  const nextPage = () => { if (rows.length) pages.push({ number: pages.length + 1, rows }); rows = []; used = 0; };
  names.forEach((name) => {
    const group = questions.filter((q) => section(q) === name);
    if (!group.length) return;
    sectionNumber += 1;
    const kind = group[0].layout || 'inline';
    const wide = Math.max(...group.map((q) => Array.from(q.stem).reduce((n, ch) => n + (/[^\x00-\x7F]/.test(ch) ? 1 : 0.6), 0)));
    const columns = kind === 'word' ? 1 : kind === 'vertical' ? 2 : kind === 'clock' ? 4 : wide > 25 ? 2 : wide > 15 ? 3 : 4;
    const heading = `${sectionNumber}、${name}`;
    let first = true;
    for (let i = 0; i < group.length; i += columns) {
      const items = group.slice(i, i + columns).map((q) => ({ ...q,
        clockImage: q.clock ? `data:image/svg+xml;base64,${Buffer.from(clockSvg(q.clock)).toString('base64')}` : undefined }));
      const heightMm = kind === 'word' ? Math.max(42, Math.ceil(items[0].stem.length / 44) * 6 + 28) :
        kind === 'vertical' ? 36 : kind === 'clock' ? 52 : 11;
      if (used + heightMm + (first ? 9 : 0) > capacity) { nextPage(); first = true; }
      if (first) { rows.push({ kind: 'section', text: heading + (i ? '（续）' : ''), heightMm: 9 }); used += 9; first = false; }
      rows.push({ kind, columns, heightMm, items }); used += heightMm;
    }
  });
  nextPage();
  const withAnswer = options.withAnswer !== false;
  const sheet = {
    type: 'math', title: title || `${VERSIONS[version].label}${book.name}数学练习`,
    options: { version, bookId: bookIdNorm, difficulty, count, withAnswer, types, wordTopics: scope.wordTopics || wordTopics(scope) },
    charCount: questions.length, pages, questions,
    notice: seen.size < target ? '所选题型的不同题目有限，已在所选范围内安排重复巩固。' : '',
  };
  if (withAnswer) sheet.answerPage = { rows: [{ kind: 'answer', items: questions.map((q) => ({ no: q.no, answer: q.answer })) }] };
  return sheet;
}

const TYPE_LABELS = {
  'ratio-fill': '比例填空', 'volume-cuboid': '长方体体积',
  'fraction-mul': '分数乘法', 'fraction-div': '分数除法',
  'clock-read': '认识钟表', 'clock-draw': '画时针和分针',
  'add-10': '10以内加法', 'sub-10': '10以内减法', 'add-20': '20以内加法', 'sub-20': '20以内减法',
  'add-100': '100以内加法', 'sub-100': '100以内减法', 'bracket-add': '括号加法', 'bracket-sub': '括号减法',
  'chain-add': '连加', 'chain-sub': '连减', 'compare': '比大小', 'mul-table': '表内乘法', 'mul-inverse': '乘法填空',
  'div-table': '表内除法', 'mul-1digit': '多位数乘一位数', 'div-remainder': '有余数除法',
  'add-10000': '万以内加法', 'sub-10000': '万以内减法', 'mul-2digit': '两位数乘法',
  'mixed-2step': '两步混合', 'mixed-paren': '带括号混合', 'vertical-mul': '竖式乘法', 'vertical-div': '竖式除法', 'vertical-add': '竖式加法', 'vertical-sub': '竖式减法', 'vertical-decimal': '竖式小数加减', 'div-2digit': '除数两位数除法', 'time-elapsed': '经过时间', 'div-1digit': '多位数除以一位数', 'decimal-sub': '小数减法', 'decimal-div': '小数除法', 'fraction-add2': '同分母分数加减',
  'decimal-add': '小数加法', 'decimal-mul': '小数乘法', 'fraction-add': '同分母分数', 'percent': '百分数',
  'unit-convert': '单位换算', 'word-problem': '应用题',
};

function exampleFor(version, id, type) {
  return scopedQuestion(type, 'standard', scopeFor(version, id, VERSIONS[version].books[id].types)).stem;
}

module.exports = { buildMathSheet, listBooks, BOOKS, TYPES, TYPE_LABELS, VERSIONS, MAX_QUESTIONS, exampleFor };
