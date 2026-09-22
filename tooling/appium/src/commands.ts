import {
  parseAvailableIosSimulators,
  selectIosSimulator,
} from './hostPreflight.ts';
import {
  runtimeResources,
  serialAndroidApkPath,
  type RuntimeResources,
} from './slots.ts';

export type NamedCommand = {
  bin: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export function packagerCommand(
  resetCache: boolean,
  env: NodeJS.ProcessEnv = process.env,
): NamedCommand {
  const hasSlot = env.RNGMA_E2E_SLOT != null && env.RNGMA_E2E_SLOT !== '';
  const platform = env.RNGMA_E2E_PLATFORM;
  if (hasSlot && platform !== 'android' && platform !== 'ios') {
    throw new Error(
      'RNGMA_E2E_PLATFORM must be android or ios when RNGMA_E2E_SLOT selects a Metro port.',
    );
  }
  const runtime = runtimeResources(platform === 'ios' ? 'ios' : 'android', env);
  return {
    bin: 'yarn',
    args: [
      'workspace',
      'RNGoogleMobileAdsExample',
      'react-native',
      'start',
      ...(resetCache ? ['--reset-cache'] : []),
      ...(runtime.slot == null ? [] : ['--port', String(runtime.metroPort)]),
    ],
  };
}

export function androidSlotBootCommand(
  env: NodeJS.ProcessEnv = process.env,
): NamedCommand | undefined {
  const runtime = runtimeResources('android', env);
  const slot = runtime.slotResources;
  if (!slot) {
    return undefined;
  }
  return {
    bin: 'emulator',
    args: ['-avd', slot.androidAvdName, '-port', String(slot.androidConsolePort)],
  };
}

export function androidGradleCommand(
  env: NodeJS.ProcessEnv = process.env,
): NamedCommand {
  const runtime = runtimeResources('android', env);
  return {
    bin: process.platform === 'win32' ? 'gradlew.bat' : './gradlew',
    args: [
      'assembleDebug',
      ...(runtime.slot == null
        ? []
        : [`-PreactNativeDevServerPort=${runtime.metroPort}`]),
    ],
    cwd: 'RNGoogleMobileAdsExample/android',
  };
}

export function androidRunCommands(
  env: NodeJS.ProcessEnv = process.env,
): NamedCommand[] {
  const runtime = runtimeResources('android', env);
  if (runtime.slot == null) {
    return [
      {
        bin: 'yarn',
        args: ['workspace', 'RNGoogleMobileAdsExample', 'android'],
      },
    ];
  }
  const serial = runtime.slotResources!.androidSerial;
  const tcpPort = `tcp:${runtime.metroPort}`;
  return [
    androidGradleCommand(env),
    {
      bin: 'adb',
      args: ['-s', serial, 'reverse', tcpPort, tcpPort],
    },
    {
      bin: 'adb',
      args: ['-s', serial, 'install', '-r', serialAndroidApkPath()],
    },
    {
      bin: 'adb',
      args: [
        '-s',
        serial,
        'shell',
        'am',
        'start',
        '-n',
        'com.microsoft.reacttestapp/com.microsoft.reacttestapp.MainActivity',
      ],
    },
  ];
}

export type ConnectedAndroidRunDevice = {
  serial: string;
  avdName: string;
};

export function assertAndroidSlotRunInventory(
  runtime: RuntimeResources,
  avdNames: string[],
  connectedDevices: ConnectedAndroidRunDevice[],
): 'connected' | 'boot-required' {
  const slot = runtime.slotResources;
  if (!slot) {
    return 'connected';
  }
  if (!avdNames.includes(slot.androidAvdName)) {
    throw new Error(
      `RNGMA slot ${slot.slot} is unprovisioned: exact AVD ${slot.androidAvdName} is missing.`,
    );
  }
  const exactSerial = connectedDevices.find(device => device.serial === slot.androidSerial);
  if (!exactSerial) {
    return 'boot-required';
  }
  if (exactSerial.avdName !== slot.androidAvdName) {
    throw new Error(
      `Android slot serial ${slot.androidSerial} is running ${exactSerial.avdName || 'an unknown AVD'}, not exact ${slot.androidAvdName}.`,
    );
  }
  return 'connected';
}

export function iosBuildCommand(
  env: NodeJS.ProcessEnv = process.env,
): NamedCommand {
  const runtime = runtimeResources('ios', env);
  return {
    bin: 'yarn',
    args: [
      'workspace',
      'RNGoogleMobileAdsExample',
      'react-native',
      'build-ios',
      '--buildFolder',
      'build',
      ...(runtime.slot == null
        ? []
        : ['--extra-params', `RCT_METRO_PORT=${runtime.metroPort}`]),
    ],
    env:
      runtime.slot == null
        ? env
        : {
            ...env,
            RCT_METRO_PORT: String(runtime.metroPort),
          },
  };
}

export function parseRunUdid(argv: string[]): string {
  const udidIndex = argv.indexOf('--udid');
  const udid = udidIndex >= 0 ? argv[udidIndex + 1] : undefined;
  if (!udid || udidIndex !== argv.length - 2) {
    throw new Error('Usage: yarn tests:ios:run --udid <simulator-udid>');
  }
  return udid;
}

export function assertIosRunSelection(
  argv: string[],
  env: NodeJS.ProcessEnv,
  simulatorInventoryJson?: string,
): string {
  const udid = parseRunUdid(argv);
  const runtime = runtimeResources('ios', env);
  if (runtime.slot == null) {
    return udid;
  }
  const selectedUdid = env.RNGMA_IOS_UDID?.trim();
  const selectedVersion = env.RNGMA_IOS_VERSION?.trim();
  if (!selectedUdid || !selectedVersion) {
    throw new Error(
      'Slot iOS run requires RNGMA_IOS_UDID and RNGMA_IOS_VERSION emitted by tests:appium:ios:select-and-boot.',
    );
  }
  if (udid !== selectedUdid) {
    throw new Error(
      `--udid ${udid} conflicts with selector RNGMA_IOS_UDID=${selectedUdid}.`,
    );
  }
  if (!simulatorInventoryJson) {
    throw new Error('Slot iOS run requires an available simulator inventory.');
  }
  const selected = selectIosSimulator(
    parseAvailableIosSimulators(simulatorInventoryJson),
    {
      deviceName: runtime.slotResources!.iosSimulatorName,
      platformVersion: selectedVersion,
      udid: selectedUdid,
    },
  );
  if (!selected) {
    throw new Error(
      `RNGMA_IOS_UDID=${selectedUdid} is not an available exact ${runtime.slotResources!.iosSimulatorName} on iOS ${selectedVersion}.`,
    );
  }
  return selectedUdid;
}
