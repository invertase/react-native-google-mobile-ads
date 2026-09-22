import { execFileSync } from 'node:child_process';
import {
  categoryWanted,
  EXAMPLE_ANDROID_PACKAGE,
  EXAMPLE_IOS_BUNDLE_ID,
  resourceKey,
  type ResourceFinding,
  type ResourceInventory,
  type ResourceOptions,
} from './resourcePrimitives.ts';

function output(bin: string, args: string[]): string {
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function runCommand(bin: string, args: string[]): void {
  try {
    execFileSync(bin, args, { stdio: 'ignore' });
  } catch {
    // Release is best effort; the scoped recheck determines success.
  }
}

function listenerPids(port: number): number[] {
  return output('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split(/\r?\n/)
    .map(value => Number(value.trim()))
    .filter(value => Number.isInteger(value) && value > 0);
}

function connectedAndroidSerials(): Set<string> {
  return new Set(
    output('adb', ['devices'])
      .split(/\r?\n/)
      .map(line => /^(\S+)\s+device$/.exec(line)?.[1])
      .filter((value): value is string => value != null),
  );
}

type SimctlDevice = { name: string; udid: string; state: string };

function iosDevices(): SimctlDevice[] {
  const raw = output('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      devices?: Record<
        string,
        Array<{ name?: string; udid?: string; state?: string; isAvailable?: boolean }>
      >;
    };
    return Object.values(parsed.devices ?? {})
      .flat()
      .filter(
        (device): device is {
          name: string;
          udid: string;
          state?: string;
          isAvailable?: boolean;
        } =>
          device.isAvailable !== false &&
          typeof device.name === 'string' &&
          typeof device.udid === 'string',
      )
      .map(device => ({
        name: device.name,
        udid: device.udid,
        state: device.state ?? 'Unknown',
      }));
  } catch {
    return [];
  }
}

export function collectResourceInventory(options: ResourceOptions): ResourceInventory {
  const ports = new Set<number>();
  for (const target of options.targets) {
    ports.add(target.metroPort);
    ports.add(target.appiumPort);
    ports.add(target.automationPort);
    ports.add(target.mjpegPort);
    if (target.androidConsolePort != null) ports.add(target.androidConsolePort);
  }
  const listeners = new Map([...ports].map(port => [port, listenerPids(port)]));

  const connected = connectedAndroidSerials();
  const androidDevices: Array<{ serial: string; avdName: string }> = [];
  const androidApps = new Set<string>();
  for (const target of options.targets.filter(target => target.platform === 'android')) {
    const serial = target.androidSerial!;
    if (!connected.has(serial)) continue;
    const avdName = output('adb', ['-s', serial, 'emu', 'avd', 'name'])
      .split(/\r?\n/)[0]
      ?.trim();
    if (avdName) androidDevices.push({ serial, avdName });
    if (
      output('adb', ['-s', serial, 'shell', 'pidof', EXAMPLE_ANDROID_PACKAGE]).trim()
    ) {
      androidApps.add(resourceKey(serial, EXAMPLE_ANDROID_PACKAGE));
    }
  }

  const targetIosNames = new Set(
    options.targets
      .filter(target => target.platform === 'ios')
      .map(target => target.iosSimulatorName!),
  );
  const simulators = iosDevices().filter(device => targetIosNames.has(device.name));
  const iosApps = new Set<string>();
  for (const simulator of simulators.filter(device => device.state === 'Booted')) {
    const services = output('xcrun', [
      'simctl',
      'spawn',
      simulator.udid,
      'launchctl',
      'print',
      'system',
    ]);
    if (services.includes(EXAMPLE_IOS_BUNDLE_ID)) {
      iosApps.add(resourceKey(simulator.udid, EXAMPLE_IOS_BUNDLE_ID));
    }
  }

  return {
    listeners,
    androidDevices,
    androidApps,
    iosSimulators: simulators,
    iosApps,
  };
}

function signalPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      console.error(`[release] could not send ${signal} to pid ${pid}`);
    }
  }
}

export type ResourceEffects = {
  signalPid(pid: number, signal: NodeJS.Signals): void;
  run(bin: string, args: string[]): void;
};

const defaultEffects: ResourceEffects = {
  signalPid,
  run: runCommand,
};

function killPids(
  pids: Iterable<number>,
  signal: NodeJS.Signals,
  effects: ResourceEffects,
): void {
  for (const pid of new Set(pids)) {
    effects.signalPid(pid, signal);
  }
}

export function releaseResources(
  options: ResourceOptions,
  inventory: ResourceInventory,
  signal: 'SIGTERM' | 'SIGKILL',
  effects: ResourceEffects = defaultEffects,
): void {
  const listenerPids = new Set<number>();
  for (const target of options.targets) {
    if (categoryWanted(options, 'metro')) {
      inventory.listeners.get(target.metroPort)?.forEach(pid => listenerPids.add(pid));
    }
    if (categoryWanted(options, 'appium')) {
      for (const port of [target.appiumPort, target.automationPort, target.mjpegPort]) {
        inventory.listeners.get(port)?.forEach(pid => listenerPids.add(pid));
      }
    }
  }
  killPids(listenerPids, signal, effects);

  for (const target of options.targets) {
    if (target.platform === 'android') {
      const exactDevice = inventory.androidDevices.some(
        device =>
          device.serial === target.androidSerial &&
          device.avdName === target.androidAvdName,
      );
      if (categoryWanted(options, 'android-apps') && exactDevice) {
        effects.run('adb', [
          '-s',
          target.androidSerial!,
          'shell',
          'am',
          'force-stop',
          EXAMPLE_ANDROID_PACKAGE,
        ]);
      }
      if (
        categoryWanted(options, 'android-emulator') &&
        exactDevice
      ) {
        effects.run('adb', ['-s', target.androidSerial!, 'emu', 'kill']);
      }
    } else {
      const exactBooted = inventory.iosSimulators.filter(
        simulator =>
          simulator.name === target.iosSimulatorName &&
          simulator.state === 'Booted',
      );
      if (!options.only || categoryWanted(options, 'ios-sims')) {
        for (const simulator of exactBooted) {
          effects.run('xcrun', [
            'simctl',
            'terminate',
            simulator.udid,
            EXAMPLE_IOS_BUNDLE_ID,
          ]);
        }
      }
      if (categoryWanted(options, 'ios-sims')) {
        for (const simulator of exactBooted) {
          effects.run('xcrun', ['simctl', 'shutdown', simulator.udid]);
        }
      }
    }
  }
}

export function releaseRelevantFindings(
  options: ResourceOptions,
  findings: readonly ResourceFinding[],
): ResourceFinding[] {
  return findings.filter(finding => {
    if (finding.kind === 'port') {
      if (finding.detail.includes('(metro)')) return categoryWanted(options, 'metro');
      if (finding.detail.includes('(console)')) return false;
      return categoryWanted(options, 'appium');
    }
    if (finding.kind === 'android-app') {
      return categoryWanted(options, 'android-apps');
    }
    if (finding.kind === 'android-device') {
      return categoryWanted(options, 'android-emulator');
    }
    if (finding.kind === 'ios-app') {
      return !options.only || categoryWanted(options, 'ios-sims');
    }
    return categoryWanted(options, 'ios-sims');
  });
}
