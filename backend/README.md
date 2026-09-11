# copybook-backend

语文英语字帖出题器的后端服务。职责：

1. **排版**：把汉字串 / 英文文本 + 练习选项，展开成统一的 layout JSON（描红格、空白格、折行、分页）；
2. **渲染**：把 layout JSON 渲染成 A4 可打印 HTML（浏览器打开即可「打印 / 另存为 PDF」）；
3. **存取**：字帖以 JSON 文件持久化（`data/sheets.json`），提供增删查接口给小程序。

## 运行

```bash
npm install
npm run dev     # 开发模式，http://localhost:3000
npm test        # node --test 单元测试 + 接口测试
```

环境变量：`PORT`（默认 3000）、`COPYBOOK_DATA_DIR`（数据目录，默认 `./data`）。

接口文档见仓库根目录 `README.md`。
