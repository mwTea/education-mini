'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.COPYBOOK_DATA_DIR || path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'share-rewards.json');
const INTENT_TTL_MS = 24 * 60 * 60 * 1000;

let state = null;

function emptyState() {
  return { intents: [], rewards: [] };
}

function load() {
  if (state) return state;
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    state = {
      intents: Array.isArray(parsed.intents) ? parsed.intents : [],
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards : [],
    };
  } catch (e) {
    state = emptyState();
  }
  return state;
}

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(load(), null, 2));
  fs.renameSync(tmp, FILE);
}

function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function cleanup(now = Date.now()) {
  const cutoff = now - (INTENT_TTL_MS * 2);
  load().intents = load().intents.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  const rewardCutoff = now - (35 * 24 * 60 * 60 * 1000);
  load().rewards = load().rewards.filter((item) => new Date(item.createdAt).getTime() >= rewardCutoff);
}

function createIntent(ownerOpenid) {
  cleanup();
  const intent = {
    id: crypto.randomBytes(18).toString('base64url'),
    ownerOpenid,
    createdAt: new Date().toISOString(),
    claimedAt: null,
  };
  load().intents.push(intent);
  persist();
  return { id: intent.id, expiresAt: new Date(Date.now() + INTENT_TTL_MS).toISOString() };
}

function claimIntent({ id, claimantOpenid, groupId = '' }) {
  cleanup();
  const intent = load().intents.find((item) => item.id === id);
  if (!intent) return { ok: false, code: 'SHARE_INTENT_INVALID', message: '分享奖励链接无效或已过期' };
  if (Date.now() - new Date(intent.createdAt).getTime() > INTENT_TTL_MS) {
    return { ok: false, code: 'SHARE_INTENT_EXPIRED', message: '分享奖励链接已过期' };
  }
  if (intent.ownerOpenid === claimantOpenid) {
    return { ok: false, code: 'SHARE_SELF_CLAIM', message: '不能打开自己的分享领取奖励' };
  }
  if (intent.claimedAt) {
    return { ok: true, reward: 0, duplicate: true, kind: intent.kind || 'friend' };
  }

  const day = localDayKey();
  const kind = groupId ? 'group' : 'friend';
  const targetHash = crypto.createHash('sha256')
    .update(groupId || claimantOpenid)
    .digest('hex');
  const duplicate = load().rewards.some((item) => (
    item.ownerOpenid === intent.ownerOpenid
    && item.day === day
    && item.kind === kind
    && item.targetHash === targetHash
  ));
  const reward = duplicate ? 0 : (kind === 'group' ? 5 : 1);

  intent.claimedAt = new Date().toISOString();
  intent.claimantOpenid = claimantOpenid;
  intent.kind = kind;
  intent.reward = reward;
  if (reward) {
    load().rewards.push({
      ownerOpenid: intent.ownerOpenid,
      day,
      kind,
      targetHash,
      amount: reward,
      createdAt: intent.claimedAt,
    });
  }
  persist();
  return { ok: true, reward, duplicate, kind, ownerOpenid: intent.ownerOpenid };
}

function bonusFor(ownerOpenid, day = localDayKey()) {
  return load().rewards
    .filter((item) => item.ownerOpenid === ownerOpenid && item.day === day)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function resetForTest() {
  state = emptyState();
  persist();
}

module.exports = { createIntent, claimIntent, bonusFor, localDayKey, resetForTest };
