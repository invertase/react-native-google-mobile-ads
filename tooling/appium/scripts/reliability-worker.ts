#!/usr/bin/env node
import {
  createDryRunReliabilityRunner,
  parseReliabilityWorkerArgv,
  runReliabilityWorker,
} from '../src/reliabilityWorker.ts';

async function main(): Promise<void> {
  const options = parseReliabilityWorkerArgv(process.argv.slice(2), process.env);
  console.log(
    `[reliability] mode=${options.mode} platform=${options.platform} slot=${options.slot} layout=${options.layoutKind} iterations=${options.iterations} dryRun=${options.dryRun}`,
  );

  if (!options.dryRun) {
    throw new Error(
      'Reliability worker executes device-free with --dry-run (immutable receipts, layouts, ownership). Live single-slot Appium shard execution is not attached yet; use named yarn tests:appium:* scripts for device runs.',
    );
  }

  const summary = await runReliabilityWorker(options, {
    runner: createDryRunReliabilityRunner(),
  });
  console.log(`[reliability] job=${summary.job.jobId}`);
  console.log(`[reliability] layoutId=${summary.layout.id}`);
  console.log(`[reliability] layoutDigest=${summary.layout.digest}`);
  console.log(`[reliability] receipts=${summary.receiptsPath}`);
  console.log(
    `[reliability] credited startup=${summary.credited.startup} preamble=${summary.credited.preamble} test=${summary.credited.test}`,
  );
  console.log(
    `[reliability] ownership=${summary.ownershipFinal} shardFailures=${summary.shardFailures} diskBytes=${summary.diskBytes}/${summary.diskCeilingBytes}`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
