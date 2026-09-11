// utils/history.js
// 本地历史记录（真实存储在后端，这里只保存 id 与摘要，便于二次打开）
const KEY = 'copybook_history';
const MAX = 50;

function getHistory() {
  try {
    return wx.getStorageSync(KEY) || [];
  } catch (e) {
    return [];
  }
}

function addHistory(item) {
  const list = getHistory();
  list.unshift({ ...item, savedAt: Date.now() });
  wx.setStorageSync(KEY, list.slice(0, MAX));
}

function removeHistory(id) {
  const list = getHistory().filter((it) => it.id !== id);
  wx.setStorageSync(KEY, list);
  return list;
}

module.exports = { getHistory, addHistory, removeHistory };
