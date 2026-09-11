'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// 限流：分钟突发按 IP；每日主配额按 X-Client-ID（设备），IP 只做兜底
process.env.RATE_LIMIT_PER_MIN = '10';
process.env.DAILY_SHEET_LIMIT = '2';
const { sheetQuota, resetQuota, RATE_MAX, DAILY_MAX, IP_DAILY_MAX } = require('../src/middleware/quota.middleware');

function fakeReq(ip, xff, cid) {
  const headers = {};
  if (xff) headers['x-forwarded-for'] = xff;
  if (cid) headers['x-client-id'] = cid;
  return { headers, socket: { remoteAddress: ip } };
}

function fakeRes() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    set(k, v) { this.headers[k] = v; },
  };
}

function run(req) {
  const res = fakeRes();
  let passed = false;
  sheetQuota(req, res, () => { passed = true; });
  return { passed, res };
}

test('限流：单 IP 每分钟超过上限返回 429 RATE_LIMIT', () => {
  resetQuota();
  let last;
  for (let i = 0; i <= RATE_MAX; i += 1) {
    last = run(fakeReq('1.1.1.1'));
    if (i < RATE_MAX) assert.ok(last.passed, `第 ${i + 1} 次应放行`);
  }
  assert.equal(last.res.statusCode, 429);
  assert.equal(last.res.body.code, 'RATE_LIMIT');
});

test('配额：按设备 X-Client-ID 独立计数，第 3 份被拒（DAILY_LIMIT=2）', () => {
  resetQuota();
  assert.ok(run(fakeReq('1.1.1.1', null, 'device-a')).passed);
  assert.ok(run(fakeReq('2.2.2.2', null, 'device-a')).passed); // 换 IP 不重置：按设备计
  const blocked = run(fakeReq('1.1.1.1', null, 'device-a'));
  assert.equal(blocked.passed, false);
  assert.equal(blocked.res.body.code, 'DAILY_LIMIT');
  assert.equal(blocked.res.body.limit, DAILY_MAX);
  // 另一设备不受影响
  assert.ok(run(fakeReq('1.1.1.1', null, 'device-b')).passed);
});

test('配额：无设备 ID 的旧客户端走 IP 档（上限 IP_DAILY_MAX）', () => {
  resetQuota();
  const r = run(fakeReq('3.3.3.3'));
  assert.ok(r.passed);
  assert.equal(r.res.headers['X-Daily-Remaining'], String(IP_DAILY_MAX - 1));
});

test('配额：带设备 ID 的请求同时受 IP 兜底约束（同 IP 多设备正常轮转）', () => {
  resetQuota();
  for (let i = 0; i < 3; i += 1) {
    assert.ok(run(fakeReq('4.4.4.4', null, `dev-${i}`)).passed);
  }
});

test('存储：过期字帖（>10 天）自动清理，未过期保留', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  process.env.COPYBOOK_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'copybook-clean-'));
  const store = require('../src/store/sheet.store');
  const oldSheet = { id: 'sh_old', createdAt: new Date(Date.now() - 11 * 86400e3).toISOString(), title: 'old' };
  const freshSheet = { id: 'sh_new', createdAt: new Date().toISOString(), title: 'new' };
  store.create(oldSheet);
  store.create(freshSheet);
  const removed = store.cleanup();
  assert.ok(removed >= 1);
  assert.equal(store.get('sh_old'), null);
  assert.ok(store.get('sh_new'), '未过期记录不应被清理');
});
