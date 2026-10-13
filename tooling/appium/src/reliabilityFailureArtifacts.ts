/**
 * Exact failure artifacts for reliability hardening: stable signatures, log
 * pointers, and enough context for later interstitial fix commits.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const FAILURE_CLASSIFICATIONS = [
  'ad-service',
  'order-dependency',
  'assertion',
  'startup',
  'unknown',
] as const;
export type FailureClassification = (typeof FAILURE_CLASSIFICATIONS)[number];

export type FailureArtifact = {
  artifactId: string;
  /**
   * Exact cell signature: classification + platform + caseId + normalized detail.
   * Stable identity for a single failing cell (interstitial fix naming).
   */
  signature: string;
  /**
   * Correlated service/cluster key: classification + platform + normalized detail
   * (no caseId). Shared across cells hit by the same ad-service failure class.
   */
  clusterKey: string;
  caseId: string;
  platform: 'android' | 'ios';
  shardId?: string;
  jobId?: string;
  iteration?: number;
  logPath?: string;
  detail?: string;
  classification: FailureClassification;
  /** Co-running case ids at the moment of failure (order/context pollution). */
  neighbors: readonly string[];
  recordedAt: string;
};

const AD_SERVICE_PATTERNS: readonly RegExp[] = [
  /\bno[\s_-]?fill\b/i,
  /\binventory\b/i,
  /\bERROR_CODE_(INTERNAL_ERROR|NETWORK_ERROR|NO_FILL|INVALID_REQUEST)\b/i,
  /\bad[\s_-]?service\b/i,
  /\bads?\s+request\s+failed\b/i,
  /\bUnable to obtain a JavascriptEngine\b/i,
  /\bgoogleads\.g\.doubleclick\.net\b/i,
  /\bGMA error\b/i,
];

const STARTUP_PATTERNS: readonly RegExp[] = [
  /\bsession-create\b/i,
  /\bapp-launch\b/i,
  /\bbundle-load\b/i,
  /\bgallery-ready\b/i,
  /\bMetro\b.*\b(failed|timeout|ECONNREFUSED)\b/i,
];

/**
 * Normalize free-text failure detail into a class token used inside signatures.
 * Strips volatile path/id noise so clustered failures share one signature.
 */
export function normalizeFailureDetail(detail: string | undefined): string {
  if (detail == null || detail.trim() === '') {
    return 'empty';
  }
  return detail
    .replace(/job_[a-f0-9]+/gi, 'job_*')
    .replace(/rcpt_[a-f0-9]+/gi, 'rcpt_*')
    .replace(/lease_[a-z0-9_]+/gi, 'lease_*')
    .replace(/\/(?:tmp|var|Users)\/[^\s:"']+/g, '<path>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b\d{4,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function classifyFailureDetail(detail: string | undefined): FailureClassification {
  const text = detail ?? '';
  if (AD_SERVICE_PATTERNS.some(pattern => pattern.test(text))) {
    return 'ad-service';
  }
  if (STARTUP_PATTERNS.some(pattern => pattern.test(text))) {
    return 'startup';
  }
  if (/\border|pollution|context|flaky|intermittent/i.test(text)) {
    return 'order-dependency';
  }
  if (/\bassert|expect|timeout waiting for|toHaveText|toBeDisplayed/i.test(text)) {
    return 'assertion';
  }
  return 'unknown';
}

/** Exact per-cell signature (includes caseId). */
export function failureSignature(input: {
  caseId: string;
  platform: 'android' | 'ios';
  classification: FailureClassification;
  detail?: string;
}): string {
  const payload = [
    input.classification,
    input.platform,
    input.caseId,
    normalizeFailureDetail(input.detail),
  ].join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

/** Correlated cluster key shared by the same failure class across cases. */
export function failureClusterKey(input: {
  platform: 'android' | 'ios';
  classification: FailureClassification;
  detail?: string;
}): string {
  const payload = [
    input.classification,
    input.platform,
    normalizeFailureDetail(input.detail),
  ].join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

export function createFailureArtifactId(entropy: () => string = randomUUID): string {
  return `fail_${entropy().replace(/-/g, '')}`;
}

export type BuildFailureArtifactInput = {
  caseId: string;
  platform: 'android' | 'ios';
  shardId?: string;
  jobId?: string;
  iteration?: number;
  logPath?: string;
  detail?: string;
  neighbors?: readonly string[];
  classification?: FailureClassification;
  recordedAt?: string;
  createArtifactId?: () => string;
};

export function buildFailureArtifact(input: BuildFailureArtifactInput): FailureArtifact {
  const classification = input.classification ?? classifyFailureDetail(input.detail);
  const signature = failureSignature({
    caseId: input.caseId,
    platform: input.platform,
    classification,
    detail: input.detail,
  });
  const clusterKey = failureClusterKey({
    platform: input.platform,
    classification,
    detail: input.detail,
  });
  return {
    artifactId: (input.createArtifactId ?? createFailureArtifactId)(),
    signature,
    clusterKey,
    caseId: input.caseId,
    platform: input.platform,
    ...(input.shardId != null ? { shardId: input.shardId } : {}),
    ...(input.jobId != null ? { jobId: input.jobId } : {}),
    ...(input.iteration != null ? { iteration: input.iteration } : {}),
    ...(input.logPath != null ? { logPath: input.logPath } : {}),
    ...(input.detail != null ? { detail: input.detail } : {}),
    classification,
    neighbors: input.neighbors ?? [],
    recordedAt: input.recordedAt ?? new Date().toISOString(),
  };
}

export type FailureArtifactStore = {
  root: string;
  write(artifact: FailureArtifact): string;
  read(artifactId: string): FailureArtifact;
  list(): FailureArtifact[];
  /** Artifacts sharing an exact per-cell signature. */
  findBySignature(signature: string): FailureArtifact[];
  /** Artifacts sharing a correlated service cluster key. */
  findByClusterKey(clusterKey: string): FailureArtifact[];
};

export function openFailureArtifactStore(root: string): FailureArtifactStore {
  mkdirSync(root, { recursive: true });

  function artifactPath(artifactId: string): string {
    return path.join(root, `${artifactId}.json`);
  }

  return {
    root,
    write(artifact) {
      const filePath = artifactPath(artifact.artifactId);
      writeFileSync(filePath, `${JSON.stringify(artifact, null, 2)}\n`);
      return filePath;
    },
    read(artifactId) {
      const raw = readFileSync(artifactPath(artifactId), 'utf8');
      return JSON.parse(raw) as FailureArtifact;
    },
    list() {
      const names = readdirSync(root).filter(name => name.endsWith('.json'));
      return names
        .map(name => JSON.parse(readFileSync(path.join(root, name), 'utf8')) as FailureArtifact)
        .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt));
    },
    findBySignature(signature) {
      return this.list().filter(artifact => artifact.signature === signature);
    },
    findByClusterKey(clusterKey) {
      return this.list().filter(artifact => artifact.clusterKey === clusterKey);
    },
  };
}
