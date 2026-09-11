'use strict';

const crypto = require('crypto');

function newId(prefix = 'sh') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = { newId };
