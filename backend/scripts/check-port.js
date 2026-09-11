'use strict';

/**
 * 启动前端口预检：端口被占用时给出明确提示并阻止启动。
 * 背景：`node --watch` 绑定端口失败（EADDRINUSE）后不会退出，
 * 会静默变成僵尸进程——残留的旧服务会一直用旧代码响应请求。
 */

const { execFileSync } = require('child_process');

const PORT = process.env.PORT || 3000;

function pidsOnPort() {
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
    return out.split('\n').filter(Boolean);
  } catch (e) {
    return []; // lsof 无输出 = 端口空闲
  }
}

const pids = pidsOnPort();
if (pids.length) {
  console.error(`[check-port] 端口 ${PORT} 已被进程 ${pids.join(', ')} 占用。`);
  console.error('[check-port] 可能是残留的旧后端进程在用旧代码响应请求，请先结束它：');
  pids.forEach((pid) => console.error(`  kill -9 ${pid}`));
  process.exit(1);
}
