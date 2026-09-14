Page({
  openSubject(e) {
    const urls = { chinese: '/pages/chinese/chinese', math: '/pages/math/index/index', english: '/pages/english/english' };
    wx.navigateTo({ url: urls[e.currentTarget.dataset.key] });
  },
  goRadicals() { wx.navigateTo({ url: '/pages/radicals/radicals' }); },
  goHistory() { wx.navigateTo({ url: '/pages/history/history' }); },
  /** 名字字帖：输姓名直达语文生成页（从首页快捷位移入打印工具格） */
  goNameSheet() {
    wx.showModal({
      title: '姓名字帖',
      editable: true,
      placeholderText: '输入孩子姓名，如：李小明',
      success: (r) => {
        if (!r.confirm || !r.content || !r.content.trim()) return;
        const name = r.content.trim();
        wx.navigateTo({
          url: `/pages/chinese/chinese?chars=${encodeURIComponent(name)}&title=${encodeURIComponent(`${name}的名字`)}`,
        });
      },
    });
  },
  comingSoon() { wx.showToast({ title: '将在后续打印版本开放', icon: 'none' }); }
});
