import { execFileSync, spawnSync } from 'node:child_process';
import {
  MIN_ANDROID_API,
  MIN_NODE_MAJOR,
  nodeMeetsMinimum,
  selectConnectedAndroidDevice,
  selectAndroidAvd,
} from '../src/hostPreflight.ts';
import { iosAppBundleResolution } from '../src/formats.ts';

function run(bin: string, args: string[]): string | null {
  try {
    return execFileSync(bin, args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function checkNode(): void {
  if (nodeMeetsMinimum()) {
    console.log(`Node ${process.version} meets the v${MIN_NODE_MAJOR}+ floor.`);
    return;
  }
  console.error(
    `Node ${process.version} is below the v${MIN_NODE_MAJOR}+ floor. Node 22 hard-fails this stack. If nvm is available: nvm install 24 && nvm use 24 then retry the same yarn command. Yarn 4.10.3 on Node 24.x may flake install (cancel handler after settle); retry the same yarn, do not downgrade Node.`,
  );
  process.exit(1);
}

function checkAndroid(): string {
  const sdkOut = run('adb', ['devices']);
  if (sdkOut == null) {
    console.error('adb is not available. Install platform-tools before yarn tests:appium:android.');
    process.exit(1);
  }
  const serials = sdkOut
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('*'))
    .map(line => line.split(/\s+/))
    .filter(parts => parts[0] && parts[1] === 'device')
    .map(parts => parts[0]!);

  const apis: { serial: string; api: number }[] = [];
  for (const serial of serials) {
    const raw = run('adb', ['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']);
    const api = raw ? Number(raw.trim()) : NaN;
    if (Number.isFinite(api)) {
      apis.push({ serial, api });
    }
  }

  const avdOut = run('emulator', ['-list-avds']);
  const names = avdOut
    ? avdOut
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
    : [];
  const avd = selectAndroidAvd(names);
  console.log(
    `emulator -list-avds: ${names.length === 0 ? 'none' : names.join(', ')}${
      avd ? `; deterministic choice=${avd.name} (API ${avd.api})` : ''
    }`,
  );

  const selectedSerial = process.env.RNGMA_ANDROID_UDID;
  const chosen = selectConnectedAndroidDevice(apis, selectedSerial);
  if (chosen) {
    console.log(
      `Android device ${chosen.serial} API ${chosen.api} (>= ${MIN_ANDROID_API}; UiAutomator2 needs 8.0+).`,
    );
    return chosen.serial;
  }

  if (selectedSerial) {
    const selected = apis.find(row => row.serial === selectedSerial);
    console.error(
      selected
        ? `Selected Android device ${selectedSerial} is API ${selected.api}; UiAutomator2 requires API ${MIN_ANDROID_API}+.`
        : `Selected Android device ${selectedSerial} is not connected and online.`,
    );
    console.error(
      `Choose a connected API ${MIN_ANDROID_API}+ serial or unset RNGMA_ANDROID_UDID. Connected: ${
        apis.length === 0 ? 'none' : apis.map(row => `${row.serial}=API${row.api}`).join(', ')
      }.`,
    );
  } else {
    console.error(
      `No connected Android device at API ${MIN_ANDROID_API}+. Connected: ${
        apis.length === 0 ? 'none' : apis.map(row => `${row.serial}=API${row.api}`).join(', ')
      }.`,
    );
  }
  if (avd) {
    console.error(
      `Boot ${avd.name} (API ${avd.api}) and retry the same yarn tests:appium:android. Do not retry on an API 24 emulator.`,
    );
  } else {
    console.error(
      `Create/boot an AVD at API ${MIN_ANDROID_API}+ (prefer API 36) then retry. emulator -list-avds is the inventory; do not guess the default AVD.`,
    );
  }
  process.exit(1);
}

function checkIos(): void {
  const resolution = iosAppBundleResolution();
  if (resolution.kind === 'absent') {
    console.log(
      'iOS appium:app omitted (no ReactTestApp.app found); using the installed com.microsoft.ReactTestApp bundle-id fallback.',
    );
    return;
  }
  if (resolution.kind === 'incomplete') {
    console.error(
      `iOS bundle is unavailable or incomplete (missing a regular ReactTestApp executable): ${resolution.path}. Rebuild it or correct RNGMA_IOS_APP; do not blindly retry Appium or Node.`,
    );
    process.exit(1);
  }
  console.log(`iOS app bundle is complete: ${resolution.path}`);
}

const target = process.argv[2] ?? 'all';
checkNode();
let androidUdid: string | undefined;
if (target === 'android' || target === 'all') {
  androidUdid = checkAndroid();
}
if (target === 'ios' || target === 'all') {
  checkIos();
}

if (process.argv.includes('--run')) {
  if (target !== 'android' && target !== 'ios') {
    console.error('--run requires an android or ios target.');
    process.exit(1);
  }
  const result = spawnSync('yarn', ['exec', 'wdio', 'run', `./wdio.${target}.conf.ts`], {
    env: {
      ...process.env,
      ...(androidUdid ? { RNGMA_ANDROID_UDID: androidUdid } : {}),
    },
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}
