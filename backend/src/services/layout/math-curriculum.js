'use strict';

// Explicit volume constraints. These are supported practice scopes, not a claim
// that every unit of every textbook edition has been transcribed.
const UNITS = {
  money: ['元', '角', 10], length: ['米', '厘米', 100],
  decimeter: ['米', '分米', 10], mass: ['千克', '克', 1000],
  tonne: ['吨', '千克', 1000], distance: ['千米', '米', 1000],
  time: ['时', '分', 60], second: ['分', '秒', 60],
  capacity: ['升', '毫升', 1000], volume: ['立方米', '立方分米', 1000],
  areaDm: ['平方米', '平方分米', 100], areaCm: ['平方分米', '平方厘米', 100],
};

const SCOPES = {
  pep: {
    'math-1a': [20, []], 'math-1b': [100, ['money']],
    'math-2a': [100, ['length']], 'math-2b': [1000, ['time', 'second']],
    'math-3a': [1000, ['length', 'distance', 'mass', 'tonne']],
    'math-3b': [1000, ['time', 'second', 'areaDm', 'areaCm']],
    'math-4a': [10000, []], 'math-4b': [10000, ['length', 'distance', 'mass']],
    'math-5a': [10000, []], 'math-5b': [10000, ['volume', 'capacity']],
    'math-6a': [10000, []], 'math-6b': [10000, ['volume', 'capacity']],
  },
  jijiao: {
    'math-1a': [20, []], 'math-1b': [100, []],
    'math-2a': [100, ['money']],
    'math-2b': [1000, ['length', 'decimeter', 'mass', 'time', 'second']],
    'math-3a': [1000, ['mass', 'tonne']],
    'math-3b': [1000, ['length', 'distance', 'areaDm', 'areaCm']],
    'math-4a': [10000, ['capacity']], 'math-4b': [10000, []],
    'math-5a': [10000, []], 'math-5b': [10000, ['volume', 'capacity']],
    'math-6a': [10000, []], 'math-6b': [10000, ['volume', 'capacity']],
  },
};

function scopeFor(version, bookId, types) {
  const [max, units] = SCOPES[version][bookId];
  return { version, bookId, max, units: units.map((id) => UNITS[id]), types };
}

function wordTopics(scope) {
  const ts = scope.types;
  const topics = [];
  if (ts.some((t) => /^(add-|sub-|chain-)/.test(t))) topics.push('additive');
  if (ts.some((t) => /^(mul-|vertical-mul)/.test(t))) topics.push('multiply');
  if (ts.some((t) => /^(div-|vertical-div)/.test(t))) topics.push('divide');
  if (ts.some((t) => /decimal/.test(t))) topics.push('decimal');
  if (ts.includes('fraction-add2') || ts.includes('fraction-add')) topics.push('fraction');
  if (ts.includes('fraction-mul')) topics.push('fraction-mul');
  if (ts.includes('fraction-div')) topics.push('fraction-div');
  if (ts.includes('percent')) topics.push('percent');
  if (ts.includes('ratio-fill')) topics.push('ratio');
  if (ts.includes('volume-cuboid')) topics.push('volume');
  if (ts.includes('perimeter')) topics.push('perimeter');
  if (ts.includes('area') || ts.includes('polygon-area')) topics.push('area');
  return topics;
}

const WORD_LABELS = { additive: '加减法应用', multiply: '乘法应用', divide: '除法应用', decimal: '小数应用',
  fraction: '分数加减应用', 'fraction-mul': '分数乘法应用', 'fraction-div': '分数除法应用',
  percent: '百分数应用', ratio: '按比例分配', volume: '长方体体积',
  perimeter: '周长应用', area: '面积应用' };
module.exports = { scopeFor, wordTopics, WORD_LABELS };
