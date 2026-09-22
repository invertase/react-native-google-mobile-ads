import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { releaseResources } from '../src/resourceHost.ts';
import {
  classifyResources,
  isBusy,
  OPERATIONAL_SLOTS,
  parseResourceOptions,
  ResourceArgumentError,
  resourceKey,
  type ResourceInventory,
} from '../src/resourcePrimitives.ts';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function inventory(
  overrides: Partial<ResourceInventory> = {},
): ResourceInventory {
  return {
    listeners: new Map(),
    androidDevices: [],
    androidApps: new Set(),
    iosSimulators: [],
    iosApps: new Set(),
    ...overrides,
  };
}

describe('Appium check/release resources', () => {
  test('exposes check and release at root and workspace levels', () => {
    const root = JSON.parse(
      readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const workspace = JSON.parse(
      readFileSync(
        path.join(repositoryRoot, 'tooling/appium/package.json'),
        'utf8',
      ),
    ) as { scripts: Record<string, string> };
    assert.equal(
      root.scripts['tests:appium:check'],
      'yarn workspace @invertase/rngma-appium check',
    );
    assert.equal(
      root.scripts['tests:appium:release'],
      'yarn workspace @invertase/rngma-appium release',
    );
    assert.equal(workspace.scripts.check, 'tsx ./scripts/check-resources.ts');
    assert.equal(workspace.scripts.release, 'tsx ./scripts/release-resources.ts');
  });

  test('targets serial ports and exact default devices', () => {
    const options = parseResourceOptions([], {}, 'check');
    assert.deepEqual(
      options.targets.map(target => ({
        platform: target.platform,
        metro: target.metroPort,
        appium: target.appiumPort,
        automation: target.automationPort,
        mjpeg: target.mjpegPort,
        serial: target.androidSerial,
        avd: target.androidAvdName,
        simulator: target.iosSimulatorName,
      })),
      [
        {
          platform: 'android',
          metro: 8081,
          appium: 4725,
          automation: 8200,
          mjpeg: 7810,
          serial: 'emulator-5554',
          avd: 'TestingAVD',
          simulator: undefined,
        },
        {
          platform: 'ios',
          metro: 8081,
          appium: 4725,
          automation: 8100,
          mjpeg: 9100,
          serial: undefined,
          avd: undefined,
          simulator: 'iPhone 17',
        },
      ],
    );
  });

  test('reuses slot math for ports and exact device targets', () => {
    const options = parseResourceOptions(
      ['--slot=1', '--platform=android'],
      {},
      'check',
    );
    assert.deepEqual(options.targets[0], {
      slot: 1,
      platform: 'android',
      metroPort: 13007,
      appiumPort: 13013,
      automationPort: 13014,
      mjpegPort: 13015,
      androidConsolePort: 5558,
      androidSerial: 'emulator-5558',
      androidAvdName: 'TestingAVD-1',
    });
    assert.equal(
      parseResourceOptions([], {
        RNGMA_E2E_SLOT: '2',
        RNGMA_E2E_PLATFORM: 'ios',
      }, 'check').targets[0]?.iosSimulatorName,
      'RN E2E iOS slot-2',
    );
  });

  test('rejects slots 0 and 3 before resource work', () => {
    for (const slot of ['', '0', '3']) {
      assert.throws(
        () => parseResourceOptions([`--slot=${slot}`], {}, 'release'),
        ResourceArgumentError,
      );
    }
  });

  test('--all-slots contains serial and operational slots but never slot 3', () => {
    const options = parseResourceOptions(
      ['--all-slots', '--platform=android'],
      {},
      'release',
    );
    assert.deepEqual(
      options.targets.map(target => target.slot),
      [undefined, ...OPERATIONAL_SLOTS],
    );
    const rendered = JSON.stringify(options.targets);
    assert.doesNotMatch(rendered, /TestingAVD-3|emulator-5562|1500[7]|1501[3-5]/);
  });

  test('whole-name iOS matching excludes longer and Detox names', () => {
    const options = parseResourceOptions(
      ['--slot=1', '--platform=ios'],
      {},
      'check',
    );
    const findings = classifyResources(
      options,
      inventory({
        iosSimulators: [
          { name: 'RN E2E iOS slot-10', udid: 'slot-10', state: 'Booted' },
          {
            name: 'RN E2E iOS slot-1-Detox',
            udid: 'slot-1-detox',
            state: 'Booted',
          },
          { name: 'RN E2E iOS slot-1', udid: 'exact', state: 'Shutdown' },
        ],
      }),
    );
    assert.equal(
      findings.find(finding => finding.kind === 'ios-device')?.state,
      'CLEAR',
    );
  });

  test('rejects unknown --only categories before release inventory', () => {
    for (const value of ['jet', 'firebase', 'macos-app', 'unknown']) {
      assert.throws(
        () => parseResourceOptions([`--only=${value}`], {}, 'release'),
        /unknown --only category/,
      );
    }
  });

  test('classifies default service ports as INFO and owned resources as BUSY', () => {
    const options = parseResourceOptions(
      ['--platform=android'],
      {},
      'check',
    );
    const findings = classifyResources(
      options,
      inventory({
        listeners: new Map([
          [8081, [10]],
          [4725, [11]],
          [8200, [12]],
          [7810, [13]],
          [5554, [14]],
        ]),
        androidDevices: [{ serial: 'emulator-5554', avdName: 'TestingAVD' }],
        androidApps: new Set([
          resourceKey('emulator-5554', 'com.microsoft.reacttestapp'),
        ]),
      }),
    );
    assert.equal(
      findings.find(finding => finding.detail.includes('(metro)'))?.state,
      'INFO',
    );
    assert.equal(
      findings.find(finding => finding.detail.includes('(console)'))?.state,
      'INFO',
    );
    assert.equal(
      findings.find(finding => finding.detail.includes('(appium)'))?.state,
      'BUSY',
    );
    assert.equal(
      findings.find(finding => finding.kind === 'android-device')?.state,
      'BUSY',
    );
    assert.equal(isBusy(findings), true);
  });

  test('--services escalates Metro and console while an empty inventory is clear', () => {
    const strict = parseResourceOptions(
      ['--platform=android', '--strict'],
      {},
      'check',
    );
    const busy = classifyResources(
      strict,
      inventory({ listeners: new Map([[8081, [20]], [5554, [21]]]) }),
    );
    assert.equal(
      busy.find(finding => finding.detail.includes('(metro)'))?.state,
      'BUSY',
    );
    assert.equal(
      busy.find(finding => finding.detail.includes('(console)'))?.state,
      'BUSY',
    );
    assert.equal(
      isBusy(classifyResources(strict, inventory())),
      false,
    );
  });

  test('does not attribute an app to the wrong AVD on the scoped serial', () => {
    const options = parseResourceOptions(
      ['--platform=android'],
      {},
      'check',
    );
    const findings = classifyResources(
      options,
      inventory({
        androidDevices: [
          { serial: 'emulator-5554', avdName: 'UnrelatedAVD' },
        ],
        androidApps: new Set([
          resourceKey('emulator-5554', 'com.microsoft.reacttestapp'),
        ]),
      }),
    );
    assert.equal(
      findings.find(finding => finding.kind === 'android-app')?.state,
      'CLEAR',
    );
    assert.equal(
      findings.find(finding => finding.kind === 'android-device')?.state,
      'CLEAR',
    );
  });

  test('all-slot device release skips slot 3 and Detox clones', () => {
    const options = parseResourceOptions(
      ['--all-slots', '--devices'],
      {},
      'release',
    );
    const signals: number[] = [];
    const commands: string[] = [];
    releaseResources(
      options,
      inventory({
        listeners: new Map([
          [13013, [101]],
          [15013, [303]],
        ]),
        androidDevices: [
          { serial: 'emulator-5558', avdName: 'TestingAVD-1' },
          { serial: 'emulator-5562', avdName: 'TestingAVD-3' },
        ],
        iosSimulators: [
          { name: 'RN E2E iOS slot-1', udid: 'slot-1', state: 'Booted' },
          {
            name: 'RN E2E iOS slot-1-Detox',
            udid: 'slot-1-detox',
            state: 'Booted',
          },
          { name: 'RN E2E iOS slot-3', udid: 'slot-3', state: 'Booted' },
        ],
      }),
      'SIGTERM',
      {
        signalPid(pid) {
          signals.push(pid);
        },
        run(bin, args) {
          commands.push([bin, ...args].join(' '));
        },
      },
    );
    assert.deepEqual(signals, [101]);
    assert.match(commands.join('\n'), /adb -s emulator-5558 emu kill/);
    assert.match(commands.join('\n'), /simctl shutdown slot-1/);
    assert.doesNotMatch(
      commands.join('\n'),
      /emulator-5562|TestingAVD-3|slot-1-detox|slot-3/,
    );
  });
});
