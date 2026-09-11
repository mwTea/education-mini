# 字帖出题器

微信小程序 + Node.js 后端，为小学家长和老师提供语文、数学、英语三科同步练习工具。

## 功能概览

### 语文
- **练字帖**：田字格/米字格/方格，每字一行（范字 + 描红 + 空白），A4 自动排版
- **听写卷**：看拼音写汉字，整行空白 + 行首拼音
- **生字卡片**：拼音格 + 笔顺演示条 + 笔画/部首/结构标签 + 描红 + 组词练习
- 教材同步：人教版 1-6 年级 12 册逐课写字表（官方 PDF 提取）
- 古诗词 81 首（公版），一键导入去重
- 偏旁部首练习：124 个常用偏旁，A4 描红页，静态预生成不占配额

### 数学
- **在线口算练习**：跟教材进度出题（人教/冀教双版本），数字键盘逐题作答，自动判对过题，错题间隔重复复习
- **打印题卡**：口算/竖式/应用题混编，按题型分块，独立答案页
- 题型覆盖 1-6 年级：10 以内加减 → 分数四则 → 百分数，含钟表读时、竖式计算、单位换算、比大小
- 三档难度：基础（最小要求）/ 巩固（常规含进退位）/ 培优（放大混合）

### 英语
- **字母字帖** / **单词字帖**（PEP 2024 新版词库 6 册 + 旧版 2 册）/ **默写帖**（中译英/英译汉）
- 词库按单元分组，导入自动截断至 30 词
- 中文释义覆盖 771 词（zh-dict），中译英缺释义自动降级为英译汉

### 通用
- PDF 矢量路径渲染（微信/打印/浏览器字形完全一致）
- 打印 HTML 页（电脑浏览器直接打印）
- 每日生成配额（默认 8 份/天，VIP 不限次）
- 云端历史（openid 归属，换手机不丢）
- 手机 H5 管理后台（用户/生成量/会员管理）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 微信小程序原生框架（wxml/wxss/js） |
| 后端 | Node.js 20 + Express |
| PDF | pdfkit + fontkit（字形轮廓矢量绘制，无内嵌字体） |
| 数据 | JSON 文件持久化（后续可平滑迁 SQLite/PG） |
| 部署 | systemd 裸机 + Let's Encrypt HTTPS + Node 443 终结器 |

## 项目结构

```
├── miniprogram/          # 小程序前端
│   ├── pages/            # 页面（首页/语文/英语/数学/预览/历史/关于/偏旁/个人中心）
│   ├── components/       # sheet-view 字帖渲染组件
│   ├── utils/            # request / session / learning / font / history
│   └── config/           # BASE_URL 与 API 路径
├── backend/
│   ├── src/
│   │   ├── services/     # 业务逻辑
│   │   │   ├── layout/   #   排版（chinese / english / math）
│   │   │   ├── render/   #   渲染（pdf / html）
│   │   │   └── hanzi.service.js  # 笔画/部首/组词
│   │   ├── routes/       # API 路由
│   │   ├── controllers/  # 控制器
│   │   ├── middleware/   # 限流 / 每日配额
│   │   └── store/        # 字帖存储 + 用户存储
│   ├── src/data/         # 教材/诗词/词库 JSON
│   ├── assets/           # 字体（gitignore）+ 偏旁 PDF
│   ├── scripts/          # 字体下载 / 偏旁生成 / 词库校验
│   └── test/             # node:test 单元测试（44 个）
├── deploy/               # nginx 配置样例
├── design/               # 图标与品牌资源
├── docs/                 # 开发文档与上线清单
└── CHANGELOG.md          # 版本记录（前端/后端版本与上线状态追踪）
```

## 快速开始

### 后端

```bash
cd backend
npm install

# 下载开源字体（首次必跑，产出 assets/fonts/*.ttf）
bash scripts/fetch-fonts.sh

# 启动开发服务（端口 3001）
npm start

# 跑测试
npm test
```

### 小程序

1. 微信开发者工具打开 `miniprogram/` 目录
2. 修改 `config/index.js` 中 `BASE_URL` 指向你的后端地址
3. 在小程序后台「开发设置 → 服务器域名」添加 request + downloadFile 合法域名

### 部署

参照 `deploy/nginx.conf.sample` 配置反代；管理后台访问 `/admin`（Token 通过环境变量 `ADMIN_TOKEN` 设置）。

#### 部署脚本

本地 `deploy/deploy.sh`（已 gitignore，含服务器信息）：

```bash
# 全量部署（src/ + assets/ + package.json）
bash deploy/deploy.sh

# 只部署指定文件（改了哪个推哪个）
bash deploy/deploy.sh src/services/layout/math.service.js src/app.js
```

脚本自动完成：本地语法检查 → rsync 同步 → 远端 node --check → systemctl restart → 健康检查。

#### Git 推送脚本

本地 `deploy/git-push.sh`（已 gitignore）：

```bash
# 自动 add + commit + push（默认 commit message 带时间戳）
bash deploy/git-push.sh

# 自定义 commit message
bash deploy/git-push.sh "feat: 新增某功能"
```

脚本自动处理两个常见问题：
- **网络代理**：github.com 需走本地代理（自动检测端口 12450）
- **钥匙串冲突**：绕开 macOS Keychain（避免 Gitee 凭据干扰 GitHub 推送）

#### 手动推送（不用脚本）

```bash
git add -A
git commit -m "your message"
git -c credential.helper= -c http.proxy=http://127.0.0.1:12450 push origin main
```

## 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端监听端口 | 3001 |
| `ADMIN_TOKEN` | H5 管理后台口令 | copybook-admin |
| `DAILY_SHEET_LIMIT` | 每日生成配额 | 8 |
| `WXA_APPID` / `WXA_SECRET` | 微信小程序凭据（openid 登录） | 无 |
| `IP_DAILY_SHEET_LIMIT` | 未登录 IP 兜底配额 | 50 |

## 数据来源与版权

- **语文生字表**：人教版教材官方 PDF 文字层提取（国家智慧教育平台）
- **英语词库**：PEP 教材 2024 新版各单元词汇表，双来源交叉核对
- **数学题**：程序实时生成，按教材进度映射题型，不引用任何题库
- **古诗词**：公版作品
- **字体**：AR PL UKai 文鼎楷体（Arphic 公共许可证）、演示夏行楷（OFL）
- **汉字笔画数据**：hanzi-writer-data（开源）、Make Me a Hanzi（开源）

## License

Private - All rights reserved
