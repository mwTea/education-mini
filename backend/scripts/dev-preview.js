'use strict';
const path = require('path');
const os = require('os');
process.env.COPYBOOK_DATA_DIR = path.join(os.tmpdir(), 'copybook-review-data');
const express = require('express');
const server = express();
server.use('/review', express.static(path.resolve(__dirname, '../../output/pdf')));
server.use(require('../src/app'));
server.listen(3101, '127.0.0.1', () => {
  console.log('Local API: http://127.0.0.1:3101');
  console.log('Print preview: http://127.0.0.1:3101/review/jijiao-2b-mixed.html');
});
