// 语文在线练习：看拼音选字——按课出题，四选一，自动判分
const { request } = require('../../../utils/request');
const { api } = require('../../../config/index');
const learning = require('../../../utils/learning');

const ROUND = 10; // 每轮题量（课文生字不足时取全部）
const PROGRESS_KEY = 'cb_zh_quiz_progress';

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

Page({
  data: {
    stage: 'pick', grade: 1, sem: 'a', bookName: '', lessons: [], loading: false,
    idx: 0, total: 0, cur: null, chosen: -1, feedback: '', score: 0,
    rate: 0, stars: '', words: '', wrongChars: [],
  },

  onLoad() {
    let grade = 1;
    try { grade = wx.getStorageSync('cb_grade') || 1; } catch (e) { /* 忽略 */ }
    this.setData({ grade });
    this.loadBook();
    this.checkProgress();
  },

  // ---- 进度保存/续练 ----
  saveProgress() {
    if (this.data.stage !== 'quiz' || !this._qs) return;
    try {
      wx.setStorageSync(PROGRESS_KEY, {
        qs: this._qs, idx: this.data.idx, score: this.data.score, wrongs: this._wrongs,
        lesson: this._lesson, bookId: this.bookId(), bookName: this.data.bookName,
        grade: this.data.grade, sem: this.data.sem, elapsed: Date.now() - this._t0,
      });
    } catch (e) { /* 忽略 */ }
  },
  clearProgress() { try { wx.removeStorageSync(PROGRESS_KEY); } catch (e) { /* 忽略 */ } },
  checkProgress() {
    let p = null;
    try { p = wx.getStorageSync(PROGRESS_KEY); } catch (e) { /* 忽略 */ }
    if (!p || !Array.isArray(p.qs) || !p.qs.length || p.idx >= p.qs.length || !p.lesson) return;
    wx.showModal({
      title: '继续上次练习？',
      content: `${p.lesson.title} · 看拼音选字，已完成 ${p.idx}/${p.qs.length} 题`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (r) => (r.confirm ? this.resume(p) : this.clearProgress()),
    });
  },
  resume(p) {
    this._qs = p.qs;
    this._wrongs = p.wrongs || [];
    this._lesson = p.lesson;
    this._t0 = Date.now() - (p.elapsed || 0);
    this.setData({
      stage: 'quiz', bookName: p.bookName || '', grade: p.grade || this.data.grade, sem: p.sem || 'a',
      total: this._qs.length, idx: p.idx, cur: this._qs[p.idx], chosen: -1, feedback: '', score: p.score,
    });
  },

  bookId() { return `rj-yuwen-${this.data.grade}${this.data.sem}`; },

  loadBook() {
    this.setData({ loading: true, lessons: [], outdated: false });
    request({ url: api.textbook(this.bookId()) })
      .then((d) => {
        this._book = d.book;
        const lessons = (d.book.lessons || []).map((l) => ({
          title: l.title,
          // 旧后端没有逐字拼音 items 时按生字串计数，仅用于展示
          count: (l.items || []).length || Array.from(String(l.chars || '')).length,
        }));
        const outdated = !(d.book.lessons || []).some((l) => (l.items || []).length);
        this._allChars = [];
        (d.book.lessons || []).forEach((l) => (l.items || []).forEach((it) => this._allChars.push(it.ch)));
        this.setData({ bookName: d.book.name, lessons, outdated, loading: false });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '课本加载失败', icon: 'none' });
      });
  },

  onSemTap(e) {
    const sem = e.currentTarget.dataset.sem;
    if (sem === this.data.sem) return;
    this.setData({ sem });
    this.loadBook();
  },

  onLessonTap(e) {
    const lesson = this._book && this._book.lessons[Number(e.currentTarget.dataset.index)];
    if (this.data.outdated) {
      wx.showModal({
        title: '课本注音数据待更新',
        content: '当前后端服务还没有逐字拼音数据。本地开发请启动最新 backend（npm start）并使用本地地址；线上需部署后再试。',
        showCancel: false,
      });
      return;
    }
    if (!lesson || !(lesson.items || []).length) {
      wx.showToast({ title: '本课暂无可练生字', icon: 'none' });
      return;
    }
    this.startLesson(lesson);
  },

  /** 由一课生字生成一轮题：正确项 + 全册生字抽 3 个干扰项 */
  startLesson(lesson) {
    this._lesson = lesson;
    this._t0 = Date.now();
    const pool = shuffle(lesson.items).slice(0, ROUND);
    this._qs = pool.map((it) => {
      const distractors = shuffle((this._allChars || []).filter((c) => c !== it.ch)).slice(0, 3);
      return { py: it.py, answer: it.ch, options: shuffle([it.ch].concat(distractors)) };
    });
    this._wrongs = [];
    this.setData({ stage: 'quiz', total: this._qs.length, idx: 0, cur: this._qs[0], chosen: -1, feedback: '', score: 0 });
    this.saveProgress();
  },

  onOptTap(e) {
    if (this.data.feedback || this.data.stage !== 'quiz') return;
    const idx = Number(e.currentTarget.dataset.index);
    const ch = this.data.cur.options[idx];
    const right = ch === this.data.cur.answer;
    if (right) {
      this.setData({ chosen: idx, feedback: 'right', score: this.data.score + 1 });
    } else {
      this._wrongs.push(this.data.cur.answer);
      this.setData({ chosen: idx, feedback: 'wrong' });
    }
    this._advance = setTimeout(() => this.next(), right ? 600 : 950);
  },

  next() {
    const ni = this.data.idx + 1;
    if (ni >= this.data.total) return this.finish();
    this.setData({ idx: ni, cur: this._qs[ni], chosen: -1, feedback: '' });
    this.saveProgress();
  },

  // ---- 提前交卷 ----
  answeredCount() { return this.data.idx + (this.data.feedback ? 1 : 0); },
  onSubmit() {
    if (this.data.stage !== 'quiz') return;
    const answered = this.answeredCount();
    if (!answered) { wx.showToast({ title: '答完一题才能交卷', icon: 'none' }); return; }
    wx.showModal({
      title: '提前交卷',
      content: `已完成 ${answered}/${this.data.total} 题，确定交卷吗？`,
      success: (r) => { if (r.confirm) this.finish(true); },
    });
  },

  finish(early) {
    const answered = early ? this.answeredCount() : this.data.total;
    if (!answered) return;
    const { score } = this.data;
    const sec = Math.round((Date.now() - this._t0) / 1000);
    const rate = Math.round((score / answered) * 100);
    const stars = rate >= 95 ? '⭐⭐⭐' : rate >= 80 ? '⭐⭐' : rate >= 60 ? '⭐' : '💪';
    const words = rate >= 95 ? '全对！你是识字小达人！' : rate >= 80 ? '很不错，继续保持！' : rate >= 60 ? '有进步空间，再练一轮！' : '别灰心，多认几遍就熟了！';
    const wrongChars = [...new Set(this._wrongs)];
    this.setData({ stage: 'done', total: answered, rate, stars, words, wrongChars });
    learning.logRun('zh', { version: 'zh', bookId: this.bookId(), lesson: this._lesson.title }, answered, score, sec);
    this.clearProgress();
    try {
      wx.setStorageSync('cb_zh_quiz_last', {
        bookId: this.bookId(), bookName: this.data.bookName, lessonTitle: this._lesson.title,
        score, total: answered, rate, at: Date.now(),
      });
    } catch (e) { /* 忽略 */ }
  },

  backToPick() {
    clearTimeout(this._advance);
    this.setData({ stage: 'pick' });
  },

  onRetry() { this.startLesson(this._lesson); },

  onUnload() { clearTimeout(this._advance); this.saveProgress(); },
  onHide() { clearTimeout(this._advance); this.saveProgress(); },

  onShareAppMessage() {
    return { title: '看拼音选字 · 按课在线练', path: '/pages/learn/learn' };
  },
});
