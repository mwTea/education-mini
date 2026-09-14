# 首页与语文年级切换验证

日期：2026-09-11。分支：codex/home-banner-chinese-grades。

## 视觉目标与用户确认的调整

- 源图：`/Users/likangdong/.codex/generated_images/01a08f19-a517-7ed2-8c76-7bb80ec55f7a/exec-ce3e2b0b-cf96-47ba-8510-3d849781f866.png`，783 × 2008 像素。
- 用户后续明确调整：取消常用工具；同步打印下方显示最近两条生成记录，标题右侧“全部”进入打印历史，无记录时隐藏。
- 页面沿用微信原生导航栏、底部导航与已有图标；标题在原生导航栏显示，避免重复标题占高度。
- 新插画：`miniprogram/assets/home/hero-meadow.jpg`，1536 × 768，237404 字节。由内置 ImageGen 根据已选效果图生成，sips 转为 JPEG。小墨和草地背景整体生成，避免低分辨率抠图白边。
- 素材提示：同一蓝外套黄内搭背包小墨，左侧挥手，耳朵尾巴脚完整；蓝天草地小路，右侧天空留给 UI 问候文案，不含 UI、文字和气泡。

## 已完成验证

- `npm test`：52/52 通过（新增 8 项）。日志：`output/home-review/tests.log`。
- 新增场景：一至六年级全部 12 册的真实教材与逐字拼音、跨年级/上下册切换、乱序响应、网络失败与重试、跨册续练与再练、档案年级保持不变、今日数量日期边界、最近两条与首页路由。
- 首页及语文 JS：`node --check` 通过。
- 微信内置 `wcc` / `wcsc`：本次 WXML / WXSS 编译通过；输出位于 `output/home-review/`。
- `git diff --check`：通过。

## 待完成视觉验证

- 实际截图：尚未取得。
- 目标视口：微信模拟器手机视口，计划检查约 375px 和窄屏 320px；实际密度与截图尺寸待记录。
- 状态：首页无记录/有记录；语文选课、切换年级、上下册与答题。
- 全图与局部对照：未完成，不将编译通过等同于视觉通过。
- 字体与排版：代码沿用 PingFang SC / 系统字体，截图验证待完成。
- 间距与布局：顶部 2:1 插画、三科练习行、同步打印三列、最近生成两条；截图验证待完成。
- 颜色：延续深蓝文字与语红/数蓝/英绿；实际对比度与显示待验证。
- 图片：新插画已独立打开检查，角色完整，无抠图白边；页面叠加和实际裁切待验证。
- 文案：已按用户最终确认更新，实际断行待验证。

## 当前阻塞与对照记录

微信开发者工具 CLI 返回 `IDE service port disabled`。用户已授权启用，但工具直接退出；启动参数 `--enable-service-port` 仅唤起已有实例，没有开启端口。界面控制服务两次返回 `Sky Computer Use service startup request failed`。已请用户手动在设置中开启本机服务端口，再继续自动化截图验证。

final result: blocked

## 2026-09-11 第二轮：同步打印卡片 + 全部按钮（用户反馈返工）

用户反馈：上一版卡片加了叶子装饰（设计稿里没有），"全部"按钮太笨重。本轮修正：

- 移除 CSS 叶子装饰及对应样式（.print-leafs/.pl*）。
- 用户提供了三科透明插画 icon 合图（根目录 `Codex 图像 2026年9月11日 16_48_45.png`，2172×724 RGBA），已按 724px 等分裁切并去透明边，落位 `miniprogram/assets/home/subjects/{chinese,math,english}.png`。
- 卡片：图标换新素材（82rpx，白色 80% 圆形底托 124rpx），学科名 30rpx/700 沿用三科既有字色（#c83f39/#2262cc/#138254），副标题 22rpx #7c8aa0，上下留白 34/38rpx。
- "全部"按钮按用户规格：高 72rpx（36px）、左右 padding 26rpx（13px）、底 #F1F7FF、字 #268BFF、28rpx（14px）、圆角 36rpx（18px）、细 chevron（CSS border 2rpx 旋转 45°）替代 › 字符。
- 验证：wcc/wcsc 编译通过；HTML 1:1 复核截图（output/home-review/mock-round2.html，本地 8931 端口，已停）确认无叶子、图标清晰、按钮符合规格。

## 2026-09-11 第三轮：真机无底色修复 + 按钮终版

- 原因：`.page-wrap button{background:transparent;...;color:inherit;font-weight:400}` 重置（0,1,1）压过单类学科规则（0,1,0），真机上卡片无底色、学科名统一深藏青。修复：学科底色/字色提为 `.page-wrap .print-tile.print-chinese`（0,3,0）三连选择器，并为 `.print-name` 显式按学科上色。用户确认卡片样式 OK。
- 按钮终版（用户复述规格）：文案改"查看全部"，高固定 72rpx（36px，弃 min-height 防撑高）、padding 0 26rpx（13px）、底 #F1F7FF、字 #268BFF、28rpx（14px）/500、圆角 36rpx（18px）、chevron 为 2rpx 细边框 45°。
- 验证：wcc/wcsc 通过；mock-round3（含 button 重置的优先级还原）截图复核通过。

## 2026-09-11 第四轮：banner 图 + 今日练习进度条 + 行图标

- banner：用户提供 `home_banner`（2048×768 PNG，1.8MB）→ 转 JPEG 落位 `miniprogram/assets/home/banner.jpg`（381KB）。hero 高 281rpx（等比 750×281），替换 hero-meadow 与问候气泡。图内"开启今日学习›"胶囊（大图 x 43.2–67.0%、y 31.6–42.0%）上叠透明热区 `.hero-cta`（left 38%/top 22%/w 34%/h 30%），`wx.switchTab` 跳学习 tab（pages/learn/learn）。
- 今日练习：标题行下新增进度条 `.today-progress`（轨道 #e5eef7 14rpx + 蓝渐变 #4a9eff→#1688f8 填充），进度 = 今日题数/30（DAILY_GOAL 常量）封顶 100%。
- 三行练习项：去掉"语文/数学/英语"文字标签，改为 `.practice-icon` 学科色圆角方托（88rpx/24rpx 圆角，#fff3e8/#eaf5ff/#e7faef）+ subjects 插画 icon 56rpx；名称/圆箭头/分隔线保留。
- 验证：wcc/wcsc/node --check 通过；mock-round4 全页复核（banner 热区红框对位、进度条 40%、行图标、打印卡片、查看全部按钮）全部通过。

## 2026-09-11 第五轮：练习行学科色卡片 + banner 加高

- 用户反馈：今日练习行白色无底色；banner 太矮。
- 三行练习项改为学科色圆角卡片（#fff3e8/#eaf5ff/#e7faef，与同步打印一致）：白色圆托 icon 56rpx + 大字学科标题（30rpx/700，各科字色）+ 小字副标题（22rpx #7c8aa0）+ 白底圆箭头；行间 18rpx 间距替代分隔线，面板底部 padding 28rpx。
- banner 高度 281rpx → 375rpx（aspectFill，左右各裁 125rpx），热区按裁切重新校准：left 38%/top 24%/w 38%/h 26%（胶囊裁切后位于 x 41–72.7%、y 31.6–42%）。
- 验证：wcc/wcsc 通过；mock-round5 复核通过（banner 更高、角色完整、胶囊在热区内、三行学科卡片+标题/副标题正确）。

## 2026-09-11 第六轮：banner 整图可点 + 去除 icon 白托

- 用户反馈：热区没点中"开启今日学习"；icon 底下是白的。
- 热区：像素复核发现图内深蓝文字不止一组（气泡文案+胶囊文字），精确框定不可靠 → 改为整个 banner 覆盖式透明按钮（`.hero-cta` 全尺寸），点哪都进学习 tab。
- 白托：subjects icon 本身透明（透明像素 30–75%），白色来自 rgba(255,255,255,.8) 圆托 → 练习行与打印卡的白色圆托全部移除，icon 放大直接落在学科底色上（练习行 68rpx、打印卡 96rpx）。
- 验证：wcc/wcsc 通过；mock-round6 复核通过（无白垫、图标完整、banner 正常）。

## 2026-09-11 第七轮：六项微调

1. banner 375rpx → 340rpx（左右各裁从 125rpx 减到 78rpx，两侧树/花/角色完整）。
2. 三标题左对齐：practice-panel 横向 padding 归零，标题行/进度条/练习行统一内缩 28rpx，与同步打印/最近生成标题（24rpx 页边距）对齐。
3. 查看全部按钮去底色（transparent，保留蓝字+细 chevron 与 36px 热区）。
4. 进度条与首行间距 8→16rpx；三行箭头加比行底色略深的底色（#ffe7d4/#d7ecff/#d6f2e2）。
5. DAILY_GOAL 30→10，文案改"已练 x/10 题"，进度按 x/10。
6. 同步打印卡片整体缩小约 12%（padding 30/33rpx、icon 84rpx、名称 27rpx、副标题 20rpx）。
- 验证：wcc/wcsc/node --check 通过；mock-round7 六项复核全部通过。

## 2026-09-11 第八轮：banner 右侧裁剪修复

- 根因：小墨浣熊位于源图最右侧（头/耳/挥手爪延伸到 x 1850–2048），aspectFill 居中裁切把角色右半切掉。
- 修复：banner.jpg 由居中裁切改为右对齐裁切——源图裁为 1694×768（与 750:340rpx 容器精确等比），保留 x 354–2048（角色完整），仅舍弃左侧背景树/云；hero 高度 340rpx 不变，aspectFill 实际零裁切。文件 289KB。
- 验证：mock-round8 复核——浣熊头/耳/爪完整、胶囊完整、左侧场景自然。

## 2026-09-11 第九轮：banner 木牌裁剪（缓存问题）

- 用户指"被裁的是右侧木牌"（写着鼓励语的木制路牌）。像素定位：木牌在源图 x 1732–1998（84.6–97.6%），第八轮右对齐裁切（x 354–2048）已完整包含它——用户看到的是旧 banner.jpg 的路径缓存（路径未变、内容已变）。
- 修复：素材改名 `banner.jpg` → `banner-v2.jpg`（1694×768），wxml src 同步更新，强制绕过图片缓存。
- 验证：wcc 通过；mock-round9 复核木牌牌面/文字/支柱完整，气泡、按钮、角色正常。

## 2026-09-11 第十轮：新 banner 图 + 全站配色

- 用户提供新图 `home_banner1.png`（1932×814，比例 2.373）→ `banner-v3.jpg`（376KB）；hero 高度设 316rpx（等比满宽，零裁切），整图可点不变；删除 banner-v2.jpg。
- 配色按用户给定值：页面背景 #F3F7FC；今日练习卡 白底，三行 #FFF1EB/#EAF5FF/#EAF9F0；同步打印 #FFF0E5/#E6F2FF/#E5F7EC；行箭头底色同步微调（#ffe4d6/#d6ecff/#d7f2e2）。
- 验证：wcc/wcsc 通过；mock-round10 复核——新 banner 左右无裁切（小墨/气泡/按钮/木牌完整），配色全部正确。

## 2026-09-11 第十一轮：banner 全域点击修复

- 用户反馈 banner 点击又不是全域。原实现为空 `<button>` 绝对定位 width/height:100%（真机上空按钮的命中区域有怪癖）。
- 修复：去掉覆盖按钮，`bindtap` 直接绑在 `.hero` 容器上（hover-class 保留按压反馈，aria-role=button），整个 banner 区域天然可点；删除 `.hero-cta` 样式。注意 hero 底部 24rpx 被 `.home-content` 负边距叠压，该窄条属内容区、非可见 banner。
- 验证：wcc/wcsc 通过。
