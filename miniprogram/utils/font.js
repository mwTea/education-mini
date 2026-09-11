// utils/font.js
// 预加载楷体/行楷子集字体（服务器 /assets/fonts/，各约 1~4MB，微信缓存）。
// 安卓没有系统楷体，不加载时预览会回落成默认黑体。
// 注意：source 域名需加入小程序后台「downloadFile 合法域名」。
const { fontKai, fontXingkai } = require('../config/index');

let loaded = false;

function ensureFonts() {
  if (loaded) return;
  loaded = true;
  wx.loadFontFace({
    global: true,
    family: 'CBKai',
    source: `url("${fontKai}")`,
    fail: (e) => console.warn('loadFontFace CBKai 失败', e && e.errMsg),
  });
  wx.loadFontFace({
    global: true,
    family: 'CBXing',
    source: `url("${fontXingkai}")`,
    fail: (e) => console.warn('loadFontFace CBXing 失败', e && e.errMsg),
  });
}

module.exports = { ensureFonts };
