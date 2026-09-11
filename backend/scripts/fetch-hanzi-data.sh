#!/usr/bin/env bash
# 下载汉字静态数据（生字卡片用）：
#   - makemeahanzi dictionary.txt：部首、构字分解（→结构判定）
#   - jieba dict.txt（MIT）：词频表，构建组词索引
# 逐笔笔画数据来自 npm 依赖 hanzi-writer-data（npm install 时自动安装），无需下载。
# 数据文件不入库（.gitignore 已忽略 assets/hanzi）。
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/hanzi"
mkdir -p "$DIR"

fetch() {
  local out="$1"; shift
  if [ -s "$DIR/$out" ]; then
    echo "已存在：$out"
    return 0
  fi
  for url in "$@"; do
    echo "尝试 $url"
    if curl -sL --retry 3 --max-time 180 -o "$DIR/$out" "$url" && [ -s "$DIR/$out" ]; then
      ls -lh "$DIR/$out"
      return 0
    fi
    rm -f "$DIR/$out"
  done
  echo "下载失败：$out" >&2
  return 1
}

fetch dictionary.txt \
  "https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/dictionary.txt" \
  "https://raw.githubusercontent.com/skishore/makemeahanzi/master/dictionary.txt"

fetch jieba-dict.txt \
  "https://cdn.jsdelivr.net/gh/fxsjy/jieba@master/jieba/dict.txt" \
  "https://raw.githubusercontent.com/fxsjy/jieba/master/jieba/dict.txt"

node "$(dirname "$0")/build-word-index.js"

echo "完成"
