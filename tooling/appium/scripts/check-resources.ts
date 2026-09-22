#!/usr/bin/env node
import {
  classifyResources,
  isBusy,
  parseResourceOptions,
  ResourceArgumentError,
} from '../src/resourcePrimitives.ts';
import { collectResourceInventory } from '../src/resourceHost.ts';

try {
  const options = parseResourceOptions(process.argv.slice(2), process.env, 'check');
  const findings = classifyResources(options, collectResourceInventory(options));
  console.log(
    `[appium-check] mode=${options.services ? 'services' : 'host-clear'} targets=${options.targets.length}`,
  );
  for (const finding of findings) {
    console.log(`${finding.state.padEnd(5)} ${finding.detail}`);
  }
  if (isBusy(findings)) {
    console.error('[appium-check] BUSY');
    process.exitCode = 1;
  } else {
    console.log('[appium-check] CLEAR');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof ResourceArgumentError ? 2 : 1;
}
