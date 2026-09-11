const KEY = 'cb_learning_v1';
const DAY = 86400000;
function read() {
  try { const d = wx.getStorageSync(KEY); if (d && Array.isArray(d.runs) && Array.isArray(d.wrongs)) return d; } catch (e) { /* Local storage can be unavailable. */ }
  return { runs: [], wrongs: [] };
}
function scopeKey(cfg) { return `${cfg.version}:${cfg.bookId}`; }
function key(q, cfg) { return `${scopeKey(cfg)}:${q.type || ''}:${q.stem}`; }
function record(cfg, questions, wrongs, seconds, review) {
  const d = read(), now = Date.now();
  const failed = new Set(wrongs.map((q) => key(q, cfg)));
  questions.forEach((q) => {
    const id = key(q, cfg), previous = d.wrongs.find((w) => w.id === id);
    if (failed.has(id)) {
      const item = { id, question: q, cfg: { ...cfg }, successes: 0, due: now + DAY, last: now };
      if (previous) Object.assign(previous, item); else d.wrongs.push(item);
    } else if (previous && review && previous.due <= now) {
      previous.successes += 1; previous.last = now;
      previous.due = now + 3 * DAY;
    }
  });
  d.wrongs = d.wrongs.filter((w) => w.successes < 2).slice(-300);
  d.runs.unshift({ at: now, cfg: { ...cfg }, count: questions.length, correct: questions.length - wrongs.length, seconds, review: !!review });
  d.runs = d.runs.slice(0, 180);
  try { wx.setStorageSync(KEY, d); } catch (e) { wx.showToast({ title: '本次记录未保存，存储空间不足', icon: 'none' }); }
  return d;
}
function reviewQuestions(cfg, dueOnly = true) {
  return read().wrongs.filter((w) => scopeKey(w.cfg) === scopeKey(cfg) && (!dueOnly || w.due <= Date.now())).map((w) => w.question);
}
function summary(cfg) {
  const d = read(), now = Date.now();
  const runs = d.runs.filter((r) => r.at >= now - 7 * DAY && (!cfg || scopeKey(r.cfg) === scopeKey(cfg)));
  const count = runs.reduce((n, r) => n + r.count, 0), correct = runs.reduce((n, r) => n + r.correct, 0);
  const wrongs = d.wrongs.filter((w) => !cfg || scopeKey(w.cfg) === scopeKey(cfg));
  return { count, rate: count ? Math.round(correct * 100 / count) : null,
    days: new Set(runs.map((r) => new Date(r.at).toDateString())).size,
    pending: wrongs.length, due: wrongs.filter((w) => w.due <= now).length,
    last: runs[0] || null };
}
module.exports = { read, record, reviewQuestions, summary };
