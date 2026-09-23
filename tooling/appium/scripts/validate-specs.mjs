const noOp = () => {};
const describe = (_title, define) => define();

Object.assign(globalThis, {
  before: noOp,
  describe,
  it: noOp,
});

const { SMOKE_SHARDS } = await import('../src/sessionShards.ts');

await Promise.all(
  SMOKE_SHARDS.map(shard => import(`../test/specs/formats.smoke.${shard.id}.spec.ts`)),
);

console.log(`OK: ${SMOKE_SHARDS.length} Appium smoke specs parse and register`);
