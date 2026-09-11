// 在线口算练习：题量可选、单题计时、结算（星级+数据）、错题本
const { request } = require('../../../utils/request');
const { api } = require('../../../config/index');
const learning = require('../../../utils/learning');

const norm = (s) => String(s || '').trim().replace(/\s/g, '').toLowerCase();
const equivalent = (input, answer) => /^\d+(\.\d+)?$/.test(input) && /^\d+(\.\d+)?$/.test(norm(answer)) && Number(input) === Number(answer);

Page({
  data: {
    stage: 'start', showCfg: true, cfg: null, books: [], cfgLabel: '', counts: [10, 20, 30], count: 20,
    total: 0, idx: 0, cur: null, input: '', feedback: '',
    qSec: 0, score: 0, wrongs: [], usedSec: 0, avgSec: 0, rate: 0, stars: '', words: '', draft: false,
  },

  onLoad(q) {
    this._cfg = { version: q.version || 'jijiao', bookId: q.bookId || 'math-1a', difficulty: q.diff || 'standard' };
    this._reviewMode = q.review === '1';
    this.setData({ reviewMode: this._reviewMode });
    this.setData({ cfg: this._cfg, showCfg: q.from !== 'page', cfgLabel: decodeURIComponent(q.label || '口算练习') });
    this.loadBooks();
  },

  async loadBooks() {
    try {
      const d = await request({ url: `${api.mathbooks}?version=${this._cfg.version}` });
      const books = (d.items || []).map((b) => {
        const m = b.name.match(/数学(.+)/);
        return { id: b.id, short: m ? m[1].replace('年级', '').replace('册', '') : b.name.slice(4) };
      });
      if (!books.some((b) => b.id === this._cfg.bookId)) this._cfg.bookId = books[0].id;
      this.setData({ books });
      this.syncLabel();
    } catch (e) { /* 静默 */ }
  },
  syncLabel() {
    const b = (this.data.books || []).find((x) => x.id === this._cfg.bookId);
    const V = { pep: '人教', jijiao: '冀教' };
    const D = { basic: '基础', standard: '巩固', advanced: '培优' };
    this._cfg.label = `${V[this._cfg.version]}·${b ? b.short : ''}·${D[this._cfg.difficulty]}`;
    this.setData({ cfg: this._cfg, cfgLabel: this._cfg.label });
    try { wx.setStorageSync('cb_math_last', { ...this._cfg }); } catch (e) { /* 忽略 */ }
  },
  onCfgVersion(e) { this._cfg.version = e.currentTarget.dataset.v; this.setData({ books: [] }); this.loadBooks(); },
  onCfgBook(e) { this._cfg.bookId = e.currentTarget.dataset.id; this.syncLabel(); },
  onCfgDiff(e) { this._cfg.difficulty = e.currentTarget.dataset.d; this.syncLabel(); },

  onCountTap(e) { this.setData({ count: Number(e.currentTarget.dataset.v) }); },

  async onStart() {
    if (this._reviewMode) {
      const questions = learning.reviewQuestions(this._cfg, false).slice(0, this.data.count);
      if (!questions.length) { wx.showToast({ title: '本册暂无待复习错题', icon: 'none' }); return; }
      await this.start(questions);
    } else await this.start();
  },
  async start(fixedQuestions) {
    if (this._loading) return;
    this._loading = true;
    this._t0 = Date.now();
    this._wrongs = [];
    let questions = fixedQuestions;
    if (!questions) {
      wx.showLoading({ title: '出题中…' });
      try {
        const d = await request({ url: api.mathQuiz, method: 'POST', data: { ...this._cfg, count: this.data.count } });
        questions = d.questions || [];
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: e.message || '出题失败', icon: 'none' });
        this._loading = false;
        return;
      }
      wx.hideLoading();
    }
    this._loading = false;
    if (!questions.length) { wx.showToast({ title: '暂无口算题', icon: 'none' }); return; }
    this._t0 = Date.now();
    this._review = !!fixedQuestions;
    this._locked = false;
    this._qs = questions;
    this._faulted = false;
    this.setData({ stage: 'quiz', total: questions.length, idx: 0, cur: questions[0], input: '', feedback: '', qSec: 0, score: 0, wrongs: [] });
    this.tick();
  },

  tick() {
    clearInterval(this._timer);
    this._qT0 = Date.now();
    this._timer = setInterval(() => {
      if (this.data.stage !== 'quiz') { clearInterval(this._timer); return; }
      this.setData({ qSec: Math.round((Date.now() - this._qT0) / 1000) });
    }, 1000);
  },

  onKey(e) {
    if (this._locked || this.data.stage !== 'quiz') return;
    const k = e.currentTarget.dataset.k;
    if (k === 'del') { this.setData({ input: this.data.input.slice(0, -1), feedback: '' }); return; }
    if (k === 'ok') { this.judge(); return; }
    if (this.data.feedback === 'wrong') return; // 红闪时需先删除再改
    if (this.data.input.length >= 8) return;
    if (k === '.' && (this.data.input.includes('.') || !this.data.input)) return;
    const input = this.data.input + k;
    const ans = norm(this.data.cur.answer);
    if (equivalent(input, ans)) {
      this._locked = true;
      // 输对即自动过题；首错过的题不加分
      const first = !this._faulted;
      this.setData({ input, feedback: 'right', score: this.data.score + (first ? 1 : 0) });
      this._advance = setTimeout(() => this.next(), 350);
      return;
    }
    // 未输完不提示对错，等点确定再判
    this.setData({ input, feedback: '' });
  },

  /** 点确定才判错：错则红闪记录，删除重输到正确自动过 */
  judge() {
    if (this._locked) return;
    const { cur, input } = this.data;
    if (!input) return;
    if (equivalent(input, cur.answer)) {
      this._locked = true;
      const first = !this._faulted;
      this.setData({ feedback: 'right', score: this.data.score + (first ? 1 : 0) });
      this._advance = setTimeout(() => this.next(), 350);
      return;
    }
    if (!this._faulted) {
      this._faulted = true;
      this._wrongs.push(cur);
    }
    this.setData({ feedback: 'wrong' });
  },

  next() {
    this._locked = false;
    const ni = this.data.idx + 1;
    if (ni >= this._qs.length) { this.finish(); return; }
    this._faulted = false;
    this.setData({ idx: ni, cur: this._qs[ni], input: '', feedback: '', qSec: 0 });
    this.tick();
  },

  finish() {
    clearInterval(this._timer);
    const sec = Math.round((Date.now() - this._t0) / 1000);
    const rate = Math.round((this.data.score / this._qs.length) * 100);
    const stars = rate >= 95 ? '⭐⭐⭐' : rate >= 80 ? '⭐⭐' : rate >= 60 ? '⭐' : '💪';
    const words = rate >= 95 ? '太棒了，口算小达人！' : rate >= 80 ? '很不错，继续保持！' : rate >= 60 ? '有进步空间，再来一组！' : '别灰心，练一练就熟了！';
    this.setData({ stage: 'done', usedSec: sec, avgSec: (sec / this._qs.length).toFixed(1), rate, stars, words, wrongs: this._wrongs });
    learning.record(this._cfg, this._qs, this._wrongs, sec, this._review);
    try {
      const old = wx.getStorageSync('cb_math_wrongs') || [];
      wx.setStorageSync('cb_math_wrongs', old.concat(this._wrongs).slice(-100));
    } catch (e) { /* 忽略 */ }
  },

  // ---- 草稿层：全屏透明画板，手指随便写 ----
  onDraftToggle() {
    this.setData({ draft: !this.data.draft }, () => {
      if (this.data.draft) this.initDraftCanvas();
    });
  },
  initDraftCanvas() {
    wx.nextTick(() => {
      this.createSelectorQuery().select('#draft-cv').fields({ node: true, size: true }).exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) return;
        let dpr = 2;
        try { dpr = wx.getSystemInfoSync().pixelRatio || 2; } catch (e) { /* 保底 */ }
        item.node.width = item.width * dpr;
        item.node.height = item.height * dpr;
        this._dctx = item.node.getContext('2d');
        this._dctx.scale(dpr, dpr);
        this._dctx.lineWidth = 3;
        this._dctx.lineCap = 'round';
        this._dctx.strokeStyle = '#5b8def';
      });
    });
  },
  onDraftStart(e) {
    if (!this._dctx) return;
    const t = e.touches[0];
    this._last = { x: t.x, y: t.y };
  },
  onDraftMove(e) {
    if (!this._dctx || !this._last) return;
    const t = e.touches[0];
    this._dctx.beginPath();
    this._dctx.moveTo(this._last.x, this._last.y);
    this._dctx.lineTo(t.x, t.y);
    this._dctx.stroke();
    this._last = { x: t.x, y: t.y };
  },
  onDraftEnd() { this._last = null; },
  onDraftClear() {
    if (!this._dctx) return;
    const c = this._dctx.canvas;
    this._dctx.clearRect(0, 0, c.width, c.height);
  },
  noop() {},

  onUnload() { clearInterval(this._timer); clearTimeout(this._advance); },
  onHide() { clearInterval(this._timer); clearTimeout(this._advance); this._hiddenAt = Date.now(); },
  onShow() {
    if (this.data.stage === 'quiz' && this._hiddenAt) {
      const pause = Date.now() - this._hiddenAt;
      this._t0 += pause;
      const elapsed = this.data.qSec;
      if (this._locked) this.next();
      else { this.tick(); this._qT0 = Date.now() - elapsed * 1000; }
    }
    this._hiddenAt = null;
  },
  onRetry() { this.setData({ stage: 'start' }); },
  onWrongRetry() { this.start(this._wrongs.slice()); },

  onShareAppMessage() {
    return { title: '在线口算练习 · 打开就能练', path: '/pages/math/index/index', imageUrl: '/assets/share-math.png' };
  },

  onShareTimeline() {
    return { title: '在线口算练习', query: '', imageUrl: '/assets/share-math.png' };
  },
});
