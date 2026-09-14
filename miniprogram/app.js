// app.js
const { ensureFonts } = require('./utils/font');
const { ensureSession } = require('./utils/session');
const { claimIncomingShare } = require('./utils/share-reward');

App({
  onLaunch() {
    // 启动即预载楷体/行楷子集字体（安卓无系统楷体，进预览页前先下好）
    ensureFonts();
    ensureSession().catch(() => { /* 未登录时继续使用基础设备配额 */ });
  },
  onShow(options) {
    claimIncomingShare(options);
  },
  globalData: {},
});
