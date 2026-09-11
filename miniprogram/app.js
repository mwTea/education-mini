// app.js
const { ensureFonts } = require('./utils/font');
const { ensureSession } = require('./utils/session');

App({
  onLaunch() {
    // 启动即预载楷体/行楷子集字体（安卓无系统楷体，进预览页前先下好）
    ensureFonts();
    ensureSession();
  },
  globalData: {},
});
