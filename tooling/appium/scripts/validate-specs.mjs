const noOp = () => {};
const describe = (_title, define) => define();

Object.assign(globalThis, {
  before: noOp,
  describe,
  it: noOp,
});

await Promise.all([
  import('../test/specs/formats.smoke.a-primary.spec.ts'),
  import('../test/specs/formats.smoke.b-secondary.spec.ts'),
  import('../test/specs/formats.smoke.c-tertiary.spec.ts'),
]);

console.log('OK: Appium smoke specs parse and register');
