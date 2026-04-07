#!/usr/bin/env node

const { main } = require('../src/server');

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
