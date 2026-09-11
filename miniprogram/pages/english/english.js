// pages/english/english.js
const { request } = require('../../utils/request');
const { api } = require('../../config/index');
const { addHistory } = require('../../utils/history');

const TYPES = ['alphabet', 'words', 'dictation'];
const PAPERS = ['classic', 'plain'];
const CASES = ['origin', 'upper', 'lower'];
const DICT_DIRS = ['zh2en', 'en2zh'];
const MAX_TEXT = 300;
const MAX_WORDS = 30; // 单份最多 30 词（与后端 LIMITS.maxWords 一致）

const LETTERS = 'Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz';

// 词库名 → 短标签（人教PEP英语三年级上册 → 三上；词包保持原名）
function wbShort(name) {
  const m = name.match(/([一二三四五六])年级([上下])册/);
  if (!m) return name.slice(0, 6);
  return `${m[1]}${m[2]}`;
}

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    title: '',
    text: '', // 默写帖手动输入 / 单词帖导入后保存
    quotaRemaining: null,
    typeIndex: 0,
    paperIndex: 0,
    caseIndex: 0,
    dictDirIndex: 0,
    traceCount: 1,
    blankCount: 2,
    submitting: false,
    letters: LETTERS,

    // 单词导入弹框
    wordModalOpen: false,
    wordModalTab: 0, // 0 教材 | 1 词包
    wbList: [], // 当前页签的词库（短标签渲染）
    wbEmptyText: '加载中…',
    wbIndex: -1,
    wbCurrentName: '',
    wbUnits: [], // [{ title, selected, words: [...] }]
    wbLoading: false,
    selectedWordCount: 0,
    importSummary: '',
  },

  wbCache: {}, // id -> units
  textbooksList: [],
  packsList: [],

  onLoad(query) {
    if (query.type === 'words') this.setData({ typeIndex: 1 });
    if (query.type === 'dictation') this.setData({ typeIndex: 2 });
  },

  onShow() {
    this.refreshQuota();
  },

  async refreshQuota() {
    try {
      const res = await request({ url: api.quota });
      this.setData({ quotaRemaining: res.remaining });
    } catch (e) {
      // 配额查询失败不阻塞生成
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  onTypeTap(e) {
    this.setData({ typeIndex: Number(e.currentTarget.dataset.index) });
  },

  onPaperTap(e) {
    this.setData({ paperIndex: Number(e.currentTarget.dataset.index) });
  },

  onCaseTap(e) {
    this.setData({ caseIndex: Number(e.currentTarget.dataset.index) });
  },

  onDictDirTap(e) {
    this.setData({ dictDirIndex: Number(e.currentTarget.dataset.index) });
  },

  onTraceChange(e) {
    this.setData({ traceCount: Number(e.detail.value) });
  },

  onBlankChange(e) {
    this.setData({ blankCount: Number(e.detail.value) });
  },

  // ================= 单词导入弹框 =================

  openWordModal() {
    this.setData({ wordModalOpen: true });
    if (!this.textbooksList.length && !this.packsList.length) {
      this.loadWordbooks();
    }
  },

  closeWordModal() {
    this.setData({ wordModalOpen: false });
  },

  noop() {},

  async loadWordbooks() {
    try {
      const data = await request({ url: api.wordbooks });
      const items = data.items || [];
      this.textbooksList = items.filter((b) => b.kind === 'textbook');
      this.packsList = items.filter((b) => b.kind === 'pack');
      const tab = this.textbooksList.length ? 0 : 1;
      this.setData({ wordModalTab: tab });
      this.renderWbList(tab);
      const list = tab === 0 ? this.textbooksList : this.packsList;
      if (list.length) this.switchWb(0);
    } catch (e) {
      this.setData({ wbEmptyText: '词库加载失败', wbList: [] });
      wx.showToast({ title: '词库加载失败', icon: 'none' });
    }
  },

  /** 把当前页签的词库列表整理成渲染数据（短标签 + 词数角标） */
  renderWbList(tab) {
    const list = tab === 0 ? this.textbooksList : this.packsList;
    this.setData({
      wbList: list.map((b) => ({ id: b.id, short: wbShort(b.name), count: b.wordCount, legacy: b.legacy === true })),
      wbEmptyText: tab === 0 ? '教材词表准备中，可先看「主题词包」' : '暂无词包',
      wbIndex: -1,
      wbCurrentName: '',
      wbUnits: [],
      selectedWordCount: 0,
    });
  },

  onWordModalTabTap(e) {
    const tab = Number(e.currentTarget.dataset.index);
    this.setData({ wordModalTab: tab });
    this.renderWbList(tab);
    const list = tab === 0 ? this.textbooksList : this.packsList;
    if (list.length) this.switchWb(0);
  },

  onWbTap(e) {
    this.switchWb(Number(e.currentTarget.dataset.index));
  },

  switchWb(idx) {
    const list = this.data.wordModalTab === 0 ? this.textbooksList : this.packsList;
    const book = list[idx];
    if (!book) return;
    this.setData({
      wbIndex: idx,
      wbLoading: true,
      wbUnits: [],
      selectedWordCount: 0,
      wbCurrentName: `${book.name} · ${book.unitCount}组 ${book.wordCount}词`,
    });

    const cached = this.wbCache[book.id];
    if (cached) {
      this.setData({ wbUnits: cached.map((u) => ({ ...u })), wbLoading: false });
      this.recount();
      return;
    }
    request({ url: api.wordbook(book.id) })
      .then((data) => {
        const units = data.book.units.map((u) => ({ title: u.title, words: u.words || [], selected: false }));
        this.wbCache[book.id] = units;
        this.setData({ wbUnits: units, wbLoading: false });
      })
      .catch(() => {
        this.setData({ wbLoading: false });
        wx.showToast({ title: '词库加载失败', icon: 'none' });
      });
  },

  onUnitTap(e) {
    const idx = Number(e.currentTarget.dataset.index);
    const units = this.data.wbUnits.map((u, i) => (i === idx ? { ...u, selected: !u.selected } : u));
    this.setData({ wbUnits: units });
    this.recount();
  },

  onUnitAllTap() {
    const all = this.data.wbUnits.every((u) => u.selected);
    this.setData({ wbUnits: this.data.wbUnits.map((u) => ({ ...u, selected: !all })) });
    this.recount();
  },

  recount() {
    const seen = new Set();
    this.data.wbUnits.forEach((u) => {
      if (u.selected) u.words.forEach((w) => seen.add(w));
    });
    this.setData({ selectedWordCount: seen.size });
  },

  confirmWordImport() {
    const seen = new Set();
    const unitTitles = [];
    this.data.wbUnits.forEach((u) => {
      if (u.selected) {
        unitTitles.push(u.title);
        u.words.forEach((w) => seen.add(w));
      }
    });
    const words = [...seen];
    if (!words.length) {
      wx.showToast({ title: '请先选择单元', icon: 'none' });
      return;
    }
    const text = words.join(' ');
    if (text.length > MAX_TEXT) {
      wx.showToast({ title: `共 ${text.length} 字符，超 ${MAX_TEXT} 上限，请少选几组`, icon: 'none' });
      return;
    }
    // 单份最多 30 词（与后端一致）：超出取前 30 并透明提示
    const overflow = words.length > MAX_WORDS;
    const picked = words.slice(0, MAX_WORDS);
    if (overflow) {
      wx.showToast({ title: `共 ${words.length} 词，单份上限 ${MAX_WORDS} 词，已取前 ${MAX_WORDS} 词`, icon: 'none' });
    }
    const list = this.data.wordModalTab === 0 ? this.textbooksList : this.packsList;
    const book = list[this.data.wbIndex] || list[0];
    const title = unitTitles.length <= 2
      ? `${book.name}（${unitTitles.join('、')}）`
      : `${book.name}（${unitTitles.length}组）`;
    this.setData({
      text: picked.join(' '),
      title: title.slice(0, 30),
      importSummary: `${book.name} · ${unitTitles.length}组 ${picked.length}词`,
      wordModalOpen: false,
    });
  },

  async submit() {
    if (this.data.submitting) return;

    const type = TYPES[this.data.typeIndex];
    let text = this.data.text;
    let title = this.data.title;

    if (type === 'alphabet') {
      text = LETTERS;
      title = title || '字母字帖';
    } else if (!text.trim()) {
      wx.showToast({ title: type === 'words' ? '请先从词库导入单词' : '请输入要练习的英文内容', icon: 'none' });
      return;
    } else {
      // 手动输入同样受单份 30 词限制（后端会截断，这里提前提示）
      const wordCount = text.trim().split(/\s+/).length;
      if (wordCount > MAX_WORDS) {
        wx.showToast({ title: `共 ${wordCount} 词，单份上限 ${MAX_WORDS} 词，请减少内容`, icon: 'none' });
        return;
      }
    }
    if (!title) {
      title = type === 'dictation' ? '英语默写帖' : '英语书写练习';
    }

    this.setData({ submitting: true });
    try {
      const res = await request({
        url: api.createSheet,
        method: 'POST',
        data: {
          type: 'english',
          title,
          content: { text },
          options: {
            mode: type === 'dictation' ? 'dictation' : 'copy',
            dictationDir: DICT_DIRS[this.data.dictDirIndex],
            paper: PAPERS[this.data.paperIndex],
            letterCase: type === 'alphabet' ? 'origin' : CASES[this.data.caseIndex],
            traceCount: this.data.traceCount,
            blankCount: this.data.blankCount,
          },
        },
      });
      addHistory({
        id: res.id,
        type: 'english',
        title: res.title,
        pageCount: res.pageCount,
        dateText: formatNow(),
      });
      wx.navigateTo({ url: `/pages/preview/preview?id=${res.id}` });
      this.refreshQuota();
    } catch (err) {
      if (err.code === 'DAILY_LIMIT') {
        wx.showModal({ title: '今日生成已达上限', content: `${err.message}。`, showCancel: false });
        this.setData({ quotaRemaining: 0 });
      } else {
        wx.showToast({ title: err.message, icon: 'none' });
      }
    } finally {
      this.setData({ submitting: false });
    }
  },

  onShareAppMessage() {
    return { title: '英语字帖 · 词库同步 / 默写卷', path: '/pages/english/english', imageUrl: '/assets/share-english.png' };
  },

  onShareTimeline() {
    return { title: '英语字帖 · 词库同步', query: '', imageUrl: '/assets/share-english.png' };
  },
});
