'use strict';

const { HttpError } = require('../utils/http-error');

function notFound(req, res) {
  res.status(404).json({ error: '接口不存在' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON 格式不正确' });
  console.error('[copybook-backend] unhandled error:', err);
  return res.status(500).json({ error: '服务器内部错误' });
}

module.exports = { notFound, errorHandler };
