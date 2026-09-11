// pages/about/about.js
Page({
  onShareAppMessage() {
    return {
      title: '字帖出题器 · 生字/单词一键成帖，打印即练',
      path: '/pages/index/index',
      imageUrl: '/assets/share-card.png',
    };
  },
});
