'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

process.env.COPYBOOK_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'copybook-share-test-'));
process.env.DAILY_SHEET_LIMIT = '3';
process.env.RATE_LIMIT_PER_MIN = '1000';
process.env.WXA_APPID = 'test-appid';

const app = require('../src/app');
const userStore = require('../src/store/user.store');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function createIntent(token) {
  const res = await fetch(`${base}/api/v1/share/intents`, {
    method: 'POST',
    headers: { 'x-user-token': token },
  });
  assert.equal(res.status, 201);
  return res.json();
}

async function claim(token, body) {
  const res = await fetch(`${base}/api/v1/share/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-user-token': token },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function groupProof(sessionKey, openGId) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), iv);
  const payload = JSON.stringify({ openGId, watermark: { appid: 'test-appid' } });
  return {
    encryptedData: Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64'),
    iv: iv.toString('base64'),
  };
}

test('好友打开分享链接后发起人 +1，同一好友当天不重复奖励', async () => {
  const ownerToken = userStore.issueToken('owner');
  const friendToken = userStore.issueToken('friend');
  const first = await createIntent(ownerToken);
  const awarded = await claim(friendToken, { id: first.id });
  assert.equal(awarded.status, 200);
  assert.equal(awarded.body.reward, 1);
  assert.equal(awarded.body.kind, 'friend');

  const second = await createIntent(ownerToken);
  const duplicate = await claim(friendToken, { id: second.id });
  assert.equal(duplicate.body.reward, 0);
  assert.equal(duplicate.body.duplicate, true);

  const quota = await fetch(`${base}/api/v1/quota`, { headers: { 'x-user-token': ownerToken } }).then((r) => r.json());
  assert.deepEqual({ baseLimit: quota.baseLimit, shareBonus: quota.shareBonus, limit: quota.limit }, { baseLimit: 3, shareBonus: 1, limit: 4 });
});

test('微信群打开并通过 openGId 校验后 +5，同一群当天不重复奖励', async () => {
  const ownerToken = userStore.issueToken('group-owner');
  const sessionKey = crypto.randomBytes(16).toString('base64');
  const memberToken = userStore.issueToken('group-member', sessionKey);
  const proof = groupProof(sessionKey, 'open-group-1');

  const first = await createIntent(ownerToken);
  const awarded = await claim(memberToken, { id: first.id, ...proof });
  assert.equal(awarded.status, 200);
  assert.equal(awarded.body.reward, 5);
  assert.equal(awarded.body.kind, 'group');

  const second = await createIntent(ownerToken);
  const duplicate = await claim(memberToken, { id: second.id, ...proof });
  assert.equal(duplicate.body.reward, 0);

  const quota = await fetch(`${base}/api/v1/quota`, { headers: { 'x-user-token': ownerToken } }).then((r) => r.json());
  assert.equal(quota.shareBonus, 5);
  assert.equal(quota.limit, 8);
});

test('自己打开、无会话和伪造群证明都不能领取奖励', async () => {
  const ownerToken = userStore.issueToken('guard-owner');
  const intent = await createIntent(ownerToken);
  const self = await claim(ownerToken, { id: intent.id });
  assert.equal(self.status, 400);
  assert.equal(self.body.code, 'SHARE_SELF_CLAIM');

  const noSession = await fetch(`${base}/api/v1/share/intents`, { method: 'POST' });
  assert.equal(noSession.status, 401);

  const memberToken = userStore.issueToken('guard-member', crypto.randomBytes(16).toString('base64'));
  const forgedIntent = await createIntent(ownerToken);
  const forged = await claim(memberToken, { id: forgedIntent.id, encryptedData: 'bad', iv: 'bad' });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.code, 'GROUP_PROOF_INVALID');
});
