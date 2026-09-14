'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'miniprogram');
// 产品约束按十进制 MB/KB 执行，比 MiB/KiB 口径更严格。
const MAIN_PACKAGE_LIMIT = 1_500_000;
const MEDIA_LIMIT = 200_000;
const MEDIA_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac',
]);
const IGNORED_NAMES = new Set(['.DS_Store', 'project.private.config.json']);
const IGNORED_DIRS = new Set(['.tmp-scratch']);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function formatKB(bytes) {
  return `${(bytes / 1000).toFixed(1)} KB`;
}

const files = walk(ROOT);
const allRows = files.map((file) => ({
  file,
  relative: path.relative(ROOT, file),
  bytes: fs.statSync(file).size,
}));
const rows = allRows.filter((row) => {
  const parts = row.relative.split(path.sep);
  return !parts.some((part) => IGNORED_DIRS.has(part))
    && !IGNORED_NAMES.has(path.basename(row.relative));
});
const total = rows.reduce((sum, row) => sum + row.bytes, 0);
// 媒体检查覆盖整个 miniprogram 目录，避免临时目录中的超限资源漏检。
const mediaRows = allRows.filter((row) => MEDIA_EXTENSIONS.has(path.extname(row.file).toLowerCase()));
const oversizedMedia = mediaRows.filter((row) => (
  MEDIA_EXTENSIONS.has(path.extname(row.file).toLowerCase()) && row.bytes > MEDIA_LIMIT
));

console.log(`Main package: ${formatKB(total)} / ${formatKB(MAIN_PACKAGE_LIMIT)}`);
console.log(`Largest media: ${mediaRows
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 5)
  .map((row) => `${row.relative} (${formatKB(row.bytes)})`)
  .join(', ')}`);

if (total > MAIN_PACKAGE_LIMIT) {
  console.error(`Main package exceeds 1.5 MB by ${formatKB(total - MAIN_PACKAGE_LIMIT)}.`);
}
for (const row of oversizedMedia) {
  console.error(`Media exceeds 200 KB: ${row.relative} (${formatKB(row.bytes)}).`);
}

if (total > MAIN_PACKAGE_LIMIT || oversizedMedia.length) process.exit(1);
console.log('Size check passed.');
