const { request } = require('./request');
const { api } = require('../config/index');
const { ensureSession, clearSession } = require('./session');

let lastClaimId = '';

function appendRewardId(path, id) {
  return `${path}${path.includes('?') ? '&' : '?'}shareReward=${encodeURIComponent(id)}`;
}

function enableShareTickets() {
  if (wx.showShareMenu) {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
  }
}

async function authenticatedRequest(options) {
  await ensureSession();
  try {
    return await request(options);
  } catch (e) {
    if (e.statusCode !== 401) throw e;
    clearSession();
    await ensureSession();
    return request(options);
  }
}

function rewardedShare(content) {
  return {
    ...content,
    promise: authenticatedRequest({ url: api.shareIntent, method: 'POST' })
      .then(({ id }) => ({ ...content, path: appendRewardId(content.path, id) }))
      .catch(() => content),
  };
}

function shareInfo(ticket) {
  return new Promise((resolve) => {
    if (!ticket || !wx.getShareInfo) return resolve(null);
    wx.getShareInfo({
      shareTicket: ticket,
      success: resolve,
      fail: () => resolve(null),
    });
  });
}

async function claimIncomingShare(options = {}) {
  const query = options.query || {};
  const id = query.shareReward || '';
  if (!id || id === lastClaimId) return;
  lastClaimId = id;
  try {
    const proof = await shareInfo(options.shareTicket);
    await authenticatedRequest({
      url: api.shareClaim,
      method: 'POST',
      data: {
        id,
        ...(proof ? { encryptedData: proof.encryptedData, iv: proof.iv } : {}),
      },
    });
  } catch (e) {
    // 奖励领取失败不阻塞被分享页面打开；同一链接由后端保证幂等。
  }
}

module.exports = { enableShareTickets, rewardedShare, claimIncomingShare };
