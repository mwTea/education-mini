// pages/chinese/chinese.js
const { request } = require('../../utils/request');
const { api } = require('../../config/index');
const { addHistory } = require('../../utils/history');

const MODES = ['copy', 'dictation', 'card'];
const PAPERS = ['classic', 'plain'];
const GRIDS = ['tian', 'mi', 'fang'];
const FONTS = ['kai', 'xingkai'];

// 单份体量上限（与后端 LIMITS 一致）：练习/听写 30 字，卡片 20 字
const MAX_CHARS = 30;
const MAX_CARD_CHARS = 20;

function limitFor(modeIndex) {
  return modeIndex === 2 ? MAX_CARD_CHARS : MAX_CHARS;
}

// 教材名 → 短标签（人教版语文三年级上册 → 三上）
function shortLabel(name) {
  const m = name.match(/([一二二三四五六])年级([上下])册/);
  if (!m) return name.slice(0, 4);
  const num = { 一: '一', 二: '二', 三: '三', 四: '四', 五: '五', 六: '六' }[m[1]];
  return `${num}${m[2] === '上' ? '上' : '下'}`;
}

// 课目标题 → 分组（识字 / 拼音 / 课文）
function sectionOf(title) {
  if (/^识字/.test(title)) return '识字';
  if (/^拼音/.test(title)) return '拼音';
  return '课文';
}

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

Page({
  data: {
    title: '',
    chars: '',
    modeIndex: 0,
    paperIndex: 0,
    gridIndex: 0,
    fontIndex: 0,
    showPinyin: true,
    traceCount: 2,
    submitting: false,
    pinyinOverride: '', // 手工拼音修正（空格分隔，多音字用）
    quotaRemaining: null, // 今日剩余生成份数

    // 课本导入（底部弹框：课文 | 古诗词）
    bookNames: [],
    bookShorts: [],
    bookCounts: [],
    bookLegacy: [], // 三/五/六年级仍是旧版课目
    modalOpen: false,
    modalTabIndex: 0,
    modalBookIndex: -1,
    modalSectionIndex: 0,
    modalSections: [], // [{ label, lessons: [{ index, title, selected }] }]
    modalBookLoading: false,
    selectedCount: 0,
    selectedCharCount: 0,
    importSummary: '',

    // 古诗词
    poemGrades: [],
    poemGradeIndex: 0,
    poemsOfGrade: [],
    poemSelectedId: '',
  },

  books: [],
  lessonsCache: {}, // bookId -> lessons
  selectedSet: {}, // lessonIndex -> true（当前册）
  poemsCache: null, // 全量古诗词

  onLoad(query) {
    const patch = {};
    if (query.chars) patch.chars = decodeURIComponent(query.chars).slice(0, MAX_CHARS);
    if (query.title) patch.title = decodeURIComponent(query.title).slice(0, 30);
    if (query.mode === 'dictation') patch.modeIndex = 1;
    this.setData(patch);
    this.loadTextbooks(query.from === 'textbook');
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

  onPinyinInput(e) {
    this.setData({ pinyinOverride: e.detail.value });
  },

  async loadTextbooks(autoOpen) {
    try {
      const data = await request({ url: api.textbooks });
      this.books = (data.items || []).map((b) => ({ ...b, short: shortLabel(b.name) }));
      this.setData({
        bookNames: this.books.map((b) => b.name),
        bookShorts: this.books.map((b) => b.short),
        bookCounts: this.books.map((b) => b.lessonCount + '课'),
        // 旧版课目：三上/三下/五上/六上（新版数据采集中）；四下/五下/六下已换统编 2019 版
        bookLegacy: this.books.map((b) => /rj-yuwen-5a|rj-yuwen-3b/.test(b.id || '')),
      });
      if (autoOpen && this.books.length) this.openModal();
    } catch (e) {
      // 教材库是增强能力，加载失败不影响手动输入
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onCharsInput(e) {
    this.setData({ chars: e.detail.value });
  },

  onModeTap(e) {
    this.setData({ modeIndex: Number(e.currentTarget.dataset.index) });
  },

  onGridTap(e) {
    this.setData({ gridIndex: Number(e.currentTarget.dataset.index) });
  },

  onFontTap(e) {
    this.setData({ fontIndex: Number(e.currentTarget.dataset.index) });
  },

  onPaperTap(e) {
    this.setData({ paperIndex: Number(e.currentTarget.dataset.index) });
  },

  onPinyinToggle(e) {
    this.setData({ showPinyin: e.detail.value });
  },

  onTraceChange(e) {
    this.setData({ traceCount: Number(e.detail.value) });
  },

  // ================= 课本导入弹框 =================

  openModal() {
    this.setData({ modalOpen: true });
    const idx = this.data.modalBookIndex >= 0 ? this.data.modalBookIndex : 0;
    this.switchBook(idx);
    this.loadPoems();
  },

  onModalTabTap(e) {
    this.setData({ modalTabIndex: Number(e.currentTarget.dataset.index) });
  },

  async loadPoems() {
    if (this.poemsCache) return;
    try {
      const data = await request({ url: api.poems });
      this.poemsCache = data.items || [];
      const grades = [];
      this.poemsCache.forEach((p) => {
        if (!grades.includes(p.grade)) grades.push(p.grade);
      });
      this.setData({ poemGrades: grades });
      this.switchPoemGrade(0);
    } catch (e) {
      // 诗词库加载失败不影响课文导入
    }
  },

  onPoemGradeTap(e) {
    this.switchPoemGrade(Number(e.currentTarget.dataset.index));
  },

  switchPoemGrade(idx) {
    const grade = this.data.poemGrades[idx] || this.data.poemGrades[0];
    this.setData({
      poemGradeIndex: idx,
      poemsOfGrade: (this.poemsCache || []).filter((p) => p.grade === grade),
      poemSelectedId: '',
    });
  },

  onPoemTap(e) {
    this.setData({ poemSelectedId: e.currentTarget.dataset.id });
  },

  closeModal() {
    this.setData({ modalOpen: false });
  },

  noop() {},

  switchBook(idx) {
    const book = this.books[idx];
    if (!book) return;
    this.setData({ modalBookIndex: idx, modalBookLoading: true, modalSections: [] });
    this.selectedSet = {};

    const cached = this.lessonsCache[book.id];
    if (cached) {
      this.buildSections(cached);
      return;
    }
    request({ url: api.textbook(book.id) })
      .then((data) => {
        this.lessonsCache[book.id] = data.book.lessons;
        this.buildSections(data.book.lessons);
      })
      .catch(() => {
        this.setData({ modalBookLoading: false });
        wx.showToast({ title: '课文加载失败', icon: 'none' });
      });
  },

  onModalBookTap(e) {
    this.switchBook(Number(e.currentTarget.dataset.index));
  },

  onModalSectionTap(e) {
    this.setData({ modalSectionIndex: Number(e.currentTarget.dataset.index) });
  },

  buildSections(lessons) {
    const order = ['识字', '拼音', '课文'];
    const groups = {};
    lessons.forEach((l, i) => {
      const sec = sectionOf(l.title);
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push({ index: i, title: l.title, selected: false });
    });
    const sections = order
      .filter((k) => groups[k] && groups[k].length)
      .map((k) => ({ label: k, lessons: groups[k] }));
    this.setData({
      modalSections: sections,
      modalSectionIndex: 0,
      modalBookLoading: false,
      selectedCount: 0,
      selectedCharCount: 0,
    });
  },

  onModalLessonClick(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (this.selectedSet[idx]) delete this.selectedSet[idx];
    else this.selectedSet[idx] = true;
    this.refreshSelection();
  },

  onToggleSectionAll() {
    const sec = this.data.modalSections[this.data.modalSectionIndex];
    if (!sec) return;
    const allSelected = sec.lessons.every((l) => this.selectedSet[l.index]);
    sec.lessons.forEach((l) => {
      if (allSelected) delete this.selectedSet[l.index];
      else this.selectedSet[l.index] = true;
    });
    this.refreshSelection();
  },

  refreshSelection() {
    // 重建 sections 的 selected 标记与统计
    const lessons = this.lessonsCache[this.books[this.data.modalBookIndex].id] || [];
    const sections = this.data.modalSections.map((sec) => ({
      ...sec,
      lessons: sec.lessons.map((l) => ({ ...l, selected: !!this.selectedSet[l.index] })),
    }));
    let charCount = 0;
    Object.keys(this.selectedSet).forEach((k) => {
      const lesson = lessons[Number(k)];
      if (lesson) charCount += Array.from(lesson.chars).length;
    });
    this.setData({
      modalSections: sections,
      selectedCount: Object.keys(this.selectedSet).length,
      selectedCharCount: charCount,
    });
  },

  confirmImport() {
    // 古诗词页签：单选导入（生字去重，超出单份上限取前 N 字并提示）
    if (this.data.modalTabIndex === 1) {
      const poem = (this.poemsCache || []).find((x) => x.id === this.data.poemSelectedId);
      if (!poem) {
        wx.showToast({ title: '请先选择一首诗', icon: 'none' });
        return;
      }
      const seen = new Set();
      const chars = [];
      Array.from(poem.text.replace(/[^\u4e00-\u9fff]/g, '')).forEach((ch) => {
        if (!seen.has(ch)) {
          seen.add(ch);
          chars.push(ch);
        }
      });
      const limit = limitFor(this.data.modeIndex);
      const overflow = chars.length > limit;
      const unit = this.data.modeIndex === 2 ? '卡片' : '单份';
      if (overflow) {
        wx.showToast({ title: `本诗 ${chars.length} 个生字，${unit}上限 ${limit} 字，已取前 ${limit} 字`, icon: 'none' });
      }
      this.setData({
        chars: chars.slice(0, limit).join(''),
        title: `${poem.title} · ${poem.author}`.slice(0, 30),
        importSummary: `${poem.grade} · ${poem.title}`,
        modalOpen: false,
      });
      return;
    }

    const lessons = this.lessonsCache[this.books[this.data.modalBookIndex].id] || [];
    const picked = Object.keys(this.selectedSet)
      .map(Number)
      .sort((a, b) => a - b)
      .map((i) => lessons[i])
      .filter(Boolean);
    if (!picked.length) {
      wx.showToast({ title: '请先选择课文', icon: 'none' });
      return;
    }
    const chars = [];
    const seen = new Set();
    picked.forEach((l) => {
      Array.from(l.chars).forEach((ch) => {
        if (!seen.has(ch)) {
          seen.add(ch);
          chars.push(ch);
        }
      });
    });
    const limit = limitFor(this.data.modeIndex);
    if (chars.length > limit) {
      const unit = this.data.modeIndex === 2 ? '卡片每份最多 20 字' : '每份最多 30 字';
      wx.showToast({ title: `共 ${chars.length} 个生字，${unit}，请少选几课`, icon: 'none' });
      return;
    }
    const book = this.books[this.data.modalBookIndex];
    const title = picked.length === 1
      ? picked[0].title
      : `${book.short}生字（${picked.length}课）`;
    this.setData({
      chars: chars.join(''),
      title,
      importSummary: `${book.short} · ${picked.map((l) => l.title.split(' ')[0]).join('、')}`,
      modalOpen: false,
    });
  },

  async submit() {
    if (this.data.submitting) return;
    if (!this.data.chars.replace(/\s+/g, '')) {
      wx.showToast({ title: '请输入要练习的汉字', icon: 'none' });
      return;
    }

    const mode = MODES[this.data.modeIndex];
    this.setData({ submitting: true });
    try {
      const res = await request({
        url: api.createSheet,
        method: 'POST',
        data: {
          type: 'chinese',
          title: this.data.title || (mode === 'dictation' ? '语文听写卷' : mode === 'card' ? '语文生字卡片' : '语文生字练习'),
          content: {
            chars: this.data.chars,
            // 手工拼音（多音字修正）：数量与生字一致时后端优先采用
            ...(this.data.pinyinOverride.trim() ? { pinyin: this.data.pinyinOverride.trim() } : {}),
          },
          options: {
            mode,
            paper: PAPERS[this.data.paperIndex],
            grid: GRIDS[this.data.gridIndex],
            font: FONTS[this.data.fontIndex],
            showPinyin: this.data.showPinyin,
            traceCount: this.data.traceCount,
          },
        },
      });
      addHistory({
        id: res.id,
        type: 'chinese',
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
    return { title: '语文字帖 · 生字/听写/卡片，一键成帖', path: '/pages/chinese/chinese', imageUrl: '/assets/share-chinese.png' };
  },

  onShareTimeline() {
    return { title: '语文字帖 · 生字/听写/卡片', query: '', imageUrl: '/assets/share-chinese.png' };
  },
});
