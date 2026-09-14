const FONT_NAMES = ['正楷', '行楷'];
const GRID_NAMES = ['田字格', '米字格', '方格'];
const PAPER_NAMES = ['仿真字帖纸', '素雅'];
const { ensureFonts } = require('../../../utils/font');

Page({
  data: {
    modeIndex: 0,
    fontIndex: 0,
    gridIndex: 0,
    paperIndex: 0,
    showPinyin: true,
    traceCount: 2,
    traceOptions: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    previewCells: [],
    summary: '',
  },

  onLoad() {
    ensureFonts();
    const channel = this.getOpenerEventChannel();
    channel.on('initSettings', (settings = {}) => {
      const patch = {
        modeIndex: Number(settings.modeIndex || 0),
        fontIndex: Number(settings.fontIndex || 0),
        gridIndex: Number(settings.gridIndex || 0),
        paperIndex: Number(settings.paperIndex || 0),
        showPinyin: settings.modeIndex === 1 ? true : settings.showPinyin !== false,
        traceCount: Number.isFinite(Number(settings.traceCount)) ? Number(settings.traceCount) : 2,
      };
      this.setData(patch, () => this.refreshPreview());
    });
    this.refreshPreview();
  },

  onFontTap(e) {
    this.setData({ fontIndex: Number(e.currentTarget.dataset.index) }, () => this.refreshPreview());
  },

  onGridTap(e) {
    this.setData({ gridIndex: Number(e.currentTarget.dataset.index) }, () => this.refreshPreview());
  },

  onPaperTap(e) {
    this.setData({ paperIndex: Number(e.currentTarget.dataset.index) }, () => this.refreshPreview());
  },

  onPinyinToggle(e) {
    if (this.data.modeIndex === 1) return;
    this.setData({ showPinyin: e.detail.value }, () => this.refreshPreview());
  },

  onTraceTap(e) {
    this.setData({ traceCount: Number(e.currentTarget.dataset.value) }, () => this.refreshPreview());
  },

  refreshPreview() {
    const cells = [];
    for (let i = 0; i < 6; i += 1) {
      let style = 'blank';
      if (this.data.modeIndex !== 1) {
        if (i === 0) style = 'demo';
        else if (i <= this.data.traceCount) style = 'trace';
      }
      cells.push({ key: `c${i}`, style, char: style === 'blank' ? '' : '春' });
    }
    const pieces = [PAPER_NAMES[this.data.paperIndex]];
    if (this.data.modeIndex !== 1) {
      pieces.unshift(FONT_NAMES[this.data.fontIndex], GRID_NAMES[this.data.gridIndex]);
      pieces.push(`描红 ${this.data.traceCount} 遍`);
    }
    pieces.push(this.data.showPinyin ? '显示拼音' : '不显示拼音');
    this.setData({ previewCells: cells, summary: pieces.join(' · ') });
  },

  saveSettings() {
    const channel = this.getOpenerEventChannel();
    channel.emit('saveSettings', {
      fontIndex: this.data.fontIndex,
      gridIndex: this.data.gridIndex,
      paperIndex: this.data.paperIndex,
      showPinyin: this.data.modeIndex === 1 ? true : this.data.showPinyin,
      traceCount: this.data.traceCount,
    });
    wx.navigateBack();
  },
});
