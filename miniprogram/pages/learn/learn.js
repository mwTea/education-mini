Page({
  data: {
    subjects: [
      { key: 'chinese', icon: '语', name: '语文', desc: '生字、词语与同步练习', color: 'red' },
      { key: 'math', icon: '数', name: '数学', desc: '在线口算与同步题卡', color: 'blue' },
      { key: 'english', icon: 'Abc', name: '英语', desc: '单词书写与听写练习', color: 'green' }
    ]
  },
  openSubject(e) {
    const urls = {
      chinese: '/pages/chinese/chinese',
      math: '/pages/math/index/index',
      english: '/pages/english/english'
    };
    wx.navigateTo({ url: urls[e.currentTarget.dataset.key] });
  },
  goQuiz() { wx.navigateTo({ url: '/pages/math/quiz/quiz' }); }
});
