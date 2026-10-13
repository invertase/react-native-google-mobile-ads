import { randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const RECEIPT_CELL_KINDS = ['startup', 'preamble', 'test'] as const;
export type ReceiptCellKind = (typeof RECEIPT_CELL_KINDS)[number];

export const RECEIPT_OUTCOMES = ['pass', 'fail', 'cancelled', 'skipped'] as const;
export type ReceiptOutcome = (typeof RECEIPT_OUTCOMES)[number];

export const STARTUP_CELL_IDS = [
  'session-create',
  'app-launch',
  'bundle-load',
  'gallery-ready',
] as const;

export type StartupCellId = (typeof STARTUP_CELL_IDS)[number];

export type ReliabilityJobIdentity = {
  /** Immutable for the life of the job; never reused. */
  jobId: string;
  mode: string;
  platform: 'android' | 'ios';
  slot: number;
  layoutId: string;
  layoutDigest: string;
  createdAt: string;
};

export type ReliabilityReceipt = {
  /** Unique per append; replay of the same receiptId must not double-count. */
  receiptId: string;
  jobId: string;
  sequence: number;
  recordedAt: string;
  iteration: number;
  cellKind: ReceiptCellKind;
  cellId: string;
  shardId?: string;
  outcome: ReceiptOutcome;
  /**
   * Exactly-once countable credit. Only the first append for a given
   * (jobId, iteration, cellKind, cellId, shardId) with counted=true credits.
   */
  counted: boolean;
  detail?: string;
};

export type ReceiptStore = {
  job: ReliabilityJobIdentity;
  path: string;
  append(receipt: Omit<ReliabilityReceipt, 'receiptId' | 'sequence' | 'recordedAt' | 'jobId'>): ReliabilityReceipt;
  readAll(): ReliabilityReceipt[];
  /** Count credited outcomes with exactly-once semantics over receiptId. */
  countCredits(filter?: {
    cellKind?: ReceiptCellKind;
    outcome?: ReceiptOutcome;
  }): number;
};

function assertCellKind(value: string): asserts value is ReceiptCellKind {
  if (!(RECEIPT_CELL_KINDS as readonly string[]).includes(value)) {
    throw new Error(`Unknown receipt cellKind "${value}".`);
  }
}

function assertOutcome(value: string): asserts value is ReceiptOutcome {
  if (!(RECEIPT_OUTCOMES as readonly string[]).includes(value)) {
    throw new Error(`Unknown receipt outcome "${value}".`);
  }
}

export function createJobId(entropy: () => string = randomUUID): string {
  return `job_${entropy().replace(/-/g, '')}`;
}

export function createReceiptId(entropy: () => string = randomUUID): string {
  return `rcpt_${entropy().replace(/-/g, '')}`;
}

function creditKey(receipt: ReliabilityReceipt): string {
  return [
    receipt.jobId,
    String(receipt.iteration),
    receipt.cellKind,
    receipt.cellId,
    receipt.shardId ?? '',
  ].join('\0');
}

function parseReceiptLine(line: string, index: number): ReliabilityReceipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Receipt line ${index + 1} is not valid JSON.`);
  }
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error(`Receipt line ${index + 1} is not an object.`);
  }
  const row = parsed as Partial<ReliabilityReceipt>;
  if (typeof row.receiptId !== 'string' || row.receiptId === '') {
    throw new Error(`Receipt line ${index + 1} missing receiptId.`);
  }
  if (typeof row.jobId !== 'string' || row.jobId === '') {
    throw new Error(`Receipt line ${index + 1} missing jobId.`);
  }
  if (typeof row.sequence !== 'number' || !Number.isInteger(row.sequence)) {
    throw new Error(`Receipt line ${index + 1} missing integer sequence.`);
  }
  if (typeof row.cellKind !== 'string') {
    throw new Error(`Receipt line ${index + 1} missing cellKind.`);
  }
  assertCellKind(row.cellKind);
  if (typeof row.outcome !== 'string') {
    throw new Error(`Receipt line ${index + 1} missing outcome.`);
  }
  assertOutcome(row.outcome);
  if (typeof row.cellId !== 'string' || row.cellId === '') {
    throw new Error(`Receipt line ${index + 1} missing cellId.`);
  }
  if (typeof row.counted !== 'boolean') {
    throw new Error(`Receipt line ${index + 1} missing counted boolean.`);
  }
  if (typeof row.iteration !== 'number' || !Number.isInteger(row.iteration)) {
    throw new Error(`Receipt line ${index + 1} missing integer iteration.`);
  }
  if (typeof row.recordedAt !== 'string') {
    throw new Error(`Receipt line ${index + 1} missing recordedAt.`);
  }
  return row as ReliabilityReceipt;
}

export function openReceiptStore(
  job: ReliabilityJobIdentity,
  receiptRoot: string,
  options: {
    now?: () => Date;
    createReceiptId?: () => string;
  } = {},
): ReceiptStore {
  mkdirSync(receiptRoot, { recursive: true });
  const storePath = path.join(receiptRoot, `${job.jobId}.jsonl`);
  const identityPath = path.join(receiptRoot, `${job.jobId}.job.json`);
  if (existsSync(identityPath)) {
    const existing = JSON.parse(readFileSync(identityPath, 'utf8')) as ReliabilityJobIdentity;
    if (existing.jobId !== job.jobId) {
      throw new Error(`Job identity path collision for ${job.jobId}.`);
    }
    // Job identity is immutable: refuse silent mutation of an existing job file.
    if (JSON.stringify(existing) !== JSON.stringify(job)) {
      throw new Error(`Job ${job.jobId} identity is immutable and already recorded.`);
    }
  } else {
    // Write-once identity sidecar (not append-only; never rewritten).
    writeFileSync(identityPath, `${JSON.stringify(job, null, 2)}\n`, { flag: 'wx' });
  }

  const now = options.now ?? (() => new Date());
  const nextReceiptId = options.createReceiptId ?? createReceiptId;
  const seenReceiptIds = new Set<string>();
  const creditedKeys = new Set<string>();
  let nextSequence = 1;

  const hydrate = (): ReliabilityReceipt[] => {
    if (!existsSync(storePath)) return [];
    const lines = readFileSync(storePath, 'utf8')
      .split(/\r?\n/)
      .filter(line => line.trim() !== '');
    const rows = lines.map(parseReceiptLine);
    seenReceiptIds.clear();
    creditedKeys.clear();
    for (const row of rows) {
      if (seenReceiptIds.has(row.receiptId)) {
        throw new Error(`Duplicate receiptId ${row.receiptId} in append-only store.`);
      }
      seenReceiptIds.add(row.receiptId);
      if (row.counted) {
        const key = creditKey(row);
        if (creditedKeys.has(key)) {
          throw new Error(
            `Exactly-once credit violated for ${key.replace(/\0/g, '/')} via ${row.receiptId}.`,
          );
        }
        creditedKeys.add(key);
      }
      nextSequence = Math.max(nextSequence, row.sequence + 1);
    }
    return rows;
  };

  hydrate();

  return {
    job,
    path: storePath,
    append(input) {
      assertCellKind(input.cellKind);
      assertOutcome(input.outcome);
      if (input.jobId != null && input.jobId !== job.jobId) {
        throw new Error('Receipt jobId must match the open store job.');
      }
      let counted = input.counted;
      const provisional: ReliabilityReceipt = {
        receiptId: nextReceiptId(),
        jobId: job.jobId,
        sequence: nextSequence,
        recordedAt: now().toISOString(),
        iteration: input.iteration,
        cellKind: input.cellKind,
        cellId: input.cellId,
        ...(input.shardId != null ? { shardId: input.shardId } : {}),
        outcome: input.outcome,
        counted,
        ...(input.detail != null ? { detail: input.detail } : {}),
      };
      if (counted) {
        const key = creditKey(provisional);
        if (creditedKeys.has(key)) {
          // Downgrade silent double-credit attempts instead of corrupting the ledger.
          counted = false;
          provisional.counted = false;
          provisional.detail = [
            provisional.detail,
            'exactly-once: credit already recorded for this cell key',
          ]
            .filter(Boolean)
            .join('; ');
        } else {
          creditedKeys.add(key);
        }
      }
      if (seenReceiptIds.has(provisional.receiptId)) {
        throw new Error(`Refusing to append duplicate receiptId ${provisional.receiptId}.`);
      }
      appendFileSync(storePath, `${JSON.stringify(provisional)}\n`, { encoding: 'utf8' });
      seenReceiptIds.add(provisional.receiptId);
      nextSequence += 1;
      return provisional;
    },
    readAll() {
      return hydrate();
    },
    countCredits(filter = {}) {
      const rows = hydrate();
      const seen = new Set<string>();
      let total = 0;
      for (const row of rows) {
        if (!row.counted) continue;
        if (filter.cellKind != null && row.cellKind !== filter.cellKind) continue;
        if (filter.outcome != null && row.outcome !== filter.outcome) continue;
        if (seen.has(row.receiptId)) continue;
        seen.add(row.receiptId);
        total += 1;
      }
      return total;
    },
  };
}
