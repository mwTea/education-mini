'use strict';

/**
 * 生成接口限流（纯内存，单实例部署够用）：
 *  - 分钟突发：单 IP 每分钟 RATE_LIMIT_PER_MIN（默认 10）次创建，防脚本
 *  - 每日配额（主）：按「设备」计——小程序端生成的 X-Client-ID，
 *    默认 3 份/天（DAILY_SHEET_LIMIT）。设备粒度避免了运营商 NAT 下
 *    多个真实用户共享出口 IP 互相挤占配额的问题
 *  - 每日兜底：按 IP 计，默认 50 份/天（IP_DAILY_SHEET_LIMIT），
 *    防脚本伪造客户端 ID 刷量；未带 X-Client-ID 的旧客户端也走这一档
 * 计数为内存态，重启即清零；将来接会员按身份覆盖主配额即可。
 */

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MIN || 10);
const DEFAULT_DAILY_MAX = 3;
const DAILY_MAX = Number(process.env.DAILY_SHEET_LIMIT || DEFAULT_DAILY_MAX);
const IP_DAILY_MAX = Number(process.env.IP_DAILY_SHEET_LIMIT || 50);

let minute = { windowStart: 0, ips: new Map() };
let daily = { dayKey: '', keys: new Map() }; // key: "c:<clientId>" 或 "ip:<ip>"

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (typeof fwd === 'string' && fwd.split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';
}

function clientId(req) {
  const cid = req.headers['x-client-id'];
  return (typeof cid === 'string' && cid.trim()) ? cid.trim().slice(0, 64) : '';
}

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function take(key, max, res, code, message) {
  const used = (daily.keys.get(key) || 0) + 1;
  if (used > max) {
    console.warn(`[quota] ${code} key=${key} used=${used - 1}/${max}`);
    res.status(429).json({ error: message, code, limit: max });
    return null;
  }
  daily.keys.set(key, used);
  return used;
}

const fs = require('fs');
const path = require('path');
const userStore = require('../store/user.store');
const shareRewardStore = require('../store/share-reward.store');

let vipFileList = null;
function fileVip(openid) {
  if (vipFileList === null) {
    try {
      vipFileList = fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'vip-openids.txt'), 'utf8')
        .split('\n').map((l) => l.trim()).filter(Boolean);
    } catch { vipFileList = []; }
  }
  return vipFileList.includes(openid);
}

function sheetQuota(req, res, next) {
  const ip = clientIp(req);
  // 已登录用户：VIP（会员未过期或白名单文件）免每日配额，普通用户按 openid 计
  const token = req.headers['x-user-token'];
  const openid = userStore.openidOf(token);
  if (openid) {
    let user = null;
    try { user = userStore.upsert(openid); } catch (e) { user = null; }
    if ((user && userStore.isVip(user)) || fileVip(openid)) {
      // VIP：仅保留分钟突发限流
      const now = Date.now();
      if (now - minute.windowStart > RATE_WINDOW_MS) minute = { windowStart: now, ips: new Map() };
      const burst = (minute.ips.get(ip) || 0) + 1;
      if (burst > RATE_MAX) return res.status(429).json({ error: '操作太频繁，请 1 分钟后再试', code: 'RATE_LIMIT' });
      minute.ips.set(ip, burst);
      res.set('X-Daily-Remaining', 'VIP');
      return next();
    }
  }
  const now = Date.now();

  if (now - minute.windowStart > RATE_WINDOW_MS) minute = { windowStart: now, ips: new Map() };
  const burst = (minute.ips.get(ip) || 0) + 1;
  if (burst > RATE_MAX) {
    return res.status(429).json({ error: '操作太频繁，请 1 分钟后再试', code: 'RATE_LIMIT' });
  }
  minute.ips.set(ip, burst);

  const key = dayKey();
  if (daily.dayKey !== key) daily = { dayKey: key, keys: new Map() };

  const cid = openid || clientId(req);
  const mainKey = openid ? `u:${openid}` : (cid ? `c:${cid}` : `ip:${ip}`);
  const shareBonus = openid ? shareRewardStore.bonusFor(openid) : 0;
  const mainLimit = cid ? DAILY_MAX + shareBonus : IP_DAILY_MAX;

  const used = take(mainKey, mainLimit, res, 'DAILY_LIMIT',
    cid ? `今日生成次数已用完（基础 ${DAILY_MAX} 份${shareBonus ? ` + 分享奖励 ${shareBonus} 份` : ''}），明天再来吧` : `今日生成已达上限（${IP_DAILY_MAX} 份/天），明天再来吧`);
  if (used === null) return;

  // 带设备 ID 的请求同时受 IP 兜底约束
  if (cid) {
    const ipUsed = take(`ip:${ip}`, IP_DAILY_MAX, res, 'IP_DAILY_LIMIT', '当前网络今日生成已达上限，明天再来吧');
    if (ipUsed === null) return;
  }

  res.set('X-Daily-Remaining', String(Math.max(0, mainLimit - used)));
  return next();
}

/** 查询当前剩余配额（只读，不推进计数），供前端展示「今日剩余 X 份」 */
function quotaStatus(req) {
  const ip = clientIp(req);
  // 与 sheetQuota 同样的主键逻辑：登录 openid > 设备 ID > IP
  const userStore = require('../store/user.store');
  const openid = userStore.openidOf(req.headers['x-user-token']);
  if (openid) {
    const used = (daily.dayKey === dayKey() ? daily.keys.get(`u:${openid}`) : 0) || 0;
    const shareBonus = shareRewardStore.bonusFor(openid);
    const limit = DAILY_MAX + shareBonus;
    return { baseLimit: DAILY_MAX, shareBonus, limit, remaining: Math.max(0, limit - used) };
  }
  const cid = clientId(req);
  const mainKey = cid ? `c:${cid}` : `ip:${ip}`;
  const mainLimit = cid ? DAILY_MAX : IP_DAILY_MAX;
  const used = (daily.dayKey === dayKey() ? daily.keys.get(mainKey) : 0) || 0;
  return { baseLimit: mainLimit, shareBonus: 0, limit: mainLimit, remaining: Math.max(0, mainLimit - used) };
}

/** 测试辅助：重置计数 */
function resetQuota() {
  minute = { windowStart: 0, ips: new Map() };
  daily = { dayKey: '', keys: new Map() };
}

module.exports = { sheetQuota, quotaStatus, resetQuota, RATE_MAX, DEFAULT_DAILY_MAX, DAILY_MAX, IP_DAILY_MAX };
