#!/usr/bin/env bash
# 下载开源字体（均为 OFL 协议，可自由使用与分发），供 PDF 直出与打印页使用。
#   - LXGWWenKai-Regular.ttf  正楷：霞鹜文楷（GitHub Releases）
#   - Slidexiaxing-Regular.ttf 行楷：演示夏行楷（OFL，maoken-fonts/slidefont，断点续传下载）
# 只需运行一次；字体文件不入库（.gitignore 已忽略 assets/fonts）。
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/fonts"
mkdir -p "$DIR"

# 断点续传下载（大字体文件在弱网下常被截断）
fetch_resume() {
  local out="$1" expected="$2" url="$3"
  if [ "$(stat -f%z "$DIR/$out" 2>/dev/null || echo 0)" -ge "$expected" ]; then
    echo "已存在：$out"
    return 0
  fi
  for i in $(seq 1 15); do
    curl -sL -C - --max-time 120 -o "$DIR/$out" "$url" || true
    local size
    size=$(stat -f%z "$DIR/$out" 2>/dev/null || echo 0)
    echo "  $out 进度：$size / $expected"
    if [ "$size" -ge "$expected" ]; then
      ls -lh "$DIR/$out"
      return 0
    fi
    sleep 1
  done
  echo "下载失败：$out（$size/$expected）" >&2
  return 1
}

fetch() {
  local out="$1" url="$2"
  if [ -s "$DIR/$out" ]; then
    echo "已存在：$out"
    return 0
  fi
  echo "下载 $url"
  curl -sL --max-time 120 -o "$DIR/$out" "$url" || {
    rm -f "$DIR/$out"
    echo "下载失败：$out" >&2
    return 1
  }
  ls -lh "$DIR/$out"
}

# 正楷：霞鹜文楷
KAI_URL=$(curl -s https://api.github.com/repos/lxgw/LxgwWenKai/releases/latest \
  | grep -o '"browser_download_url": *"[^"]*LXGWWenKai-Regular\.ttf"' \
  | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
[ -n "$KAI_URL" ] && fetch LXGWWenKai-Regular.ttf "$KAI_URL" || true

# 行楷：演示夏行楷（OFL，约 10MB；大文件易被 CDN 截断，用断点续传循环）
fetch_resume Slidexiaxing-Regular.ttf 10073644 \
  "https://raw.githubusercontent.com/maoken-fonts/slidefont/master/fonts/Slidexiaxing-Regular.ttf"

echo "完成"
