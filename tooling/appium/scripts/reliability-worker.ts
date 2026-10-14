#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dismissAndroidAnrDialogsViaAdb } from '../src/androidAnrDismiss.ts';
import { recoverAndroidSlot } from '../src/reliabilityDeviceRecover.ts';
import { reconcileIosDeviceHub } from '../src/iosDeviceHub.ts';
import { ensureReliabilityMetroReady } from '../src/reliabilityMetro.ts';
import { slotResources } from '../src/slots.ts';
import {
  createDryRunReliabilityRunner,
  createLiveAppiumShardRunner,
  parseReliabilityWorkerArgv,
  runReliabilityWorker,
  spawnProcessToLog,
} from '../src/reliabilityWorker.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(packageRoot, '../..');

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

  let metroHandle: Awaited<ReturnType<typeof ensureReliabilityMetroReady>> | undefined;
  if (!options.dryRun) {
    const metroLogPath = path.join(
      options.logRoot,
      `metro-${options.platform}-slot-${options.slot}.log`,
    );
    console.log(
      `[reliability] ensuring slot ${options.slot} ${options.platform} Metro is packager-ready before Appium shards (log=${metroLogPath})`,
    );
    metroHandle = await ensureReliabilityMetroReady({
      slot: options.slot,
      platform: options.platform,
      repoRoot,
      logPath: metroLogPath,
      env: process.env,
    });
    console.log(
      `[reliability] Metro ready on 127.0.0.1:${metroHandle.metroPort} owned=${metroHandle.owned}`,
    );
  }

  try {
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
            ...(options.platform === 'android'
              ? {
                  async recoverDeviceLost() {
                    await recoverAndroidSlot({
                      slot: options.slot,
                      logPath: path.join(
                        options.logRoot,
                        `device-recover-android-slot-${options.slot}.log`,
                      ),
                    });
                  },
                  beforeShard() {
                    const serial = slotResources(options.slot, 'android').androidSerial;
                    const anr = dismissAndroidAnrDialogsViaAdb(serial);
                    if (anr.tapped > 0) {
                      console.warn(
                        `[reliability] Android ANR dismiss ${serial}: cleared=${anr.cleared} rounds=${anr.rounds} taps=${anr.tapped}`,
                      );
                    }
                  },
                }
              : {
                  beforeShard() {
                    // Default suppress: DeviceHub UI is unused by Appium and
                    // CoreSimulator floods windows under multi-slot load.
                    // Opt into windows with RNGMA_IOS_DEVICE_HUB=reconcile.
                    const result = reconcileIosDeviceHub();
                    if (result.opened > 0 || result.killed > 0) {
                      console.warn(
                        `[reliability] DeviceHub ${result.mode} killed=${result.killed} opened=${result.opened} desired=${result.desired.length}`,
                      );
                    }
                  },
                }),
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
  } finally {
    if (metroHandle?.owned) {
      console.log(
        `[reliability] stopping task-owned Metro on 127.0.0.1:${metroHandle.metroPort}`,
      );
      await metroHandle.stop();
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
