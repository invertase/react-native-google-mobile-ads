'use strict';

module.exports = {
  recursive: true,
  timeout: 720000,
  reporter: 'spec',
  slow: 2000,
  retries: 4,
  bail: true,
  file: 'e2e/init.js',
  exit: true,
  recursive: true,
  spec: ['../e2e/**/*.e2e.js'],
};
