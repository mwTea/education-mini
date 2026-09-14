'use strict';

/** 用户存储：openid → {vip, vipUntil, createdAt}；token 内存态（重启失效，前端会自动重登）。 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.COPYBOOK_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'users.json');
let users = null; // Map
const tokens = new Map(); // token -> { openid, sessionKey }

function load() {
  if (users) return users;
  try {
    users = new Map(JSON.parse(fs.readFileSync(FILE, 'utf8')).map((u) => [u.openid, u]));
  } catch { users = new Map(); }
  return users;
}

function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify([...load().values()], null, 2));
  fs.renameSync(tmp, FILE);
}

function upsert(openid) {
  const u = load().get(openid) || { openid, createdAt: new Date().toISOString() };
  u.lastSeenAt = new Date().toISOString();
  load().set(openid, u);
  persist();
  return u;
}

function issueToken(openid, sessionKey = '') {
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { openid, sessionKey });
  return token;
}

function sessionOf(token) {
  return (token && tokens.get(String(token).slice(0, 64))) || null;
}

function openidOf(token) {
  const current = sessionOf(token);
  return current && current.openid;
}

function isVip(u) {
  return !!(u && u.vip && (!u.vipUntil || new Date(u.vipUntil) > new Date()));
}

function setVip(openid, days) {
  const u = upsert(openid);
  const base = isVip(u) && u.vipUntil ? new Date(u.vipUntil) : new Date();
  u.vip = true;
  u.vipUntil = new Date(base.getTime() + days * 86400e3).toISOString();
  persist();
  return u;
}

function stats() {
  const all = [...load().values()];
  const day = (iso) => String(iso || '').slice(0, 10);
  const today = day(new Date().toISOString());
  return {
    totalUsers: all.length,
    activeToday: all.filter((u) => day(u.lastSeenAt) === today).length,
    vipUsers: all.filter(isVip).length,
  };
}

module.exports = { upsert, issueToken, sessionOf, openidOf, isVip, setVip, stats };
