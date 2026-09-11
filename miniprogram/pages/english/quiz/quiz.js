// 英语在线练习：记词拼单词——先出示单词记忆，再用打乱的字母按序拼出
const { request } = require('../../../utils/request');
const { api } = require('../../../config/index');
const learning = require('../../../utils/learning');

const ROUND = 10;   // 每轮词量
const PEEKS = 3;    // 每轮可"看一眼"次数
const MEMO_SEC = 3; // 记词秒数
const PROGRESS_KEY = 'cb_en_quiz_progress';

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** 只取无空格、3-10 个字母的单词做拼词 */
function pickWords(units) {
  const seen = new Set();
  const words = [];
  units.forEach((u) => (u.words || []).forEach((raw) => {
    const w = String(raw || '').trim().toLowerCase();
    if (!/^[a-z]{3,10}$/.test(w) || seen.has(w)) return;
    seen.add(w);
    words.push(w);
  }));
  return words;
}

/** 书名缩写："人教PEP英语四年级上册" → "四上"；词包取名字前 6 字 */
function shortName(b) {
  const m = String(b.name || '').match(/([一二三四五六])年级(上|下)册/);
  if (m) return `${m[1]}${m[2]}`;
  return String(b.name || '').slice(0, 6);
}

Page({
  data: {
    stage: 'pick', books: [], bookId: '', loading: false, units: [],
    selectedCount: 0, roundSize: 0,
    idx: 0, total: 0, cur: null, phase: 'memo', memoSec: MEMO_SEC,
    slots: [], tiles: [], peeks: PEEKS, peekFlash: false,
    score: 0, peekUsed: 0, wrongTaps: 0, stars: '', words: '',
  },

  onLoad() {
    let grade = 4;
    try { grade = wx.getStorageSync('cb_grade') || 4; } catch (e) { /* 忽略 */ }
    this._grade = grade;
    this.loadBooks();
    this.checkProgress();
  },

  // ---- 进度保存/续练 ----
  saveProgress() {
    if (this.data.stage !== 'quiz' || !this._words) return;
    try {
      wx.setStorageSync(PROGRESS_KEY, {
        words: this._words, idx: this.data.idx, score: this._score,
        answered: this._answered, peekUsed: this._peekTotal, wrongTaps: this._wrongTotal,
        peeks: this.data.peeks, bookId: this.data.bookId, elapsed: Date.now() - this._t0,
      });
    } catch (e) { /* 忽略 */ }
  },
  clearProgress() { try { wx.removeStorageSync(PROGRESS_KEY); } catch (e) { /* 忽略 */ } },
  checkProgress() {
    let p = null;
    try { p = wx.getStorageSync(PROGRESS_KEY); } catch (e) { /* 忽略 */ }
    if (!p || !Array.isArray(p.words) || !p.words.length || p.idx >= p.words.length) return;
    wx.showModal({
      title: '继续上次练习？',
      content: `记词拼单词 · 已完成 ${p.idx}/${p.words.length} 词`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (r) => (r.confirm ? this.resume(p) : this.clearProgress()),
    });
  },
  resume(p) {
    this._words = p.words;
    this._score = p.score || 0;
    this._answered = p.answered || p.idx || 0;
    this._peekTotal = p.peekUsed || 0;
    this._wrongTotal = p.wrongTaps || 0;
    this._t0 = Date.now() - (p.elapsed || 0);
    this.setData({
      stage: 'quiz', bookId: p.bookId || '', total: p.words.length, idx: p.idx,
      score: this._score, peekUsed: this._peekTotal, wrongTaps: this._wrongTotal, peeks: p.peeks == null ? PEEKS : p.peeks,
    });
    this.showWord(p.idx);
  },

  loadBooks() {
    request({ url: api.wordbooks })
      .then((d) => {
        const books = (d.items || []).map((b) => ({ id: b.id, short: shortName(b) }));
        this.setData({ books });
        const def = books.find((b) => b.id === `pep-${this._grade}a`) || books[0];
        if (def) this.loadUnits(def.id);
      })
      .catch(() => wx.showToast({ title: '词库加载失败', icon: 'none' }));
  },

  loadUnits(bookId) {
    const cached = this._cache && this._cache[bookId];
    if (cached) return this.applyUnits(bookId, cached);
    this.setData({ loading: true, bookId, units: [] });
    request({ url: api.wordbook(bookId) })
      .then((d) => {
        const units = (d.book.units || []).map((u) => {
          const words = pickWords([u]);
          return { title: u.title, words, count: words.length, selected: false };
        }).filter((u) => u.count > 0);
        this._cache = this._cache || {};
        this._cache[bookId] = units;
        this.setData({ loading: false });
        this.applyUnits(bookId, units);
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '词库加载失败', icon: 'none' });
      });
  },

  applyUnits(bookId, units) {
    this.setData({ bookId, units, selectedCount: 0, roundSize: 0 });
  },

  onBookTap(e) {
    const id = e.currentTarget.dataset.id;
    if (id !== this.data.bookId) this.loadUnits(id);
  },

  onUnitTap(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const units = this.data.units.map((u, i) => (i === idx ? { ...u, selected: !u.selected } : u));
    const words = pickWords(units.filter((u) => u.selected));
    this.setData({ units, selectedCount: words.length, roundSize: Math.min(ROUND, words.length) });
  },

  onStart() {
    if (!this.data.selectedCount) { wx.showToast({ title: '先勾选要练的单元', icon: 'none' }); return; }
    const words = shuffle(pickWords(this.data.units.filter((u) => u.selected))).slice(0, ROUND);
    this._words = words;
    this._peekTotal = 0;
    this._wrongTotal = 0;
    this._score = 0;
    this._answered = 0;
    this._t0 = Date.now();
    this.setData({ stage: 'quiz', total: words.length, idx: 0, score: 0, peekUsed: 0, wrongTaps: 0, peeks: PEEKS, peekFlash: false });
    this.showWord(0);
  },

  showWord(i) {
    const word = this._words[i];
    this._curClean = true;
    this.setData({ idx: i, cur: { word }, phase: 'memo', memoSec: MEMO_SEC, slots: [], tiles: [], peekFlash: false });
    this.saveProgress();
    clearInterval(this._memoTimer);
    let left = MEMO_SEC;
    this._memoTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(this._memoTimer); this.beginSpell(); return; }
      this.setData({ memoSec: left });
    }, 1000);
  },

  beginSpell() {
    clearInterval(this._memoTimer);
    const word = this.data.cur.word;
    const letters = word.split('');
    this.setData({
      phase: 'spell',
      slots: letters.map(() => ''),
      tiles: shuffle(letters).map((ch, i) => ({ key: i, ch, used: false, shake: false })),
    });
  },

  onTileTap(e) {
    if (this.data.phase !== 'spell') return;
    const idx = Number(e.currentTarget.dataset.index);
    const tile = this.data.tiles[idx];
    if (!tile || tile.used) return;
    const slots = this.data.slots;
    const next = slots.indexOf('');
    if (next === -1) return;
    if (tile.ch !== this.data.cur.word[next]) {
      this._curClean = false;
      this._wrongTotal += 1;
      const tiles = this.data.tiles.map((t, i) => (i === idx ? { ...t, shake: true } : t));
      this.setData({ tiles, wrongTaps: this._wrongTotal });
      setTimeout(() => {
        this.setData({ tiles: this.data.tiles.map((t) => (t.shake ? { ...t, shake: false } : t)) });
      }, 300);
      return;
    }
    const tiles = this.data.tiles.map((t, i) => (i === idx ? { ...t, used: true } : t));
    slots[next] = tile.ch;
    this.setData({ tiles, slots: slots.slice() });
    if (slots.every((s) => s)) {
      if (this._curClean) this._score += 1;
      this._answered += 1;
      this.setData({ score: this._score });
      this._advance = setTimeout(() => this.next(), 500);
    }
  },

  onPeek() {
    if (this.data.phase !== 'spell' || !this.data.peeks || this.data.peekFlash) return;
    this._curClean = false;
    this._peekTotal += 1;
    this.setData({ peeks: this.data.peeks - 1, peekUsed: this._peekTotal, peekFlash: true });
    this._peekTimer = setTimeout(() => this.setData({ peekFlash: false }), 1200);
  },

  next() {
    const ni = this.data.idx + 1;
    if (ni >= this.data.total) return this.finish();
    this.showWord(ni);
  },

  // ---- 提前交卷 ----
  onSubmit() {
    if (this.data.stage !== 'quiz') return;
    const answered = this._answered || 0;
    if (!answered) { wx.showToast({ title: '拼完一个词才能交卷', icon: 'none' }); return; }
    wx.showModal({
      title: '提前交卷',
      content: `已完成 ${answered}/${this.data.total} 词，确定交卷吗？`,
      success: (r) => { if (r.confirm) this.finish(true); },
    });
  },

  finish(early) {
    const answered = early ? this._answered : this.data.total;
    if (!answered) return;
    const score = this._score;
    const sec = Math.round((Date.now() - this._t0) / 1000);
    const rate = Math.round((score / answered) * 100);
    const stars = rate >= 95 ? '⭐⭐⭐' : rate >= 80 ? '⭐⭐' : rate >= 60 ? '⭐' : '💪';
    const words = rate >= 95 ? '全凭记忆拼对，太强了！' : rate >= 80 ? '记得很牢，继续保持！' : rate >= 60 ? '多看几眼没关系，下次少看一眼！' : '慢慢来，先混个脸熟！';
    this.setData({ stage: 'done', total: answered, score, stars, words, peekUsed: this._peekTotal, wrongTaps: this._wrongTotal });
    learning.logRun('en', { version: 'en', bookId: this.data.bookId }, answered, score, sec);
    this.clearProgress();
    try {
      wx.setStorageSync('cb_en_quiz_last', {
        bookId: this.data.bookId, score, total: answered, rate,
        peeks: this._peekTotal, wrongTaps: this._wrongTotal, at: Date.now(),
      });
    } catch (e) { /* 忽略 */ }
  },

  backToPick() {
    clearInterval(this._memoTimer);
    clearTimeout(this._advance);
    clearTimeout(this._peekTimer);
    this.setData({ stage: 'pick' });
    if (!this.data.units.length && this.data.bookId) this.loadUnits(this.data.bookId);
  },

  onRetry() { this.onStart(); },

  onUnload() { this.clearTimers(); this.saveProgress(); },
  onHide() { this.clearTimers(); this.saveProgress(); },
  clearTimers() {
    clearInterval(this._memoTimer);
    clearTimeout(this._advance);
    clearTimeout(this._peekTimer);
  },

  onShareAppMessage() {
    return { title: '记词拼单词 · 在线练拼写', path: '/pages/learn/learn' };
  },
});
