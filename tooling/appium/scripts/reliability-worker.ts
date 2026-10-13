#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDryRunReliabilityRunner,
  createLiveAppiumShardRunner,
  parseReliabilityWorkerArgv,
  runReliabilityWorker,
  spawnProcessToLog,
} from '../src/reliabilityWorker.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(): Promise<void> {
  const options = parseReliabilityWorkerArgv(process.argv.slice(2), process.env);
  console.log(
    `[reliability] mode=${options.mode} platform=${options.platform} slot=${options.slot} layout=${options.layoutKind} iterations=${options.iterations} dryRun=${options.dryRun}`,
  );

  const runner = options.dryRun
    ? createDryRunReliabilityRunner()
    : createLiveAppiumShardRunner({
        platform: options.platform,
        slot: options.slot,
        spawn: async request =>
          spawnProcessToLog({
            bin: 'yarn',
            args: ['exec', 'wdio', 'run', `./wdio.${request.platform}.conf.ts`],
            cwd: packageRoot,
            env: request.env,
            logPath: request.logPath,
          }),
      });

  if (!options.dryRun) {
    console.log(
      '[reliability] live Appium shard runner attached; ensure slot devices/Metro are ready and this checkout is not shared with other campaign Metros.',
    );
  }

  const summary = await runReliabilityWorker(options, {
    runner,
    ...(options.dryRun
      ? {}
      : {
          acquire: {
            async checkClear() {
              // Live acquire is operator-owned via check/force-acquire before invoke.
              return true;
            },
          },
          async release() {
            return undefined;
          },
        }),
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
