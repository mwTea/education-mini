// config/index.js
// 后端服务地址：
//  - 本地开发：http://127.0.0.1:3000
//  - 真机调试（连电脑）：http://<电脑局域网IP>:3000
//  - 体验版/正式版：必须是 https 域名，且在小程序管理后台「开发管理-服务器域名」中
//    配置 request 合法域名（如 https://api.your-domain.com）
let localDevtools = false;
try { localDevtools = wx.getSystemInfoSync().platform === 'devtools'; } catch (e) { /* Device builds keep the production API. */ }
const BASE_URL = localDevtools ? 'http://127.0.0.1:3000' : 'https://edu.10010rights.com.cn';
// const BASE_URL = 'http://60.205.171.222:3001';
// 线上服务器（已部署）：http://60.205.171.222:3001
// 真机预览时把 BASE_URL 换成线上地址，并在体验版中开启「开发调试」跳过域名校验；
// 正式发布前需配置 https 域名并在小程序后台添加 request 合法域名。

module.exports = {
  BASE_URL,
  api: {
    createSheet: `${BASE_URL}/api/v1/sheets`,
    sheetDetail: (id) => `${BASE_URL}/api/v1/sheets/${id}`,
    sheetPrint: (id) => `${BASE_URL}/api/v1/sheets/${id}/print`,
    sheetPdf: (id) => `${BASE_URL}/api/v1/sheets/${id}/pdf`,
    sheetDelete: (id) => `${BASE_URL}/api/v1/sheets/${id}`,
    textbooks: `${BASE_URL}/api/v1/textbooks`,
    textbook: (id) => `${BASE_URL}/api/v1/textbooks/${id}`,
    poems: `${BASE_URL}/api/v1/poems`,
    hanzi: (char) => `${BASE_URL}/api/v1/hanzi/${encodeURIComponent(char)}`,
    wordbooks: `${BASE_URL}/api/v1/wordbooks`,
    wordbook: (id) => `${BASE_URL}/api/v1/wordbooks/${id}`,
    quota: `${BASE_URL}/api/v1/quota`,
    session: `${BASE_URL}/api/v1/session`,
    shareIntent: `${BASE_URL}/api/v1/share/intents`,
    shareClaim: `${BASE_URL}/api/v1/share/claim`,
    mathbooks: `${BASE_URL}/api/v1/mathbooks`,
    mathQuiz: `${BASE_URL}/api/v1/math/quiz`,
    mineSheets: `${BASE_URL}/api/v1/sheets?mine=1`,
  },
  // 预览用子集字体（首次加载后由小程序缓存）；v2=换成文鼎楷体（教材楷体风格）
  fontKai: `${BASE_URL}/assets/fonts/subset-kai.ttf?v=2`,
  fontXingkai: `${BASE_URL}/assets/fonts/subset-xingkai.ttf`,
  fontHengshui: `${BASE_URL}/assets/fonts/EduSABeginner-Regular.ttf?v=1`,
  fontEnglishPrint: `${BASE_URL}/assets/fonts/NotoSans-Regular.ttf?v=1`,
  fontEnglishRounded: `${BASE_URL}/assets/fonts/Nunito-Regular.ttf?v=1`,
};
