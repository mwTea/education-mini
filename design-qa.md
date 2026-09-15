# 英语打印改版 Design QA

## Evidence

- 页面视觉基准：`docs/v2/ui/source/英语打印配置页效果图-2026-09-14.jpg`
- PDF 视觉基准：
  - `/var/folders/tg/gs86ncqx1kx1zhl862dlr17h0000gn/T/codex-clipboard-f8f12017-5805-4be6-8b39-ed999f3304d9.png`
  - `/var/folders/tg/gs86ncqx1kx1zhl862dlr17h0000gn/T/codex-clipboard-75bf5916-8fc5-4816-a78e-ee5aa5e00348.png`
  - `/var/folders/tg/gs86ncqx1kx1zhl862dlr17h0000gn/T/codex-clipboard-9962e067-4513-4301-ad13-c50dd3750b20.png`
- 小程序实现截图：`tmp/pdfs/english-selection-selected.png`、`tmp/pdfs/english-settings-preview.png`、`tmp/pdfs/english-hengshui-mini-preview.png`
- 浏览器打印截图：`tmp/pdfs/english-hengshui-browser-print.png`
- PDF 渲染证据：`tmp/pdfs/final-word-copy.png`、`tmp/pdfs/final-word-dictation.png`、`tmp/pdfs/final-sentence-dictation.png`
- 小程序模拟设备：iPhone 12/13 Pro；截图 664 × 1436 px；CSS 视口约 390 × 844；DPR 约 3。页面对比按同一模拟设备完成。
- PDF 参考图与 A4 实现图来源比例不同，因此按内容区和行列结构归一化比较，不以原始像素作一比一尺寸判断。最终 PDF 为 A4 595.28 × 841.89 pt，渲染检查为 120 DPI。

## State and interactions

- 教材页：冀教版、四年级、上册、Unit 3 已选。
- 样式页：衡水体、四线三格；单词描红使用固定模板，不显示次数控件。
- 生成后预览：教材真实内容、衡水体、单词描红。
- 已检查教材筛选和单元选中状态、样式页独立恢复、三种字体加载、生成后预览、浏览器打印页、PDF 下载后重新打开。
- 微信开发者工具 WXML/WXSS 编译通过；模拟器日志未发现字体加载或运行错误。

## Full-view comparison

- 单词描红保持参考图的“整行四线格、首个黑色范字、后续红色描红、下方词汇信息”结构；实现增加产品统一页眉和页码，属于打印产品既有规范。
- 听写单词保持四列、每页五行、中文提示和三组书写区的密度；每组书写区按产品要求升级为四线三格。实现使用中文“班级/姓名/日期”替代参考中的英文栏名。
- 听写句子保持四题、编号中文提示和三组整行书写区；每组升级为四线三格，长中文提示允许换行，不压缩书写区。
- 教材选择页通过当前教材摘要、蓝色左标、勾选与“已选”标签强化选中结果；样式页效果卡在首屏下半区可见且随字体、纸张、行数变化。

## Focused comparison

- 字体与排线：衡水体小写主体位于第三线附近，升部与降部没有被裁切；小程序、浏览器与 PDF 使用同一字体选择。网页范字字号已从 6.2 mm 调整为 8.5 mm，与 PDF 的 25 pt 视觉密度对齐。
- 间距与节奏：描红每页 10 词；听写单词 4 × 5；听写句子每页 4 题。听写四线三格组数与设置一致，均无页脚碰撞。
- 颜色：经典纸张使用绿色实线、浅绿虚线和浅红描红；素雅听写使用中性灰线，语义与参考一致。
- 图片：本轮 PDF 模板没有图片资产；英语页既有 6 张透明 PNG 清晰、无棋盘格和明显白边。
- 文案：移除英译汉听写，名称统一为“单词描红 / 听写单词 / 句子描红 / 听写句子”。

## Comparison history

1. [P2] 样式效果卡直接恢复页面时为空。原因是设置页为独立页面栈且尚未恢复单元对象。已把当前教材/单元放入流程草稿，并增加同类型安全示例；复截图 `english-settings-preview.png` 后预览正常。
2. [P2] 浏览器打印预览的衡水体比实际 PDF 偏小。已将网页范字从 6.2 mm 调至 8.5 mm，小程序同步为 48 rpx；复截图 `english-hengshui-browser-print.png` 与重开 PDF `english-hengshui-api.png` 后字号和基线一致。
3. [P2] 单词描红的次数控件与固定参考模板不一致，且按词长缩放造成后续行看起来越来越细小。已移除该模式的次数控件，所有行固定 25 pt；长单词只减少重复个数。听写答题线同步改为四线三格。复查 `english-settings-fixed-template.png`、`english-dictation-four-line-mini.png` 和三张最终 PDF 渲染图后无字号漂移或布局溢出。

## Findings

- 无 P0/P1/P2 遗留问题。

## Follow-up polish

- [P3] 当前教材包只稳定提供单词和中文释义，因此描红信息行不会伪造音标、词性、复数或搭配；未来词库提供这些真实字段后，现有排版已支持按存在字段显示。
- [P3] 上线前仍建议补一次 Android 与 iOS 真机首次字体下载、弱网回退和缓存命中检查。

## Implementation checklist

- [x] 教材与单元选中反馈
- [x] 样式设置即时预览与恢复兜底
- [x] 移除教材入口的英译汉听写
- [x] 三套参考 PDF 模板
- [x] 衡水体默认及两种备选字体
- [x] 小程序、网页打印与 PDF 视觉校准
- [x] 编译、自动化测试、包体与 PDF 重开检查

final result: passed
