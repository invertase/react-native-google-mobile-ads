export const REQUEST_OUTCOME_LOADED = 'Request outcome: loaded';
export const REQUEST_OUTCOME_NO_FILL = 'Request outcome: no-fill';
export const REQUEST_OUTCOME_ERROR = 'Request error:';

export type RequestOutcome = 'pending' | 'loaded' | 'no-fill' | 'error';
export type RequestOutcomeClassification =
  | 'loaded'
  | 'no-fill'
  | 'internal-error'
  | 'other-error';

export type RequestFingerprint = {
  status: 'matched' | 'not-matched' | 'unavailable' | 'not-applicable';
  evidence: string;
};

export type RequestOutcomeAttempt = {
  format: string;
  platform: 'android' | 'ios';
  attempt: number;
  requestId: number;
  classification: RequestOutcomeClassification;
  detail: string;
  fingerprint: RequestFingerprint;
};

export type RepresentativeRequestPath =
  | 'banner'
  | 'native'
  | 'fullscreen'
  | 'gam'
  | 'hook'
  | 'pool'
  | 'multi-format';
export type RepresentativeRequestAcceptance = {
  status: 'accepted' | 'retry';
  reason: 'loaded' | 'android-native-matched-fingerprint' | 'outcome-not-accepted';
};

export function hasNonzeroRectangle(rect: { width: number; height: number }): boolean {
  return rect.width > 0 && rect.height > 0;
}

export const REPRESENTATIVE_REQUEST_MAX_ATTEMPTS = 10;
export const REPRESENTATIVE_REQUEST_BASE_BACKOFF_MS = 250;
export const REPRESENTATIVE_REQUEST_MAX_BACKOFF_MS = 2000;
export const REQUEST_OUTCOME_LOG_PREFIX = '[request-outcome-attempt]';

export function requestOutcomeFromText(text: string): RequestOutcome {
  if (text.includes(REQUEST_OUTCOME_LOADED)) {
    return 'loaded';
  }
  if (text.includes(REQUEST_OUTCOME_NO_FILL)) {
    return 'no-fill';
  }
  if (text.includes(REQUEST_OUTCOME_ERROR)) {
    return 'error';
  }
  return 'pending';
}

export function classifyRequestOutcome(
  text: string,
): RequestOutcomeClassification | undefined {
  const outcome = requestOutcomeFromText(text);
  if (outcome === 'loaded' || outcome === 'no-fill') {
    return outcome;
  }
  if (outcome === 'error') {
    return text.includes('Request error: internal-error') ? 'internal-error' : 'other-error';
  }
  return undefined;
}

/** Terminal hook load markers use `Status: …` on the hook status testID. */
/** Terminal pooled-ad markers use `pooledStatus=` on the pool loaded testID. */
export function classifyPoolFilledOutcome(
  text: string,
): RequestOutcomeClassification | undefined {
  if (/\bpooledStatus=filled\b/.test(text)) {
    return 'loaded';
  }
  if (/\bpooledStatus=no-fill\b/.test(text)) {
    return 'no-fill';
  }
  if (/\bpooledStatus=error\b/.test(text)) {
    return 'other-error';
  }
  return undefined;
}

export function classifyPoolStructuredUnsupportedGate(
  text: string,
  gate: 'peek' | 'rwi-preload',
): RequestOutcomeClassification | undefined {
  if (gate === 'peek') {
    if (/\bpeek=structured-unsupported reason=pool\/peek-unsupported\b/.test(text)) {
      return 'loaded';
    }
    if (/\bpeek=ok\b/.test(text)) {
      return 'loaded';
    }
    if (/\bpeek=error\b/.test(text)) {
      return 'other-error';
    }
  }
  if (gate === 'rwi-preload') {
    if (/\brwi=structured-unsupported reason=pool\/format-preload-unsupported\b/.test(text)) {
      return 'loaded';
    }
    if (/\brwi=created\b/.test(text)) {
      return 'loaded';
    }
    if (/\brwi=error\b/.test(text)) {
      return 'other-error';
    }
  }
  return undefined;
}

export function classifyHookLoadOutcome(
  text: string,
): RequestOutcomeClassification | undefined {
  if (/\bStatus:\s*loaded\b/.test(text)) {
    return 'loaded';
  }
  if (/\bStatus:\s*no-fill\b/.test(text)) {
    return 'no-fill';
  }
  if (/\bStatus:\s*error\b/.test(text)) {
    return 'other-error';
  }
  return undefined;
}

export function requestIdFromText(text: string): number | undefined {
  const match = text.match(/Request id: (\d+);/);
  return match ? Number(match[1]) : undefined;
}

const NATIVE_RESPONSE_SIGNATURE =
  '<Google:HTML> Incorrect native ad response. Click actions were not properly specified';
const NATIVE_RESPONSE_LOG_MESSAGE = `Received log message: ${NATIVE_RESPONSE_SIGNATURE}`;
const GMA_LOAD_FAILURE_ZERO = 'Ad failed to load : 0';
const MAX_NATIVE_FINGERPRINT_GAP_MS = 250;

type AndroidLogLine = {
  timestampMs: number;
  processId: number;
  tag: string;
  message: string;
};

function parseAndroidThreadtimeLine(line: string): AndroidLogLine | undefined {
  const match = line.match(
    /^(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+(\d+)\s+\d+\s+[VDIWEF]\s+(\S+)\s*:\s(.*)$/,
  );
  if (!match) {
    return undefined;
  }
  const [, month, day, hour, minute, second, millisecond, processId, tag, message] =
    match;
  return {
    timestampMs: Date.UTC(
      2000,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millisecond),
    ),
    processId: Number(processId),
    tag,
    message,
  };
}

export function nativeFingerprintFromAndroidLog(log: string): RequestFingerprint {
  const rawLines = log.split(/\r?\n/);
  if (rawLines.at(-1) === '') {
    rawLines.pop();
  }
  const chronologicalLines = rawLines.map(parseAndroidThreadtimeLine);
  const signatureIndexes = chronologicalLines.flatMap((line, index) =>
    line?.tag === 'Ads' && line.message === NATIVE_RESPONSE_LOG_MESSAGE ? [index] : [],
  );
  if (signatureIndexes.length === 0) {
    return {
      status: 'not-matched',
      evidence: 'android-logcat-request-window:no-known-native-response-signature',
    };
  }
  const signatureIndex = signatureIndexes.at(-1)!;
  const signature = chronologicalLines[signatureIndex]!;
  const failure = chronologicalLines[signatureIndex + 1];
  if (
    !failure ||
    failure.tag !== 'Ads' ||
    failure.message !== GMA_LOAD_FAILURE_ZERO ||
    failure.processId !== signature.processId ||
    failure.timestampMs < signature.timestampMs ||
    failure.timestampMs - signature.timestampMs > MAX_NATIVE_FINGERPRINT_GAP_MS
  ) {
    return {
      status: 'not-matched',
      evidence: 'android-logcat-request-window:signature-without-gma-error-0',
    };
  }
  return {
    status: 'matched',
    evidence:
      'android-logcat-request-window:<Google:HTML> Incorrect native ad response. Click actions were not properly specified + GMA error 0',
  };
}

export type RepresentativeRequestRetry = 'default' | 'remount';

export type RepresentativeRequestOperation = 'auto-load' | 'reload' | 'remount' | 'load';

/**
 * Final representative-session acceptance policy.
 *
 * Every format/platform accepts loaded. The only degradation allowance is the
 * request-scoped matched Android Native malformed-creative fingerprint.
 */
export function evaluateRepresentativeRequestAttempt(options: {
  path: RepresentativeRequestPath;
  platform: 'android' | 'ios';
  attempt: Pick<RequestOutcomeAttempt, 'classification' | 'fingerprint'>;
}): RepresentativeRequestAcceptance {
  const { path, platform, attempt } = options;
  if (attempt.classification === 'loaded') {
    return { status: 'accepted', reason: 'loaded' };
  }
  if (
    (path === 'native' || path === 'multi-format') &&
    platform === 'android' &&
    attempt.classification === 'internal-error' &&
    attempt.fingerprint.status === 'matched'
  ) {
    return { status: 'accepted', reason: 'android-native-matched-fingerprint' };
  }
  return { status: 'retry', reason: 'outcome-not-accepted' };
}

export function representativeRequestOperation(
  path: RepresentativeRequestPath,
  attempt: number,
  retry: RepresentativeRequestRetry = 'default',
  hookAutoLoad = false,
): RepresentativeRequestOperation {
  if (attempt < 1) {
    throw new Error(`Request attempt must be positive, received ${attempt}`);
  }
  if (retry === 'remount' && attempt > 1) {
    return 'remount';
  }
  if (path === 'banner') {
    return attempt === 1 ? 'auto-load' : 'reload';
  }
  if (path === 'gam' && retry === 'remount') {
    return attempt === 1 ? 'auto-load' : 'remount';
  }
  if (path === 'native') {
    return attempt === 1 ? 'auto-load' : 'remount';
  }
  if (path === 'hook') {
    if (hookAutoLoad) {
      return attempt === 1 ? 'auto-load' : 'remount';
    }
    return 'load';
  }
  if (path === 'multi-format') {
    if (hookAutoLoad) {
      return attempt === 1 ? 'auto-load' : 'remount';
    }
    return 'load';
  }
  return 'load';
}

export async function executeRepresentativeRequestOperation(
  path: RepresentativeRequestPath,
  attempt: number,
  operations: {
    reload: () => Promise<void>;
    remount: () => Promise<void>;
    load: () => Promise<void>;
  },
  retry: RepresentativeRequestRetry = 'default',
): Promise<RepresentativeRequestOperation> {
  const operation = representativeRequestOperation(path, attempt, retry);
  if (operation !== 'auto-load') {
    await operations[operation]();
  }
  return operation;
}

/** Delay before a retry (attempt 2+), capped to keep the device suite bounded. */
export function representativeRequestBackoffMs(attempt: number): number {
  if (attempt <= 1) {
    return 0;
  }
  return Math.min(
    REPRESENTATIVE_REQUEST_BASE_BACKOFF_MS * 2 ** (attempt - 2),
    REPRESENTATIVE_REQUEST_MAX_BACKOFF_MS,
  );
}

export function formatRequestOutcomeAttempt(attempt: RequestOutcomeAttempt): string {
  return `${REQUEST_OUTCOME_LOG_PREFIX} ${JSON.stringify(attempt)}`;
}

export async function collectRepresentativeRequestOutcomes(options: {
  format: string;
  platform: 'android' | 'ios';
  request: (attempt: number) => Promise<Omit<RequestOutcomeAttempt, 'format' | 'platform' | 'attempt'>>;
  sleep?: (delayMs: number) => Promise<void>;
  emit?: (line: string) => void;
  maxAttempts?: number;
  evaluateAcceptance: (attempt: RequestOutcomeAttempt) => RepresentativeRequestAcceptance;
}): Promise<readonly RequestOutcomeAttempt[]> {
  const {
    format,
    platform,
    request,
    sleep = delayMs => new Promise(resolve => setTimeout(resolve, delayMs)),
    emit = console.log,
    maxAttempts = REPRESENTATIVE_REQUEST_MAX_ATTEMPTS,
    evaluateAcceptance,
  } = options;
  const attempts: RequestOutcomeAttempt[] = [];
  const requestIds = new Set<number>();
  let previousRequestId = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const delayMs = representativeRequestBackoffMs(attempt);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
    const observed = await request(attempt);
    if (!Number.isSafeInteger(observed.requestId) || observed.requestId <= 0) {
      throw new Error(
        `[request-outcome] ${format}: attempt ${attempt} did not report a valid request id`,
      );
    }
    if (requestIds.has(observed.requestId)) {
      throw new Error(
        `[request-outcome] ${format}: attempt ${attempt} reused request id ${observed.requestId}`,
      );
    }
    if (observed.requestId <= previousRequestId) {
      throw new Error(
        `[request-outcome] ${format}: attempt ${attempt} request id ${observed.requestId} was not greater than ${previousRequestId}`,
      );
    }
    requestIds.add(observed.requestId);
    previousRequestId = observed.requestId;
    const result = { format, platform, attempt, ...observed };
    attempts.push(result);
    emit(formatRequestOutcomeAttempt(result));
    if (evaluateAcceptance(result).status === 'accepted') {
      return attempts;
    }
  }

  const diagnostic = attempts.map(({ attempt, requestId, classification, fingerprint }) => ({
    attempt,
    requestId,
    classification,
    fingerprint,
  }));
  throw new Error(
    `[request-outcome] ${format}/${platform}: exhausted ${maxAttempts} attempts without acceptance; attempts=${JSON.stringify(diagnostic)}`,
  );
}

export type RepresentativeRequestRuntime = {
  navigate: () => Promise<void>;
  backToGallery: () => Promise<void>;
  clearNativeLogs: () => Promise<void>;
  reload: () => Promise<void>;
  load: () => Promise<void>;
  observe: (
    uiAttempt: number,
  ) => Promise<Omit<RequestOutcomeAttempt, 'format' | 'platform' | 'attempt'>>;
};

/**
 * Runtime orchestration for representative request collection.
 * Every dependency failure propagates directly; instrumentation recovery is intentionally absent.
 */
export async function runRepresentativeRequestOutcomeContract(options: {
  format: string;
  platform: 'android' | 'ios';
  path: RepresentativeRequestPath;
  retry?: RepresentativeRequestRetry;
  /** Hook screens that auto-load on mount (no explicit Load control). */
  hookAutoLoad?: boolean;
  runtime: RepresentativeRequestRuntime;
  sleep?: (delayMs: number) => Promise<void>;
  emit?: (line: string) => void;
  maxAttempts?: number;
  onAccepted?: (attempt: RequestOutcomeAttempt) => Promise<void>;
}): Promise<readonly RequestOutcomeAttempt[]> {
  const {
    format,
    platform,
    path,
    retry = 'default',
    hookAutoLoad = false,
    runtime,
    sleep,
    emit,
    maxAttempts,
    onAccepted,
  } = options;
  const attempts = await collectRepresentativeRequestOutcomes({
    format,
    platform,
    sleep,
    emit,
    maxAttempts,
    evaluateAcceptance: attempt =>
      evaluateRepresentativeRequestAttempt({ path, platform, attempt }),
    request: async attempt => {
      if (path === 'native') {
        if (attempt > 1) {
          await runtime.backToGallery();
        }
        await runtime.clearNativeLogs();
        await runtime.navigate();
        return runtime.observe(1);
      }

      const operation = representativeRequestOperation(path, attempt, retry, hookAutoLoad);
      if (attempt === 1) {
        await runtime.navigate();
        if (operation === 'load') {
          await runtime.load();
        }
      } else if (operation === 'remount') {
        await runtime.backToGallery();
        await runtime.navigate();
      } else {
        await executeRepresentativeRequestOperation(
          path,
          attempt,
          {
            reload: runtime.reload,
            remount: async () => {
              throw new Error('Remounts are handled by the request runtime');
            },
            load: runtime.load,
          },
          retry,
        );
      }
      return runtime.observe(attempt);
    },
  });
  if (onAccepted) {
    await onAccepted(attempts.at(-1)!);
  }
  await runtime.backToGallery();
  return attempts;
}
