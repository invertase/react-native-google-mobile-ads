/* eslint-disable no-undef */
const detox = require('detox');
const adapter = require('detox/runners/mocha/adapter');

before(async () => {
  console.error('We are in init::before');
  await detox.init();
  console.error('init::before detox.init just finished');
  await device.launchApp();
  console.error('init::before device.launchApp just finished');
});

beforeEach(async function () {
  await adapter.beforeEach(this);
  await device.reloadReactNative();
});

afterEach(async function () {
  await adapter.afterEach(this);
});

after(async () => {
  await detox.cleanup();
});
