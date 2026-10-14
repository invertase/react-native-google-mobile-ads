/**
 * Operator-facing burn-in status for `.agents/reports/e2e-deflake/dashboard.md`.
 *
 * Distinct from the ledger-backed `reliabilityDashboard`: burn-in receipts use
 * `counted: false`, so qualification credits stay empty until `qualify` mode.
 * This view answers "where are we / what's running / what's failing" from
 * live `/tmp/rngma-e2e-reliability/**` jsonl + run.log.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
function defaultRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

/** Physical burn-in workers for this campaign (not the full 0–7 slot space). */
export const OPERATOR_CAMPAIGN_SLOTS = [1, 2, 3, 4, 5] as const;

export const QUALIFY_ZERO_FAIL_OBSERVATIONS = 2995;
export const BURN_IN_TARGET_ITERATIONS = 100;
export const FINAL_LAYOUT_ID = 'final-smoke';
export const FINAL_LAYOUT_DIGEST =
  '3917c1a03a889686ba6f0303c7c8efbc1c1ea7e6ac5448d3080b153e9e38d46a';

export type OperatorReceipt = {
  receiptId?: string;
  jobId?: string;
  sequence?: number;
  recordedAt?: string;
  iteration?: number;
  cellKind?: string;
  cellId?: string;
  shardId?: string;
  outcome?: string;
  counted?: boolean;
};

export type OperatorJobSummary = {
  jobId: string;
  createdAt?: string;
  events: number;
  maxIteration: number;
  pass: number;
  fail: number;
  skip: number;
  startupPass: number;
  startupFail: number;
  preamblePass: number;
  preambleFail: number;
  testPass: number;
  testFail: number;
  topFails: Array<[string, number]>;
  lastAt?: string;
  hasSummary: boolean;
  summary?: Record<string, unknown>;
};

export type OperatorSlotStatus = {
  platform: 'android' | 'ios';
  slot: number;
  root: string | null;
  alive: boolean;
  activeJob: OperatorJobSummary | null;
  jobs: OperatorJobSummary[];
  runLogBytes?: number;
  runLogMtime?: string;
  infraAborts: Array<[string, string]>;
  recovers: number;
  anrDismiss: number;
  runTail: string[];
};

export type OperatorAggregate = {
  liveWorkers: number;
  slots: number;
  jobsSeen: number;
  jobsCompleted: number;
  activePass: number;
  activeFail: number;
  activeSkip: number;
  activeEvents: number;
  maxIterationAcrossActive: number;
  topFails: Array<[string, number]>;
};

export type OperatorDashboardSnapshot = {
  refreshedAt: string;
  tip: string;
  tipFull: string;
  recentCommits: string[];
  deviceHub: number;
  adbDevices: string[];
  bootedSims: string[];
  android: OperatorAggregate;
  ios: OperatorAggregate;
  slots: OperatorSlotStatus[];
};

export type OperatorDashboardDeps = {
  now?: () => Date;
  repoRoot?: string;
  reportRoot?: string;
  exec?: (bin: string, args: string[]) => string;
  exists?: (p: string) => boolean;
  readText?: (p: string) => string;
  writeText?: (p: string, body: string) => void;
  listJobFiles?: (receiptsDir: string) => string[];
  loadJson?: (p: string) => unknown;
  loadJsonl?: (p: string) => OperatorReceipt[];
  isAlive?: (platform: 'android' | 'ios', slot: number) => boolean;
};

function defaultExec(bin: string, args: string[]): string {
  try {
    return execFileSync(bin, args, { encoding: 'utf8' });
  } catch {
    return '';
  }
}

function countExact(name: string, exec: (bin: string, args: string[]) => string): number {
  const out = exec('pgrep', ['-x', name]);
  return out
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean).length;
}

function pickRoot(
  platform: 'android' | 'ios',
  slot: number,
  exists: (p: string) => boolean,
): string | null {
  if (platform === 'android') {
    for (const cand of [
      `/tmp/rngma-e2e-reliability/burn-in-parallel-v2/slot-${slot}-cores2`,
      `/tmp/rngma-e2e-reliability/burn-in-parallel-v2/slot-${slot}`,
    ]) {
      if (exists(cand)) return cand;
    }
    return null;
  }
  const cand = `/tmp/rngma-e2e-reliability/burn-in-ios/slot-${slot}`;
  return exists(cand) ? cand : null;
}

function summarizeJob(
  jobPath: string,
  deps: Required<
    Pick<OperatorDashboardDeps, 'exists' | 'loadJson' | 'loadJsonl'>
  >,
): OperatorJobSummary {
  const job = deps.loadJson(jobPath) as {
    jobId: string;
    createdAt?: string;
  };
  const receiptsDir = path.dirname(jobPath);
  const jsonlPath = path.join(receiptsDir, `${job.jobId}.jsonl`);
  const summaryPath = path.join(receiptsDir, `${job.jobId}.summary.json`);
  const rows = deps.exists(jsonlPath) ? deps.loadJsonl(jsonlPath) : [];
  const outcomes = new Map<string, number>();
  const byKind = new Map<string, number>();
  const failCells = new Map<string, number>();
  let maxIteration = 0;
  for (const row of rows) {
    const outcome = String(row.outcome ?? 'unknown');
    outcomes.set(outcome, (outcomes.get(outcome) ?? 0) + 1);
    const kindKey = `${row.cellKind ?? '?'}:${outcome}`;
    byKind.set(kindKey, (byKind.get(kindKey) ?? 0) + 1);
    maxIteration = Math.max(maxIteration, Number(row.iteration ?? 0));
    if (outcome === 'fail' && row.cellId) {
      failCells.set(row.cellId, (failCells.get(row.cellId) ?? 0) + 1);
    }
  }
  const topFails = [...failCells.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) as Array<[string, number]>;
  const hasSummary = deps.exists(summaryPath);
  return {
    jobId: job.jobId,
    createdAt: job.createdAt,
    events: rows.length,
    maxIteration,
    pass: outcomes.get('pass') ?? 0,
    fail: outcomes.get('fail') ?? 0,
    skip: (outcomes.get('skipped') ?? 0) + (outcomes.get('skip') ?? 0),
    startupPass: byKind.get('startup:pass') ?? 0,
    startupFail: byKind.get('startup:fail') ?? 0,
    preamblePass: byKind.get('preamble:pass') ?? 0,
    preambleFail: byKind.get('preamble:fail') ?? 0,
    testPass: byKind.get('test:pass') ?? 0,
    testFail: byKind.get('test:fail') ?? 0,
    topFails,
    lastAt: rows.at(-1)?.recordedAt ?? job.createdAt,
    hasSummary,
    summary: hasSummary
      ? (deps.loadJson(summaryPath) as Record<string, unknown>)
      : undefined,
  };
}

function parseRunLog(text: string): {
  infraAborts: Array<[string, string]>;
  recovers: number;
  anrDismiss: number;
  runTail: string[];
} {
  const infraAborts: Array<[string, string]> = [];
  for (const match of text.matchAll(
    /Reliability infra abort \(([^)]+)\): ([^\n]+)/g,
  )) {
    infraAborts.push([match[1]!, match[2]!]);
  }
  return {
    infraAborts,
    recovers: (text.match(/device-lost on slot/g) ?? []).length,
    anrDismiss: (text.match(/Android ANR dismiss/g) ?? []).length,
    runTail: text
      .split(/\r?\n/)
      .map(l => l.trimEnd())
      .filter(l => l.trim())
      .slice(-6),
  };
}

export function summarizeSlot(
  platform: 'android' | 'ios',
  slot: number,
  deps: OperatorDashboardDeps = {},
): OperatorSlotStatus {
  const exists = deps.exists ?? existsSync;
  const readText = deps.readText ?? ((p: string) => readFileSync(p, 'utf8'));
  const loadJson =
    deps.loadJson ?? ((p: string) => JSON.parse(readFileSync(p, 'utf8')));
  const loadJsonl =
    deps.loadJsonl ??
    ((p: string) =>
      readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => JSON.parse(l) as OperatorReceipt));
  const listJobFiles =
    deps.listJobFiles ??
    ((receiptsDir: string) => {
      if (!exists(receiptsDir)) return [];
      return readdirSync(receiptsDir)
        .filter(name => /^job_.*\.job\.json$/.test(name))
        .map(name => path.join(receiptsDir, name))
        .sort((a, b) => {
          try {
            return statSync(a).mtimeMs - statSync(b).mtimeMs;
          } catch {
            return a.localeCompare(b);
          }
        });
    });
  const isAlive =
    deps.isAlive ??
    ((plat, s) => {
      const out = (deps.exec ?? defaultExec)('pgrep', [
        '-f',
        `reliability burn-in --platform=${plat} --slot=${s}`,
      ]);
      return out.trim().length > 0;
    });

  const root = pickRoot(platform, slot, exists);
  const status: OperatorSlotStatus = {
    platform,
    slot,
    root,
    alive: isAlive(platform, slot),
    activeJob: null,
    jobs: [],
    infraAborts: [],
    recovers: 0,
    anrDismiss: 0,
    runTail: [],
  };
  if (!root) return status;

  const receiptsDir = path.join(root, 'receipts');
  status.jobs = listJobFiles(receiptsDir).map(jobPath =>
    summarizeJob(jobPath, { exists, loadJson, loadJsonl }),
  );
  const openJobs = status.jobs.filter(j => !j.hasSummary);
  status.activeJob = openJobs.at(-1) ?? status.jobs.at(-1) ?? null;

  const runLog = path.join(root, 'run.log');
  if (exists(runLog)) {
    const text = readText(runLog);
    const parsed = parseRunLog(text);
    status.runLogBytes = Buffer.byteLength(text, 'utf8');
    status.runLogMtime = new Date(statSync(runLog).mtimeMs)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    status.infraAborts = parsed.infraAborts;
    status.recovers = parsed.recovers;
    status.anrDismiss = parsed.anrDismiss;
    status.runTail = parsed.runTail;
  }
  return status;
}

export function aggregateSlots(
  slots: readonly OperatorSlotStatus[],
): OperatorAggregate {
  const topFails = new Map<string, number>();
  let liveWorkers = 0;
  let jobsSeen = 0;
  let jobsCompleted = 0;
  let activePass = 0;
  let activeFail = 0;
  let activeSkip = 0;
  let activeEvents = 0;
  let maxIterationAcrossActive = 0;
  for (const slot of slots) {
    if (slot.alive) liveWorkers += 1;
    jobsSeen += slot.jobs.length;
    jobsCompleted += slot.jobs.filter(j => j.hasSummary).length;
    const active = slot.activeJob;
    if (!active) continue;
    maxIterationAcrossActive = Math.max(
      maxIterationAcrossActive,
      active.maxIteration,
    );
    activePass += active.pass;
    activeFail += active.fail;
    activeSkip += active.skip;
    activeEvents += active.events;
    for (const [cell, n] of active.topFails) {
      topFails.set(cell, (topFails.get(cell) ?? 0) + n);
    }
  }
  return {
    liveWorkers,
    slots: slots.length,
    jobsSeen,
    jobsCompleted,
    activePass,
    activeFail,
    activeSkip,
    activeEvents,
    maxIterationAcrossActive,
    topFails: [...topFails.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
  };
}

export function collectOperatorDashboardSnapshot(
  deps: OperatorDashboardDeps = {},
): OperatorDashboardSnapshot {
  const now = deps.now ?? (() => new Date());
  const exec = deps.exec ?? defaultExec;
  const repoRoot = deps.repoRoot ?? defaultRepoRoot();
  const refreshedAt = now().toISOString();
  const tip = exec('git', ['-C', repoRoot, 'log', '-1', '--format=%h %s']).trim();
  const tipFull = exec('git', ['-C', repoRoot, 'log', '-1', '--format=%H']).trim();
  const recentCommits = exec('git', ['-C', repoRoot, 'log', '--oneline', '-12'])
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const slots: OperatorSlotStatus[] = [];
  for (const platform of ['android', 'ios'] as const) {
    for (const slot of OPERATOR_CAMPAIGN_SLOTS) {
      slots.push(summarizeSlot(platform, slot, deps));
    }
  }
  const android = aggregateSlots(slots.filter(s => s.platform === 'android'));
  const ios = aggregateSlots(slots.filter(s => s.platform === 'ios'));
  const adbDevices = exec('adb', ['devices'])
    .split(/\r?\n/)
    .slice(1)
    .map(l => l.trim())
    .filter(l => l.includes('\tdevice'));
  const bootedSims = exec('xcrun', ['simctl', 'list', 'devices', 'booted'])
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.includes('slot-'));
  return {
    refreshedAt,
    tip,
    tipFull,
    recentCommits,
    deviceHub: countExact('DeviceHub', exec),
    adbDevices,
    bootedSims,
    android,
    ios,
    slots,
  };
}

function shortJob(id: string | undefined): string {
  if (!id) return '—';
  return id.length > 16 ? `${id.slice(0, 14)}…` : id;
}

export function renderOperatorDashboardMarkdown(
  snap: OperatorDashboardSnapshot,
): string {
  const lines: string[] = [];
  const w = (s = '') => lines.push(s);

  w('# RNGMA E2E Deflake Dashboard');
  w();
  w(`> Operator status refreshed: \`${snap.refreshedAt}\``);
  w(`> Integration tip: \`${snap.tip || 'unknown'}\``);
  w(
    '> Burn-in receipts use `counted: false` — **not** statistical qualification credits yet.',
  );
  w(
    `> Authoritative cell confidence (${QUALIFY_ZERO_FAIL_OBSERVATIONS.toLocaleString()} observations @ 95% / 0.1% flake) starts in \`qualify\` mode after burn-in gates close.`,
  );
  w();
  w('## Goal');
  w();
  w(
    'Make Android and iOS E2E **complete and trustworthy** so a future CI failure is overwhelmingly likely to be real:',
  );
  w();
  w(
    '1. Every shipped public API has a behavioral proof owner (Jest/types, Android JVM, iOS XCTest, or Appium).',
  );
  w(
    '2. Reach 100% coverage on agreed owned code, or explicit accepted `EX-*` / GMA-AD-6 exceptions.',
  );
  w(
    '3. Statistically qualify every CI semantic test plus startup and shard-preamble cells.',
  );
  w(
    '4. Keep Android classic compiling and passing periodic full-layout canaries; **qualify** Android Next-Gen and iOS.',
  );
  w();
  w('### Acceptance math (active policy)');
  w();
  w('- Confidence: **95%** one-sided');
  w('- Max non-actionable failure rate: **0.1%**');
  w(
    `- Zero-failure cell target: **${QUALIFY_ZERO_FAIL_OBSERVATIONS.toLocaleString()}** valid observations (\`ceil(log(0.05)/log(0.999))\`)`,
  );
  w('- Qualifying configurations: `android-nextgen`, `ios`');
  w('- Compatibility canary only (no 2,995 target): `android-classic`');
  w(
    `- Frozen final layout: \`${FINAL_LAYOUT_ID}\` digest \`${FINAL_LAYOUT_DIGEST.slice(0, 12)}…\``,
  );
  w();
  w('### Where we are in the process');
  w();
  w('| Phase | Status | Notes |');
  w('| --- | --- | --- |');
  w('| HOST-01 / HOST-02 host readiness | **done** | GPG cache, AVDs 1–5, iOS sims 1–5 |');
  w(
    '| ED-01…ED-10 campaign infrastructure + coverage-first | **done** | Committed on integration branch |',
  );
  w(
    '| Executable / layout / policy freeze | **done** | `freeze-manifest.json` digests pinned |',
  );
  w(
    `| Live **burn-in** (final layout, ${BURN_IN_TARGET_ITERATIONS} iters/slot) | **IN PROGRESS** | Parallel Android NG + iOS on workers 1–5 |`,
  );
  w(
    '| Burn-in gate close → **qualify** (2,995/cell) | **not started** | Needs stable burn-in + ledger credits |',
  );
  w(
    '| Classic Android canary cadence | **not started** | After NG/iOS qualify path is healthy |',
  );
  w();
  w(
    'Live queue (Mode B): `.agents/work-queues/e2e-deflake.md` · Plan: `.agents/reports/e2e-deflake/plan.md`',
  );
  w();
  w('## Currently running (and why)');
  w();
  w(
    '**Why burn-in now:** coverage-first + reliability harness items are committed. Before minting statistical credits we shake out host infra (HangDetector AVD deaths, ANR dialogs, DeviceHub floods, Metro readiness) and prove the final layout can complete iterations without infra aborts.',
  );
  w();
  w(
    `- **Android Next-Gen burn-in:** slots 1–5, \`${BURN_IN_TARGET_ITERATIONS}\` iterations, layout \`${FINAL_LAYOUT_ID}\`, worktrees \`e2e-deflake-{1..5}\`, artifacts under \`/tmp/rngma-e2e-reliability/burn-in-parallel-v2/slot-N-cores2/\``,
  );
  w(
    `- **iOS burn-in:** slots 1–5, \`${BURN_IN_TARGET_ITERATIONS}\` iterations, same layout, artifacts under \`/tmp/rngma-e2e-reliability/burn-in-ios/slot-N/\``,
  );
  w(
    '- **DeviceHub:** suppressed (`RNGMA_IOS_DEVICE_HUB=suppress` + SIGKILL watchdog) — UI unused by Appium; CoreSimulator was flooding windows',
  );
  w(
    '- **AVD runtime:** `-cores 2 -noaudio` (CI-aligned) to reduce HangDetector surface under dual-platform load',
  );
  w();
  w(`DeviceHub processes now: **${snap.deviceHub}**`);
  w();
  w('### Worker heartbeat');
  w();
  w(
    `| Platform | Slot | Worker | Active job | Max iter / ${BURN_IN_TARGET_ITERATIONS} | Pass | Fail | Skip | Events | Last receipt | Root |`,
  );
  w('| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |');
  for (const slot of snap.slots) {
    const aj = slot.activeJob;
    w(
      `| ${slot.platform} | ${slot.slot} | ${slot.alive ? 'UP' : 'DOWN'} | \`${shortJob(aj?.jobId)}\` | ${aj?.maxIteration ?? 0} | ${aj?.pass ?? 0} | ${aj?.fail ?? 0} | ${aj?.skip ?? 0} | ${aj?.events ?? 0} | ${aj?.lastAt ?? '—'} | \`${slot.root ?? '—'}\` |`,
    );
  }
  w();
  w('### Aggregate (active job per slot only)');
  w();
  w(
    '| Platform | Live workers | Max iter seen | Pass | Fail | Skip | Events | Completed jobs (summaries) |',
  );
  w('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const [name, agg] of [
    ['android', snap.android],
    ['ios', snap.ios],
  ] as const) {
    w(
      `| ${name} | ${agg.liveWorkers}/5 | ${agg.maxIterationAcrossActive} | ${agg.activePass} | ${agg.activeFail} | ${agg.activeSkip} | ${agg.activeEvents} | ${agg.jobsCompleted} |`,
    );
  }
  w();
  w(
    `Burn-in progress toward ${BURN_IN_TARGET_ITERATIONS} iterations is measured from receipt \`iteration\` (not suite wall-clock). Qualification (${QUALIFY_ZERO_FAIL_OBSERVATIONS.toLocaleString()}/cell) has **not** begun — burn-in receipts intentionally set \`counted: false\`.`,
  );
  w();
  w('### Top failing cells (active jobs)');
  w();
  w('| Platform | Cell | Fail count |');
  w('| --- | --- | ---: |');
  for (const [plat, agg] of [
    ['android', snap.android],
    ['ios', snap.ios],
  ] as const) {
    if (agg.topFails.length === 0) {
      w(`| ${plat} | _(none in active job)_ | 0 |`);
      continue;
    }
    for (const [cell, n] of agg.topFails) {
      w(`| ${plat} | \`${cell}\` | ${n} |`);
    }
  }
  w();
  w('### Infra signals (from run.log)');
  w();
  w(
    '| Platform | Slot | device-lost recovers | ANR dismiss lines | Recent infra aborts |',
  );
  w('| --- | ---: | ---: | ---: | --- |');
  for (const slot of snap.slots) {
    const abortS =
      slot.infraAborts.length === 0
        ? '—'
        : slot.infraAborts
            .slice(-2)
            .map(([k, m]) => `${k}: ${m.slice(0, 80)}`)
            .join('; ');
    w(
      `| ${slot.platform} | ${slot.slot} | ${slot.recovers} | ${slot.anrDismiss} | ${abortS} |`,
    );
  }
  w();
  w('### Devices');
  w();
  w('**adb**');
  if (snap.adbDevices.length === 0) w('- _(none)_');
  for (const d of snap.adbDevices) w(`- \`${d}\``);
  w();
  w('**Booted iOS slot sims**');
  if (snap.bootedSims.length === 0) w('- _(none)_');
  for (const d of snap.bootedSims) w(`- ${d}`);
  w();
  w('## Amendment history (runtime / harness)');
  w();
  w(
    'Chronological operator amendments since live burn-in began (not every git commit):',
  );
  w();
  w('| When (approx) | Amendment | Why |');
  w('| --- | --- | --- |');
  w(
    '| Campaign freeze | Pin layout/policy/executable digests in `freeze-manifest.json` | Qualification must not silently drift |',
  );
  w(
    '| Pre-burn-in FR | Fail-fast gallery + live Metro ownership + Android UDID pin | Stop cross-slot attach / false greens |',
  );
  w(
    '| `f7c4e4a` | Android **device-lost** recover+retry (HangDetector → SIGSEGV dump-and-die) | Multi-AVD host deaths were aborting jobs as product flakes |',
  );
  w(
    '| Live AVD config | Emulator `-cores 2 -noaudio`; AVD `hw.cpu.ncore=2`, audio off | Align with CI; reduce HangDetector CPU looper surface + audio load |',
  );
  w(
    '| ANR dismiss | adb `dumpsys window` + tap **Wait** on “isn’t responding” | System dialogs wedged Appium; UiAutomator unreliable here |',
  );
  w(
    '| DeviceHub | Default `suppress`; kill with SIGKILL; live watchdog every 2s | Xcode 27 CoreSimulator + `open -n` reconcile flooded dozens of windows |',
  );
  w(
    '| iOS burn-in restart | Staggered Metro relaunch after suppress cutover | Parallel Metro cold-starts timed out at 120s under load |',
  );
  w(
    '| Operator dashboard | Receipt-backed `dashboard.md` via `refresh-operator-dashboard` | Ledger dashboard stays empty until qualify credits exist |',
  );
  w(
    '| Overnight capacity | Android burn-in capped at slots **1–3** (AVDs 4–5 left off) under 5× iOS | 5×5 dual-platform + foreign AVD was HangDetector / ANR thrash |',
  );
  w();
  w('### Recent integration commits');
  w();
  for (const line of snap.recentCommits) w(`- \`${line}\``);
  w();
  w('## Statistical qualification (not yet live)');
  w();
  w('| Metric | Value |');
  w('| --- | --- |');
  w('| Ledger source | empty / burn-in (`counted: false`) |');
  w('| Authoritative credits | **0** |');
  w('| Qualified cells | **0** / (all final-layout cells × 2 configs) |');
  w(
    `| Remaining observations (zero-fail path) | **${QUALIFY_ZERO_FAIL_OBSERVATIONS.toLocaleString()} per cell** once qualify starts |`,
  );
  w('| ETA | n/a until qualify throughput is measured |');
  w();
  w('## Per-slot detail');
  w();
  for (const slot of snap.slots) {
    w(`### ${slot.platform} slot ${slot.slot} — ${slot.alive ? 'UP' : 'DOWN'}`);
    w();
    if (!slot.root) {
      w('_No artifact root._');
      w();
      continue;
    }
    w(`- Root: \`${slot.root}\``);
    if (slot.runLogMtime) {
      w(
        `- run.log mtime: \`${slot.runLogMtime}\` (${slot.runLogBytes ?? 0} bytes)`,
      );
    }
    for (const job of slot.jobs) {
      const marker =
        slot.activeJob?.jobId === job.jobId ? ' **(active)**' : '';
      const done = job.hasSummary ? ' summary written' : '';
      w(
        `- Job \`${job.jobId}\`${marker}${done}: iter≤${job.maxIteration}, pass=${job.pass} fail=${job.fail} skip=${job.skip} events=${job.events} last=${job.lastAt ?? '—'}`,
      );
      if (job.summary) {
        w(
          `  - summary: ownership=${String(job.summary.ownershipFinal)} iterationsCompleted=${String(job.summary.iterationsCompleted)}/${String(job.summary.iterationsPlanned)} shardFailures=${String(job.summary.shardFailures)} infraAbort=${JSON.stringify(job.summary.infraAbort)}`,
        );
      }
      if (job.topFails.length > 0) {
        w(
          `  - fails: ${job.topFails.map(([c, n]) => `\`${c}\`×${n}`).join(', ')}`,
        );
      }
    }
    if (slot.runTail.length > 0) {
      w('- run.log tail:');
      w('```');
      for (const line of slot.runTail) w(line.slice(0, 200));
      w('```');
    }
    w();
  }

  w('## How to refresh this file');
  w();
  w('```bash');
  w('yarn workspace @invertase/rngma-appium reliability:operator-dashboard');
  w('```');
  w();
  w(
    'Formal ledger dashboard (`yarn tests:appium:reliability:campaign --refresh-dashboard`) stays empty until `qualify` mints credits.',
  );
  w();
  return `${lines.join('\n').trimEnd()}\n`;
}

export function writeOperatorDashboardArtifacts(
  snap: OperatorDashboardSnapshot,
  deps: OperatorDashboardDeps = {},
): { markdownPath: string; jsonPath: string } {
  const repoRoot = deps.repoRoot ?? defaultRepoRoot();
  const reportRoot =
    deps.reportRoot ?? path.join(repoRoot, '.agents', 'reports', 'e2e-deflake');
  mkdirSync(reportRoot, { recursive: true });
  const markdownPath = path.join(reportRoot, 'dashboard.md');
  const jsonPath = path.join(reportRoot, 'operator-status.json');
  const writeText =
    deps.writeText ?? ((p: string, body: string) => writeFileSync(p, body, 'utf8'));
  writeText(markdownPath, renderOperatorDashboardMarkdown(snap));
  writeText(
    jsonPath,
    `${JSON.stringify(
      {
        refreshedAt: snap.refreshedAt,
        tip: snap.tip,
        tipFull: snap.tipFull,
        deviceHub: snap.deviceHub,
        android: snap.android,
        ios: snap.ios,
        adbDevices: snap.adbDevices,
        bootedSims: snap.bootedSims,
        slots: snap.slots.map(({ runTail: _tail, ...rest }) => rest),
      },
      null,
      2,
    )}\n`,
  );
  return { markdownPath, jsonPath };
}
