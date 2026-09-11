'use strict';

const app = require('./app');
const { PORT } = require('./config');

app.listen(PORT, () => {
  console.log(`[copybook-backend] listening on http://localhost:${PORT}`);
});
