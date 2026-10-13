import { createGzip } from 'node:zlib';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

export type LogRetentionDecision =
  | { action: 'keep-full'; reason: 'failure' }
  | { action: 'sample-compress'; reason: 'pass-sample' }
  | { action: 'discard'; reason: 'pass-unsampled' };

export type LogPolicy = {
  /** Maximum bytes retained under the job log root (measured after each finalize). */
  diskCeilingBytes: number;
  /** Keep every Nth passing shard log (plus always keep the first pass). */
  passSampleEvery: number;
  /** Lines retained at head/tail when sampling a pass log before gzip. */
  sampleHeadLines: number;
  sampleTailLines: number;
};

export const DEFAULT_LOG_POLICY: LogPolicy = {
  diskCeilingBytes: 512 * 1024 * 1024,
  passSampleEvery: 10,
  sampleHeadLines: 40,
  sampleTailLines: 40,
};

export type FinalizedLog = {
  sourcePath: string;
  retainedPath?: string;
  decision: LogRetentionDecision;
  bytesRetained: number;
};

export type LogManager = {
  root: string;
  policy: LogPolicy;
  shardLogPath(iteration: number, shardId: string): string;
  finalizeShardLog(input: {
    iteration: number;
    shardId: string;
    outcome: 'pass' | 'fail' | 'cancelled';
    passIndex: number;
  }): Promise<FinalizedLog>;
  measureDiskUsage(): number;
  enforceDiskCeiling(): { deleted: string[]; bytesAfter: number };
};

function sampleText(content: string, head: number, tail: number): string {
  const lines = content.split(/\r?\n/);
  if (lines.length <= head + tail) {
    return content;
  }
  const omitted = lines.length - head - tail;
  return [
    ...lines.slice(0, head),
    `... [${omitted} lines omitted by reliability pass sampling] ...`,
    ...lines.slice(-tail),
  ].join('\n');
}

async function gzipFile(source: string, destination: string): Promise<void> {
  await pipeline(createReadStream(source), createGzip(), createWriteStream(destination));
}

function directoryBytes(root: string): number {
  if (!existsSync(root)) return 0;
  let total = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        total += statSync(full).size;
      }
    }
  }
  return total;
}

export function decideLogRetention(
  outcome: 'pass' | 'fail' | 'cancelled',
  passIndex: number,
  policy: LogPolicy,
): LogRetentionDecision {
  if (outcome !== 'pass') {
    return { action: 'keep-full', reason: 'failure' };
  }
  if (passIndex === 0 || passIndex % policy.passSampleEvery === 0) {
    return { action: 'sample-compress', reason: 'pass-sample' };
  }
  return { action: 'discard', reason: 'pass-unsampled' };
}

export function createLogManager(
  root: string,
  policy: LogPolicy = DEFAULT_LOG_POLICY,
): LogManager {
  mkdirSync(root, { recursive: true });

  return {
    root,
    policy,
    shardLogPath(iteration, shardId) {
      return path.join(root, `iter-${iteration}`, `${shardId}.log`);
    },
    async finalizeShardLog(input) {
      const sourcePath = this.shardLogPath(input.iteration, input.shardId);
      const decision = decideLogRetention(input.outcome, input.passIndex, policy);
      if (!existsSync(sourcePath)) {
        return { sourcePath, decision, bytesRetained: 0 };
      }
      if (decision.action === 'keep-full') {
        return {
          sourcePath,
          retainedPath: sourcePath,
          decision,
          bytesRetained: statSync(sourcePath).size,
        };
      }
      if (decision.action === 'discard') {
        unlinkSync(sourcePath);
        return { sourcePath, decision, bytesRetained: 0 };
      }
      const raw = readFileSync(sourcePath, 'utf8');
      const sampledPath = `${sourcePath}.sample`;
      writeFileSync(sampledPath, sampleText(raw, policy.sampleHeadLines, policy.sampleTailLines));
      const gzipPath = `${sampledPath}.gz`;
      await gzipFile(sampledPath, gzipPath);
      unlinkSync(sampledPath);
      unlinkSync(sourcePath);
      return {
        sourcePath,
        retainedPath: gzipPath,
        decision,
        bytesRetained: statSync(gzipPath).size,
      };
    },
    measureDiskUsage() {
      return directoryBytes(root);
    },
    enforceDiskCeiling() {
      const deleted: string[] = [];
      const listPassArchives = (): Array<{ path: string; mtimeMs: number; size: number }> => {
        const found: Array<{ path: string; mtimeMs: number; size: number }> = [];
        if (!existsSync(root)) return found;
        const stack = [root];
        while (stack.length > 0) {
          const current = stack.pop()!;
          for (const entry of readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
              stack.push(full);
            } else if (entry.isFile() && full.endsWith('.sample.gz')) {
              const stats = statSync(full);
              found.push({ path: full, mtimeMs: stats.mtimeMs, size: stats.size });
            }
          }
        }
        return found.sort((a, b) => a.mtimeMs - b.mtimeMs);
      };

      let bytes = directoryBytes(root);
      for (const archive of listPassArchives()) {
        if (bytes <= policy.diskCeilingBytes) break;
        unlinkSync(archive.path);
        deleted.push(archive.path);
        bytes -= archive.size;
      }
      return { deleted, bytesAfter: directoryBytes(root) };
    },
  };
}
