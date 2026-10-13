#!/usr/bin/env node
import { ResourceArgumentError } from '../src/resourcePrimitives.ts';
import {
  forceAcquireResources,
  parseForceAcquireOptions,
} from '../src/forceAcquire.ts';
import {
  collectResourceInventory,
  releaseResources,
} from '../src/resourceHost.ts';

const delay = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

async function main(): Promise<void> {
  const options = parseForceAcquireOptions(process.argv.slice(2), process.env);
  console.log(
    `[force-acquire] targets=${options.targets.length} slots=${options.targets
      .map(target => target.slot)
      .join(',')}`,
  );
  await forceAcquireResources(options, {
    collectInventory: collectResourceInventory,
    releaseResources,
    delay,
    log: line => console.log(line),
  });
  console.log('[force-acquire] ACQUIRED');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof ResourceArgumentError ? 2 : 1;
});
