// 英语打印第一期：首页 → 教材/单元单选 → 动态配置 → 生成
const { request } = require('../../utils/request');
const { api } = require('../../config/index');
const { addHistory } = require('../../utils/history');
const { enableShareTickets, rewardedShare } = require('../../utils/share-reward');

const PAPERS = ['classic', 'plain'];
const CASES = ['origin', 'upper', 'lower'];
const ENGLISH_FONTS = ['hengshui', 'print', 'rounded'];
const ENGLISH_FONT_NAMES = ['衡水体', '标准印刷体', '圆润体'];
const LETTERS = 'Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz';
const STORAGE_KEY = 'cb_en_print_selection';
const PAGE_PATH = '/pages/english/english';

// 同一路由以不同 stage 进入，微信会为每一步建立真实页面栈；
// 草稿只在当前小程序进程内共享，让系统返回键按页面栈逐级返回且设置不丢失。
let flowDraft = null;

const STAGE_TITLES = {
  home: '英语打印',
  select: '选择教材',
  config: '英语练习配置',
  settings: '英语样式设置',
  more: '更多功能',
};

const EXERCISES = {
  word: { title: '单词练习', subtitle: '单词描红 · 默写', icon: 'Aa' },
  sentence: { title: '句子练习', subtitle: '句子描红 · 听写', icon: '…' },
  unscramble: { title: '连词成句', subtitle: '单词乱序 · 排序', icon: '⇄' },
};

const PRACTICE_MODES = {
  word: [
    { id: 'copy', name: '单词描红', desc: '范词 + 横向描红练习', recommended: true },
    { id: 'zh2en', name: '听写单词', desc: '显示中文释义，听写英文' },
  ],
  sentence: [
    { id: 'copy', name: '句子描红', desc: '英文范句 + 空白书写', recommended: true },
    { id: 'zh2en', name: '听写句子', desc: '显示中文句子，听写完整英文' },
  ],
};

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function displayUnit(unit) {
  if (!unit) return '';
  return /^Unit\s/i.test(unit.title) ? unit.title : `Unit ${unit.unitNo} ${unit.title}`;
}

function previewRepeatSamples(word) {
  const length = Array.from(String(word || '')).length;
  const count = length <= 5 ? 6 : length <= 7 ? 5 : length <= 9 ? 4 : length <= 12 ? 3 : 2;
  return Array.from({ length: count }, (_, index) => ({ style: index === 0 ? 'demo' : 'trace' }));
}

function stageTitle(stage, type, source) {
  if (stage === 'select' && source === 'pack') return '选择主题词包';
  if (stage === 'config') {
    if (type === 'alphabet') return '字母书写';
    return (EXERCISES[type] || EXERCISES.word).title;
  }
  return STAGE_TITLES[stage] || STAGE_TITLES.home;
}

Page({
  data: {
    stage: 'home',
    pageTitle: '英语打印',
    exerciseType: 'word',
    exercise: EXERCISES.word,
    loading: false,
    submitting: false,
    quotaRemaining: null,
    shareBonus: 0,

    versions: [{ id: 'pep', name: '人教PEP' }, { id: 'jj', name: '冀教版' }],
    versionIndex: 0,
    grades: [3, 4, 5, 6],
    gradeIndex: 0,
    semesters: [{ id: 'a', name: '上册' }, { id: 'b', name: '下册' }],
    semesterIndex: 0,
    currentBook: null,
    units: [],
    unitIndex: 0,
    currentUnit: null,
    coverageText: '',

    practiceModes: PRACTICE_MODES.word,
    practiceIndex: 0,
    showTranslation: false,
    answerSheet: true,
    paperIndex: 0,
    caseIndex: 0,
    fontIndex: 0,
    traceCount: 1,
    blankCount: 3,
    styleSummary: '衡水体 · 保持原样 · 仿真字帖纸 · 描红 1 遍 · 每题 3 行',
    preview: null,
    sourceKind: 'textbook',
    packBooks: [],
    caseNames: ['保持原样', '全部大写', '全部小写'],
    fontNames: ENGLISH_FONT_NAMES,
  },

  books: [],
  bookCache: {},
  pendingQuery: null,

  onLoad(query) {
    enableShareTickets();
    const params = query || {};
    const stage = STAGE_TITLES[params.stage] ? params.stage : (params.mode === 'dictation' ? 'select' : 'home');
    const type = params.type || (flowDraft && flowDraft.exerciseType) || 'word';
    const source = params.source || (flowDraft && flowDraft.sourceKind) || 'textbook';
    const pageTitle = stageTitle(stage, type, source);
    this.pendingQuery = params;
    this.setData({ stage, pageTitle });
    wx.setNavigationBarTitle({ title: pageTitle });
    if (stage !== 'home') this.restoreFlowOptions(type, params);
    this._loaded = true;
    if (stage === 'settings' || (stage === 'config' && type === 'alphabet')) return;
    this.loadBooks();
  },

  onShow() {
    if (this._shownOnce && this.data.stage !== 'home') this.restoreFlowOptions(this.data.exerciseType, {});
    this._shownOnce = true;
    this.refreshQuota();
  },

  onHide() {
    if (this.data.stage !== 'home') this.saveFlowDraft();
  },

  onUnload() {
    if (this.data.stage !== 'home') this.saveFlowDraft();
  },

  restoreFlowOptions(type, params = {}) {
    const isAlphabet = type === 'alphabet';
    const exercise = isAlphabet
      ? { title: '字母书写', subtitle: '26 个字母', icon: 'Aa' }
      : (EXERCISES[type] || EXERCISES.word);
    const practiceModes = isAlphabet ? [] : (PRACTICE_MODES[type] || []);
    const sameDraft = flowDraft && flowDraft.exerciseType === type ? flowDraft : {};
    const patch = {
      exerciseType: type,
      exercise,
      practiceModes,
      practiceIndex: params.mode === 'dictation' ? 1 : (sameDraft.practiceIndex || 0),
      showTranslation: sameDraft.showTranslation === true,
      answerSheet: isAlphabet ? false : sameDraft.answerSheet !== false,
      paperIndex: Number.isInteger(sameDraft.paperIndex) ? sameDraft.paperIndex : 0,
      caseIndex: Number.isInteger(sameDraft.caseIndex) ? sameDraft.caseIndex : 0,
      fontIndex: Number.isInteger(sameDraft.fontIndex) ? sameDraft.fontIndex : 0,
      traceCount: Number.isInteger(sameDraft.traceCount) ? sameDraft.traceCount : 1,
      blankCount: Number.isInteger(sameDraft.blankCount) ? sameDraft.blankCount : 3,
      sourceKind: params.source || sameDraft.sourceKind || 'textbook',
      currentBook: sameDraft.currentBook || this.data.currentBook,
      currentUnit: sameDraft.currentUnit || this.data.currentUnit,
    };
    this.setData(patch, () => {
      this.refreshPreview();
      this.refreshSummary();
    });
  },

  saveFlowDraft() {
    flowDraft = {
      exerciseType: this.data.exerciseType,
      practiceIndex: this.data.practiceIndex,
      showTranslation: this.data.showTranslation,
      answerSheet: this.data.answerSheet,
      paperIndex: this.data.paperIndex,
      caseIndex: this.data.caseIndex,
      fontIndex: this.data.fontIndex,
      traceCount: this.data.traceCount,
      blankCount: this.data.blankCount,
      sourceKind: this.data.sourceKind,
      bookId: this.data.currentBook && this.data.currentBook.id,
      unitNo: this.data.currentUnit && this.data.currentUnit.unitNo,
      currentBook: this.data.currentBook,
      currentUnit: this.data.currentUnit,
    };
  },

  navigateStage(stage, extra = '') {
    const type = this.data.exerciseType || 'word';
    const source = this.data.sourceKind || 'textbook';
    this.saveFlowDraft();
    wx.navigateTo({ url: `${PAGE_PATH}?stage=${stage}&type=${type}&source=${source}${extra}` });
  },

  async refreshQuota() {
    try {
      const data = await request({ url: api.quota });
      this.setData({ quotaRemaining: data.remaining, shareBonus: data.shareBonus || 0 });
    } catch (e) { /* 不阻塞主流程 */ }
  },

  async loadBooks() {
    this.setData({ loading: true });
    try {
      const data = await request({ url: api.wordbooks });
      const items = data.items || [];
      this.books = items.filter((book) => book.kind === 'textbook');
      const packBooks = items.filter((book) => book.kind === 'pack');
      this.setData({ packBooks });
      this.pendingQuery = null;
      this.restoreSelection();
    } catch (e) {
      wx.showToast({ title: '英语教材加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  restoreSelection(callback) {
    let saved = null;
    try { saved = wx.getStorageSync(STORAGE_KEY); } catch (e) { /* ignore */ }
    const draftBookId = flowDraft && flowDraft.exerciseType === this.data.exerciseType && flowDraft.bookId;
    const preferredUnitNo = flowDraft && flowDraft.exerciseType === this.data.exerciseType
      ? flowDraft.unitNo : saved && saved.unitNo;
    if (this.data.sourceKind === 'pack') {
      const chosenPack = this.data.packBooks.find((book) => book.id === draftBookId) || this.data.packBooks[0] || null;
      this.setData({ currentBook: chosenPack, units: [], currentUnit: null });
      if (chosenPack) this.loadUnits(chosenPack.id, preferredUnitNo);
      if (callback) callback();
      return;
    }
    const defaultBook = this.books.find((book) => book.id === 'pep-3a') || this.books[0] || null;
    const chosen = this.books.find((book) => book.id === draftBookId)
      || saved && this.books.find((book) => book.id === saved.bookId)
      || defaultBook;
    if (!chosen) return;
    const versionIndex = chosen.id.startsWith('jj-') ? 1 : 0;
    const gradeIndex = Math.max(0, this.data.grades.indexOf(chosen.grade));
    const semesterIndex = chosen.semester === '下册' ? 1 : 0;
    this.setData({ versionIndex, gradeIndex, semesterIndex, currentBook: chosen }, () => {
      this.loadUnits(chosen.id, preferredUnitNo);
      if (callback) callback();
    });
  },

  chooseExercise(e) {
    const type = e.currentTarget.dataset.type;
    if (type === 'more') {
      this.navigateStage('more');
      return;
    }
    flowDraft = null;
    this.prepareExercise(type, () => {
      this.setData({ sourceKind: 'textbook' }, () => this.navigateStage('select'));
    });
  },

  prepareExercise(type, callback) {
    const exercise = EXERCISES[type] || EXERCISES.word;
    const practiceModes = PRACTICE_MODES[type] || [];
    this.setData({
      exerciseType: type,
      exercise,
      practiceModes,
      practiceIndex: 0,
      showTranslation: false,
      answerSheet: true,
    }, () => {
      this.refreshPreview();
      this.refreshSummary();
      if (callback) callback();
    });
  },

  onVersionTap(e) {
    this.setData({ versionIndex: Number(e.currentTarget.dataset.index), unitIndex: 0 }, () => this.selectFilteredBook());
  },
  onGradeTap(e) {
    this.setData({ gradeIndex: Number(e.currentTarget.dataset.index), unitIndex: 0 }, () => this.selectFilteredBook());
  },
  onSemesterTap(e) {
    this.setData({ semesterIndex: Number(e.currentTarget.dataset.index), unitIndex: 0 }, () => this.selectFilteredBook());
  },

  selectFilteredBook() {
    const prefix = this.data.versions[this.data.versionIndex].id;
    const grade = this.data.grades[this.data.gradeIndex];
    const semester = this.data.semesters[this.data.semesterIndex].id;
    const book = this.books.find((item) => item.id === `${prefix}-${grade}${semester}`) || null;
    this.setData({ currentBook: book, units: [], currentUnit: null });
    if (book) this.loadUnits(book.id);
  },

  async loadUnits(bookId, preferredUnitNo) {
    const cached = this.bookCache[bookId];
    if (cached) {
      this.applyBook(cached, preferredUnitNo);
      return;
    }
    this.setData({ loading: true, units: [], currentUnit: null });
    try {
      const data = await request({ url: api.wordbook(bookId) });
      this.bookCache[bookId] = data.book;
      this.applyBook(data.book, preferredUnitNo);
    } catch (e) {
      wx.showToast({ title: '单元加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyBook(book, preferredUnitNo) {
    const units = (book.units || []).map((unit) => ({
      ...unit,
      displayTitle: displayUnit(unit),
      wordCount: (unit.words || []).length,
      sentenceCount: (unit.sentences || []).length,
    }));
    let unitIndex = units.findIndex((unit) => unit.unitNo === Number(preferredUnitNo));
    if (unitIndex < 0) unitIndex = 0;
    const summary = this.books.find((item) => item.id === book.id) || book;
    this.setData({
      currentBook: summary,
      units,
      unitIndex,
      currentUnit: units[unitIndex] || null,
      coverageText: summary.coverage === 'core' ? '当前为核心同步内容，非教材附录全量词表' : '',
    }, () => this.refreshPreview());
  },

  onUnitTap(e) {
    const unitIndex = Number(e.currentTarget.dataset.index);
    this.setData({ unitIndex, currentUnit: this.data.units[unitIndex] }, () => this.refreshPreview());
  },

  confirmUnit() {
    if (!this.data.currentBook || !this.data.currentUnit) {
      wx.showToast({ title: '请先选择有效单元', icon: 'none' });
      return;
    }
    try {
      wx.setStorageSync(STORAGE_KEY, { bookId: this.data.currentBook.id, unitNo: this.data.currentUnit.unitNo });
    } catch (e) { /* ignore */ }
    this.navigateStage('config');
  },

  changeUnit() {
    this.saveFlowDraft();
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    const previous = pages.length > 1 ? pages[pages.length - 2] : null;
    if (previous && previous.route === 'pages/english/english' && previous.options && previous.options.stage === 'select') {
      wx.navigateBack();
      return;
    }
    this.navigateStage('select');
  },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },

  onPracticeTap(e) {
    this.setData({ practiceIndex: Number(e.currentTarget.dataset.index) }, () => {
      this.refreshPreview();
      this.refreshSummary();
    });
  },
  onTranslationToggle(e) { this.setData({ showTranslation: e.detail.value }, () => this.refreshPreview()); },
  onAnswerToggle(e) { this.setData({ answerSheet: e.detail.value }); },
  onPaperTap(e) { this.setData({ paperIndex: Number(e.currentTarget.dataset.index) }, () => { this.refreshPreview(); this.refreshSummary(); }); },
  onCaseTap(e) { this.setData({ caseIndex: Number(e.currentTarget.dataset.index) }, () => { this.refreshPreview(); this.refreshSummary(); }); },
  onFontTap(e) { this.setData({ fontIndex: Number(e.currentTarget.dataset.index) }, () => { this.refreshPreview(); this.refreshSummary(); }); },
  onTraceChange(e) { this.setData({ traceCount: Number(e.detail.value) }, () => { this.refreshPreview(); this.refreshSummary(); }); },
  onBlankChange(e) { this.setData({ blankCount: Number(e.detail.value) }, () => { this.refreshPreview(); this.refreshSummary(); }); },

  openSettings() { this.navigateStage('settings'); },
  saveSettings() {
    this.refreshSummary();
    this.saveFlowDraft();
    wx.navigateBack();
  },

  refreshSummary() {
    const caseNames = ['保持原样', '全部大写', '全部小写'];
    const paperNames = ['仿真字帖纸', '素雅'];
    const parts = [ENGLISH_FONT_NAMES[this.data.fontIndex] || ENGLISH_FONT_NAMES[0], caseNames[this.data.caseIndex], paperNames[this.data.paperIndex]];
    const fixedWordCopy = this.data.exerciseType === 'word' && this.data.practiceIndex === 0;
    if (!fixedWordCopy && this.data.exerciseType !== 'unscramble' && this.data.practiceIndex === 0) {
      parts.push(`描红 ${this.data.traceCount} 遍`);
    }
    if (fixedWordCopy) parts.push('固定描红版式');
    else if (this.data.practiceIndex === 1) parts.push('每题一行四线三格');
    else if (this.data.exerciseType !== 'unscramble') parts.push(`每题 ${this.data.blankCount} 行`);
    this.setData({
      styleSummary: parts.join(' · '),
    });
  },

  refreshPreview() {
    const unit = this.data.currentUnit;
    if (!unit) {
      if (this.data.stage === 'settings') {
        const mode = this.data.practiceModes[this.data.practiceIndex];
        const isDictation = mode && mode.id === 'zh2en';
        if (this.data.exerciseType === 'word') {
          this.setData({ preview: { primary: isDictation ? '朋友' : 'friend', answer: 'friend', secondary: isDictation ? '' : '朋友', tokens: [], copySamples: isDictation ? [] : previewRepeatSamples('friend') } });
        } else if (this.data.exerciseType === 'unscramble') {
          this.setData({ preview: { primary: '', answer: '', secondary: '', tokens: ['friends', 'are', 'We'], punctuation: '.' } });
        } else {
          this.setData({ preview: { primary: isDictation ? '我们一起学习。' : 'We learn together.', answer: 'We learn together.', secondary: isDictation ? '' : '我们一起学习。', tokens: [] } });
        }
      } else {
        this.setData({ preview: null });
      }
      return;
    }
    if (this.data.exerciseType === 'word') {
      const entry = (unit.words || [])[0];
      let word = entry && (entry.word || entry) || 'word';
      if (this.data.caseIndex === 1) word = word.toUpperCase();
      if (this.data.caseIndex === 2) word = word.toLowerCase();
      const meaning = entry && entry.meaning || '';
      const mode = this.data.practiceModes[this.data.practiceIndex];
      const modeId = mode && mode.id;
      const primary = modeId === 'zh2en' ? meaning : word;
      const answer = word;
      const secondary = modeId === 'copy' ? meaning : '';
      this.setData({ preview: { primary, answer, secondary, tokens: [], copySamples: modeId === 'copy' ? previewRepeatSamples(word) : [] } });
    } else {
      const entry = (unit.sentences || [])[0];
      const text = entry && (entry.text || entry) || 'Practice makes progress.';
      const translation = entry && entry.translation || '';
      const mode = this.data.practiceModes[this.data.practiceIndex];
      const isTranslationPrompt = mode && mode.id === 'zh2en';
      const punctuationMatch = text.match(/[.!?;,]+$/);
      this.setData({ preview: {
        primary: isTranslationPrompt ? translation : text,
        answer: text,
        secondary: isTranslationPrompt ? '' : translation,
        tokens: text.replace(/[.!?;,]+$/, '').split(/\s+/).reverse(),
        punctuation: punctuationMatch ? punctuationMatch[0] : '',
      } });
    }
  },

  startAlphabet() {
    flowDraft = null;
    this.setData({
      exerciseType: 'alphabet',
      exercise: { title: '字母书写', subtitle: '26 个字母', icon: 'Aa' },
      currentUnit: null,
      practiceModes: [],
      practiceIndex: 0,
      showTranslation: false,
      answerSheet: false,
    }, () => {
      this.refreshSummary();
      this.navigateStage('config');
    });
  },

  startThemes() {
    const first = this.data.packBooks[0];
    if (!first) { wx.showToast({ title: '主题词包暂不可用', icon: 'none' }); return; }
    flowDraft = null;
    this.prepareExercise('word', () => {
      this.setData({ sourceKind: 'pack', currentBook: first, currentUnit: null }, () => this.navigateStage('select'));
    });
  },

  onPackTap(e) {
    const book = this.data.packBooks[Number(e.currentTarget.dataset.index)];
    if (!book) return;
    this.setData({ currentBook: book });
    this.loadUnits(book.id);
  },

  async submit() {
    if (this.data.submitting) return;
    const isAlphabet = this.data.exerciseType === 'alphabet';
    if (!isAlphabet && (!this.data.currentBook || !this.data.currentUnit)) {
      wx.showToast({ title: '请先选择练习内容', icon: 'none' });
      return;
    }
    const practice = this.data.practiceModes[this.data.practiceIndex];
    this.setData({ submitting: true });
    try {
      const title = isAlphabet
        ? '英语字母书写'
        : `${displayUnit(this.data.currentUnit)} · ${this.data.exercise.title}`;
      const content = isAlphabet
        ? { text: LETTERS }
        : { bookId: this.data.currentBook.id, unitNo: this.data.currentUnit.unitNo };
      const options = isAlphabet
        ? { mode: 'copy', paper: PAPERS[this.data.paperIndex], letterCase: CASES[this.data.caseIndex], englishFont: ENGLISH_FONTS[this.data.fontIndex], traceCount: this.data.traceCount, blankCount: this.data.blankCount }
        : {
            exerciseType: this.data.exerciseType,
            practiceMode: practice ? practice.id : 'copy',
            showTranslation: this.data.showTranslation,
            answerSheet: this.data.answerSheet,
            paper: PAPERS[this.data.paperIndex],
            letterCase: CASES[this.data.caseIndex],
            englishFont: ENGLISH_FONTS[this.data.fontIndex],
            traceCount: this.data.traceCount,
            // 听写版式固定为每题一组四线三格，不再受样式页行数影响。
            blankCount: practice && practice.id === 'zh2en' ? 1 : this.data.blankCount,
          };
      const res = await request({ url: api.createSheet, method: 'POST', data: { type: 'english', title, content, options } });
      addHistory({ id: res.id, type: 'english', title: res.title, pageCount: res.pageCount, dateText: formatNow() });
      wx.navigateTo({ url: `/pages/preview/preview?id=${res.id}` });
      this.refreshQuota();
    } catch (err) {
      if (err.code === 'DAILY_LIMIT') {
        wx.showModal({ title: '今日生成已达上限', content: `${err.message}。`, showCancel: false });
        this.setData({ quotaRemaining: 0 });
      } else {
        wx.showToast({ title: err.message || '生成失败', icon: 'none' });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  onShareAppMessage() {
    return rewardedShare({ title: '英语打印 · 单词、句子和连词成句', path: '/pages/english/english' });
  },
});
