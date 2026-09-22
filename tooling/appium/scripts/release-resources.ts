#!/usr/bin/env node
import {
  classifyResources,
  isBusy,
  parseResourceOptions,
  ResourceArgumentError,
} from '../src/resourcePrimitives.ts';
import {
  collectResourceInventory,
  releaseRelevantFindings,
  releaseResources,
} from '../src/resourceHost.ts';

const delay = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

async function main(): Promise<void> {
  const options = parseResourceOptions(process.argv.slice(2), process.env, 'release');
  console.log(`[appium-release] targets=${options.targets.length} soft clear`);
  releaseResources(options, collectResourceInventory(options), 'SIGTERM');
  await delay(2_000);

  for (let round = 0; round <= 2; round++) {
    const inventory = collectResourceInventory(options);
    const findings = releaseRelevantFindings(
      options,
      classifyResources({ ...options, services: true }, inventory),
    );
    if (!isBusy(findings)) {
      console.log(`[appium-release] CLEAR after force round ${round}`);
      return;
    }
    if (round === 2) {
      for (const finding of findings.filter(item => item.state === 'BUSY')) {
        console.error(`BUSY  ${finding.detail}`);
      }
      throw new Error('resources remain busy after two force rounds.');
    }
    console.log(`[appium-release] force round ${round + 1}`);
    releaseResources(options, inventory, 'SIGKILL');
    await delay(2_000);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error instanceof ResourceArgumentError ? 2 : 1;
});
