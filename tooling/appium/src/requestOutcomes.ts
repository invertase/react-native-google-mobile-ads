import { AppiumTestIds } from './testIds.ts';

export const REQUEST_OUTCOME_LOADED = 'Request outcome: loaded';
export const REQUEST_OUTCOME_NO_FILL = 'Request outcome: no-fill';
export const REQUEST_OUTCOME_ERROR = 'Request error:';

export type RequestOutcome = 'pending' | 'loaded' | 'no-fill' | 'error';
export type RequestOutcomeClassification =
  | 'loaded'
  | 'no-fill'
  | 'internal-error'
  | 'other-error'
  /** Observe wait timed out while the marker was still pending; remountable. */
  | 'pending-timeout';

export type RequestFingerprint = {
  status: 'matched' | 'not-matched' | 'unavailable' | 'not-applicable';
  evidence: string;
};

/** Cell configuration for request-outcome logs (classic canary vs nextgen / iOS). */
export type RequestOutcomeConfiguration =
  | 'android-classic'
  | 'android-nextgen'
  | 'ios';

export type RequestOutcomeAttempt = {
  format: string;
  platform: 'android' | 'ios';
  /** Backend/cell label so classic vs nextgen exhaustions are obvious in CI logs. */
  configuration: RequestOutcomeConfiguration;
  attempt: number;
  requestId: number;
  classification: RequestOutcomeClassification;
  detail: string;
  fingerprint: RequestFingerprint;
  /** Backoff applied before this attempt (0 for attempt 1). */
  backoffMs: number;
  /** Wall time from collection start to this attempt's emit (includes backoff + observe). */
  elapsedMs: number;
  /** Official Google demo ad unit for the format when known (null when unmapped). */
  adUnitId: string | null;
  /**
   * Structured load/show failure token when known (`no-fill`, `internal-error`, …).
   * Null for accepted `loaded` attempts.
   */
  errorCode: string | null;
  /** True when attempt 2+ used the longer RECENT_NOFILL backoff schedule. */
  longerBackoff: boolean;
  /** Consecutive no-fill count immediately before this attempt (0 on attempt 1). */
  consecutiveNoFillBefore: number;
  /** True when the format's Google demo unit is inside the post-accept hot window. */
  sharedUnitHot: boolean;
  /** Age of the last accepted stamp for this unit, or null when never accepted. */
  acceptedAtAgeMs: number | null;
};

/**
 * Official Google demo units wired by RNGoogleMobileAdsExample for representative
 * formats. Kept here so exhausted attempt logs name the unit without parsing UI.
 */
const GOOGLE_TEST_AD_UNITS: Readonly<
  Record<string, Readonly<{ android: string; ios: string }>>
> = {
  // Representative Banner smoke size (`Banner`) → TestIds.BANNER.
  [AppiumTestIds.bannerVariant('Banner')]: {
    android: 'ca-app-pub-3940256099942544/6300978111',
    ios: 'ca-app-pub-3940256099942544/2934735716',
  },
  // Collapsible gallery screen → TestIds.ADAPTIVE_BANNER.
  [AppiumTestIds.format.collapsibleBanner]: {
    android: 'ca-app-pub-3940256099942544/9214589741',
    ios: 'ca-app-pub-3940256099942544/2435281174',
  },
  // Representative GAM banner smoke size → TestIds.GAM_BANNER.
  [AppiumTestIds.gamBannerVariant('AnchoredAdaptiveBanner')]: {
    android: '/21775744923/example/fixed-size-banner',
    ios: '/21775744923/example/fixed-size-banner',
  },
  [AppiumTestIds.format.rewarded]: {
    android: 'ca-app-pub-3940256099942544/5224354917',
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },
  [AppiumTestIds.format.rewardedHook]: {
    android: 'ca-app-pub-3940256099942544/5224354917',
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },
  [AppiumTestIds.format.rewardedInterstitial]: {
    android: 'ca-app-pub-3940256099942544/5354046379',
    ios: 'ca-app-pub-3940256099942544/6978759866',
  },
  [AppiumTestIds.format.rewardedInterstitialHook]: {
    android: 'ca-app-pub-3940256099942544/5354046379',
    ios: 'ca-app-pub-3940256099942544/6978759866',
  },
  [AppiumTestIds.format.interstitial]: {
    android: 'ca-app-pub-3940256099942544/1033173712',
    ios: 'ca-app-pub-3940256099942544/4411468910',
  },
  [AppiumTestIds.format.interstitialHook]: {
    android: 'ca-app-pub-3940256099942544/1033173712',
    ios: 'ca-app-pub-3940256099942544/4411468910',
  },
  [AppiumTestIds.format.appOpen]: {
    android: 'ca-app-pub-3940256099942544/9257395921',
    ios: 'ca-app-pub-3940256099942544/5575463023',
  },
  [AppiumTestIds.format.appOpenHook]: {
    android: 'ca-app-pub-3940256099942544/9257395921',
    ios: 'ca-app-pub-3940256099942544/5575463023',
  },
  [AppiumTestIds.format.native]: {
    android: 'ca-app-pub-3940256099942544/2247696110',
    ios: 'ca-app-pub-3940256099942544/3986624511',
  },
  [AppiumTestIds.format.gamInterstitial]: {
    android: '/21775744923/example/interstitial',
    ios: '/21775744923/example/interstitial',
  },
};

/** Resolve the example gallery Google demo ad unit for a format id, when known. */
export function googleTestAdUnitForFormat(
  formatId: string,
  platform: 'android' | 'ios',
): string | null {
  const entry = GOOGLE_TEST_AD_UNITS[formatId];
  if (!entry) {
    return null;
  }
  return entry[platform];
}

/**
 * Derive a stable error token for attempt logs. Prefer structured classification;
 * fall back to `Request error: <reason>:` prose from the gallery marker.
 */
export function errorCodeFromRequestAttempt(
  classification: RequestOutcomeClassification,
  detail: string,
): string | null {
  if (classification === 'loaded') {
    return null;
  }
  if (classification === 'no-fill') {
    return 'no-fill';
  }
  if (classification === 'internal-error') {
    return 'internal-error';
  }
  if (classification === 'pending-timeout') {
    return 'pending-timeout';
  }
  const match = /Request error:\s*([^:]+):/i.exec(detail);
  if (match?.[1]) {
    return match[1].trim();
  }
  return classification;
}

type ObservedRequestOutcome = Omit<
  RequestOutcomeAttempt,
  | 'format'
  | 'platform'
  | 'configuration'
  | 'attempt'
  | 'backoffMs'
  | 'elapsedMs'
  | 'adUnitId'
  | 'errorCode'
  | 'longerBackoff'
  | 'consecutiveNoFillBefore'
  | 'sharedUnitHot'
  | 'acceptedAtAgeMs'
>;

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
/**
 * After a format finishes its accepted path (including show-close when owned),
 * later formats that share the same Google demo unit (imperative → hook) treat
 * that unit as "hot" for this window. Sized for same-shard gaps (several
 * intervening show-close contracts), not just adjacent cases — inventory often
 * no-fills after a prior fill+show of the same unit in one WDIO session.
 */
export const SHARED_AD_UNIT_RECENT_MS = 10 * 60_000;
/** Cap on the pre-attempt-1 sleep when the format's ad unit is still hot. */
export const SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS = 15_000;
/** Retry backoff base while the shared unit is still hot (replaces 250 ms). */
export const REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS = 2_000;
/** Retry backoff cap while the shared unit is still hot (replaces 2000 ms). */
export const REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS = 8_000;
export const REQUEST_OUTCOME_LOG_PREFIX = '[request-outcome-attempt]';
export const REQUEST_OUTCOME_LOG_SHARED_COOLDOWN_PREFIX = '[request-outcome-shared-cooldown]';
export const REQUEST_OUTCOME_TIMEOUT_LOG_PREFIX = '[request-outcome-timeout]';
export const REQUEST_OUTCOME_GALLERY_REQUEST_DIAG_PREFIX = '[request-outcome-gallery-request]';

/** Session memory: adUnitId → wall clock of last accepted loaded outcome. */
const acceptedAdUnitAtMs = new Map<string, number>();

/** Test helper: clear shared-unit acceptance memory between cases. */
export function resetAcceptedAdUnitMemory(): void {
  acceptedAdUnitAtMs.clear();
}

/** Record that a Google demo unit just accepted (loaded) in this session. */
export function noteAcceptedAdUnit(adUnitId: string | null, nowMs: number = Date.now()): void {
  if (!adUnitId) {
    return;
  }
  acceptedAdUnitAtMs.set(adUnitId, nowMs);
}

/**
 * Remaining cool-down before the next format should request the same unit.
 * Zero when the unit was never accepted or the recent window has elapsed.
 */
export function sharedAdUnitCooldownRemainingMs(
  adUnitId: string | null,
  nowMs: number = Date.now(),
): number {
  if (!adUnitId) {
    return 0;
  }
  const acceptedAt = acceptedAdUnitAtMs.get(adUnitId);
  if (acceptedAt === undefined) {
    return 0;
  }
  const elapsed = nowMs - acceptedAt;
  if (elapsed < 0 || elapsed >= SHARED_AD_UNIT_RECENT_MS) {
    return 0;
  }
  return Math.min(SHARED_AD_UNIT_RECENT_MS - elapsed, SHARED_AD_UNIT_PRE_FORMAT_COOLDOWN_MS);
}

/** True while the unit is still inside the post-accept "hot" window. */
export function isRecentlyAcceptedAdUnit(
  adUnitId: string | null,
  nowMs: number = Date.now(),
): boolean {
  if (!adUnitId) {
    return false;
  }
  const acceptedAt = acceptedAdUnitAtMs.get(adUnitId);
  if (acceptedAt === undefined) {
    return false;
  }
  const elapsed = nowMs - acceptedAt;
  return elapsed >= 0 && elapsed < SHARED_AD_UNIT_RECENT_MS;
}

/**
 * Milliseconds since this unit was last accepted in-session, or null when never
 * stamped / unknown. Does not apply the hot-window cutoff (age can exceed
 * `SHARED_AD_UNIT_RECENT_MS`).
 */
export function acceptedAdUnitAgeMs(
  adUnitId: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!adUnitId) {
    return null;
  }
  const acceptedAt = acceptedAdUnitAtMs.get(adUnitId);
  if (acceptedAt === undefined) {
    return null;
  }
  const elapsed = nowMs - acceptedAt;
  if (elapsed < 0) {
    return null;
  }
  return elapsed;
}

export type RequestOutcomeTimeoutLog = {
  format: string;
  requestId: number | null;
  lastSeen: string;
  elapsedMs: number;
  /** Ads/React native log tail when available (Android logcat or iOS simctl). */
  adsLogSnippet?: string;
};

/**
 * Map platform + `RNGMA_ANDROID_BACKEND` to the same classic/nextgen/ios cell
 * labels used by reliability configuration (unset Android backend → classic).
 */
export function requestOutcomeConfiguration(
  platform: 'android' | 'ios',
  env: NodeJS.ProcessEnv = process.env,
): RequestOutcomeConfiguration {
  if (platform === 'ios') {
    return 'ios';
  }
  const raw = (env.RNGMA_ANDROID_BACKEND ?? 'classic').trim().toLowerCase();
  if (raw === 'nextgen') {
    return 'android-nextgen';
  }
  if (raw === 'classic' || raw === 'legacy' || raw === '') {
    return 'android-classic';
  }
  throw new Error(
    `RNGMA_ANDROID_BACKEND must be classic, legacy, or nextgen; received "${env.RNGMA_ANDROID_BACKEND}".`,
  );
}

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

/**
 * Build waitUntil failure text with the live `lastSeen` (must not be eagerly
 * interpolated into a timeoutMsg string before waitUntil runs).
 */
export function formatRepresentativeRequestTimeoutMsg(options: {
  testId: string;
  attempt: number;
  lastSeen: string;
}): string {
  return `testID ${options.testId} did not report terminal request attempt ${options.attempt} (lastSeen=${JSON.stringify(options.lastSeen)})`;
}

/** Placeholder lastSeen baked into waitUntil timeoutMsg (eager interpolation). */
export const REPRESENTATIVE_REQUEST_TIMEOUT_LAST_SEEN_DEFERRED = '<deferred>';

/**
 * True only for the WDIO waitUntil timeout path (deferred lastSeen timeoutMsg).
 * Condition throws (marker disappearance) and post-wait hard-fails must not match.
 */
export function isRepresentativeRequestWaitTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('did not report terminal request attempt') &&
    message.includes(
      `lastSeen=${JSON.stringify(REPRESENTATIVE_REQUEST_TIMEOUT_LAST_SEEN_DEFERRED)}`,
    )
  );
}

export function formatRequestOutcomeTimeout(payload: RequestOutcomeTimeoutLog): string {
  return `${REQUEST_OUTCOME_TIMEOUT_LOG_PREFIX} ${JSON.stringify(payload)}`;
}

/** Cap filtered logcat so CI lines stay readable. */
export function truncateLogSnippet(log: string, maxChars = 2000): string {
  if (log.length <= maxChars) {
    return log;
  }
  return log.slice(-maxChars);
}

/**
 * True when Ads / ReactNativeJS logs contain a terminal `[gallery-request]` for
 * `requestId` (`onAdLoaded` or `onAdFailedToLoad`). Mount-only lines do not count.
 */
export function hasTerminalGalleryRequestForId(log: string, requestId: number): boolean {
  for (const line of log.split(/\r?\n/)) {
    if (!line.includes('[gallery-request]')) {
      continue;
    }
    if (!line.includes(`"requestId":${requestId}`)) {
      continue;
    }
    if (
      line.includes('"event":"onAdLoaded"') ||
      line.includes('"event":"onAdFailedToLoad"')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * One-line diagnostic when a hard-fail pending timeout cannot correlate a
 * terminal gallery-request for the observed requestId. Returns undefined when
 * correlation succeeds or `requestId` is unknown.
 */
export function formatMissingGalleryRequestTerminalDiagnostic(options: {
  requestId: number | null;
  adsLogSnippet: string | undefined;
}): string | undefined {
  if (options.requestId == null) {
    return undefined;
  }
  if (hasTerminalGalleryRequestForId(options.adsLogSnippet ?? '', options.requestId)) {
    return undefined;
  }
  return `${REQUEST_OUTCOME_GALLERY_REQUEST_DIAG_PREFIX} requestId=${options.requestId} no terminal gallery-request`;
}

/**
 * When a true observe waitUntil timeout leaves a still-pending marker and the
 * contract uses remount retries, return `pending-timeout` so collection can
 * remount instead of aborting. Callers must gate with
 * `isRepresentativeRequestWaitTimeout` first — marker disappearance, fingerprint
 * failures, and other non-timeout throws must hard-fail.
 */
export function pendingTimeoutClassification(options: {
  lastSeen: string;
  retry: RepresentativeRequestRetry;
}): RequestOutcomeClassification | undefined {
  if (options.retry !== 'remount') {
    return undefined;
  }
  if (requestOutcomeFromText(options.lastSeen) !== 'pending') {
    return undefined;
  }
  if (!options.lastSeen.includes('Request outcome: pending')) {
    return undefined;
  }
  if (requestIdFromText(options.lastSeen) === undefined) {
    return undefined;
  }
  return 'pending-timeout';
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

/**
 * After a waitUntil timeout, the marker may already show a terminal outcome
 * (slow load race). Prefer accepting that re-read over throwing a contradictory
 * timeout that still embeds `loaded` / `no-fill` in lastSeen.
 */
export function terminalOutcomeFromMarkerText(
  lastSeen: string,
  attempt: number,
):
  | {
      requestId: number;
      classification: RequestOutcomeClassification;
      detail: string;
    }
  | undefined {
  if (!lastSeen.includes(`Request attempt: ${attempt};`)) {
    return undefined;
  }
  const classification = classifyRequestOutcome(lastSeen);
  const requestId = requestIdFromText(lastSeen);
  if (classification === undefined || requestId === undefined) {
    return undefined;
  }
  return { requestId, classification, detail: lastSeen };
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

/**
 * Delay before a retry (attempt 2+), capped to keep the device suite bounded.
 * When `recentSameUnit` is set, use the longer no-fill schedule for shared demo
 * units that recently accepted in this session (imperative → hook reuse).
 */
export function representativeRequestBackoffMs(
  attempt: number,
  options?: { recentSameUnit?: boolean },
): number {
  if (attempt <= 1) {
    return 0;
  }
  const base = options?.recentSameUnit
    ? REPRESENTATIVE_REQUEST_RECENT_NOFILL_BASE_BACKOFF_MS
    : REPRESENTATIVE_REQUEST_BASE_BACKOFF_MS;
  const max = options?.recentSameUnit
    ? REPRESENTATIVE_REQUEST_RECENT_NOFILL_MAX_BACKOFF_MS
    : REPRESENTATIVE_REQUEST_MAX_BACKOFF_MS;
  return Math.min(base * 2 ** (attempt - 2), max);
}

export function formatRequestOutcomeAttempt(attempt: RequestOutcomeAttempt): string {
  return `${REQUEST_OUTCOME_LOG_PREFIX} ${JSON.stringify(attempt)}`;
}

export async function collectRepresentativeRequestOutcomes(options: {
  format: string;
  platform: 'android' | 'ios';
  configuration?: RequestOutcomeConfiguration;
  request: (attempt: number) => Promise<ObservedRequestOutcome>;
  sleep?: (delayMs: number) => Promise<void>;
  emit?: (line: string) => void;
  now?: () => number;
  maxAttempts?: number;
  evaluateAcceptance: (attempt: RequestOutcomeAttempt) => RepresentativeRequestAcceptance;
}): Promise<readonly RequestOutcomeAttempt[]> {
  const {
    format,
    platform,
    configuration = requestOutcomeConfiguration(platform),
    request,
    sleep = delayMs => new Promise(resolve => setTimeout(resolve, delayMs)),
    emit = console.log,
    now = () => Date.now(),
    maxAttempts = REPRESENTATIVE_REQUEST_MAX_ATTEMPTS,
    evaluateAcceptance,
  } = options;
  const attempts: RequestOutcomeAttempt[] = [];
  const requestIds = new Set<number>();
  let previousRequestId = 0;
  let consecutiveNoFill = 0;
  const startedAt = now();
  const adUnitId = googleTestAdUnitForFormat(format, platform);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const nowMs = now();
    const sharedUnitHot = isRecentlyAcceptedAdUnit(adUnitId, nowMs);
    const consecutiveNoFillBefore = consecutiveNoFill;
    const longerBackoff =
      attempt > 1 && (sharedUnitHot || consecutiveNoFillBefore >= 1);
    let delayMs = representativeRequestBackoffMs(attempt, {
      recentSameUnit: longerBackoff,
    });
    if (attempt === 1) {
      const cooldownMs = sharedAdUnitCooldownRemainingMs(adUnitId, nowMs);
      if (cooldownMs > 0) {
        delayMs = Math.max(delayMs, cooldownMs);
        emit(
          `${REQUEST_OUTCOME_LOG_SHARED_COOLDOWN_PREFIX} ${JSON.stringify({
            format,
            platform,
            configuration,
            adUnitId,
            cooldownMs,
          })}`,
        );
      }
    }
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
    const result: RequestOutcomeAttempt = {
      format,
      platform,
      configuration,
      attempt,
      ...observed,
      backoffMs: delayMs,
      elapsedMs: Math.max(0, now() - startedAt),
      adUnitId,
      errorCode: errorCodeFromRequestAttempt(observed.classification, observed.detail),
      longerBackoff,
      consecutiveNoFillBefore,
      sharedUnitHot,
      acceptedAtAgeMs: acceptedAdUnitAgeMs(adUnitId, nowMs),
    };
    attempts.push(result);
    emit(formatRequestOutcomeAttempt(result));
    if (observed.classification === 'no-fill') {
      consecutiveNoFill += 1;
    } else {
      consecutiveNoFill = 0;
    }
    if (evaluateAcceptance(result).status === 'accepted') {
      return attempts;
    }
  }

  const diagnostic = attempts.map(
    ({
      attempt,
      requestId,
      classification,
      fingerprint,
      backoffMs,
      elapsedMs,
      adUnitId,
      errorCode,
      longerBackoff,
      consecutiveNoFillBefore,
      sharedUnitHot,
      acceptedAtAgeMs,
    }) => ({
      attempt,
      requestId,
      classification,
      fingerprint,
      backoffMs,
      elapsedMs,
      adUnitId,
      errorCode,
      longerBackoff,
      consecutiveNoFillBefore,
      sharedUnitHot,
      acceptedAtAgeMs,
    }),
  );
  throw new Error(
    `[request-outcome] ${format}/${platform}/${configuration}: exhausted ${maxAttempts} attempts without acceptance; attempts=${JSON.stringify(diagnostic)}`,
  );
}

export type RepresentativeRequestRuntime = {
  navigate: () => Promise<void>;
  backToGallery: () => Promise<void>;
  clearNativeLogs: () => Promise<void>;
  reload: () => Promise<void>;
  load: () => Promise<void>;
  observe: (uiAttempt: number) => Promise<ObservedRequestOutcome>;
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
  /** Override cell configuration (defaults from platform + `RNGMA_ANDROID_BACKEND`). */
  configuration?: RequestOutcomeConfiguration;
  runtime: RepresentativeRequestRuntime;
  sleep?: (delayMs: number) => Promise<void>;
  emit?: (line: string) => void;
  now?: () => number;
  maxAttempts?: number;
  onAccepted?: (attempt: RequestOutcomeAttempt) => Promise<void>;
}): Promise<readonly RequestOutcomeAttempt[]> {
  const {
    format,
    platform,
    path,
    retry = 'default',
    hookAutoLoad = false,
    configuration = requestOutcomeConfiguration(platform),
    runtime,
    sleep,
    emit,
    now,
    maxAttempts,
    onAccepted,
  } = options;
  const attempts = await collectRepresentativeRequestOutcomes({
    format,
    platform,
    configuration,
    sleep,
    emit,
    now,
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
        // Remount recreates auto-load surfaces (banner / GAM remount / hookAutoLoad)
        // with a fresh in-flight request. Explicit-Load surfaces (fullscreen App
        // Open singleton, hook screens with a Load control) must tap Load after
        // remount or the marker stays on attempt 0 while a stale singleton fires.
        if (representativeRequestOperation(path, 1, retry, hookAutoLoad) === 'load') {
          await runtime.load();
        }
        // Remount recreates representative markers with Request attempt: 1.
        // Hook Status markers have no monotonic Request id — synthesize from the
        // collection attempt so remount retries do not reuse requestId 1.
        if (path === 'hook') {
          return runtime.observe(attempt);
        }
        return runtime.observe(1);
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
  // Stamp after show-close (when owned) so the hot window covers later shared-unit formats.
  noteAcceptedAdUnit(attempts.at(-1)!.adUnitId, (now ?? Date.now)());
  await runtime.backToGallery();
  return attempts;
}
