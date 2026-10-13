/**
 * Device-free helpers for rewarded / paid / manual-impression Appium markers.
 * Official Google test units must report earned=true after show-close; paid-event
 * and manual-impression markers stay diagnostic (absence never fails).
 */

export const EARNED_TRUE_MARKER = 'earned=true';
export const PAID_MARKER_RE = /\bpaid=(\d+)\b/;
export const MANUAL_IMPRESSION_RECORDED_MARKER = 'recorded=true';
export const MANUAL_IMPRESSION_CALLBACK_MARKER = 'callback=true';

/** True when the gallery lifecycle marker reports an earned reward. */
export function lifecycleReportsEarnedReward(lifecycleText: string): boolean {
  return lifecycleText.includes(EARNED_TRUE_MARKER);
}

/** Parsed paid-event counter from a lifecycle marker, or undefined when absent. */
export function paidEventCountFromLifecycle(lifecycleText: string): number | undefined {
  const match = PAID_MARKER_RE.exec(lifecycleText);
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

/**
 * Blocking Appium success check for official rewarded / rewarded-interstitial
 * test-unit flows. Throws when earned=true is missing.
 */
export function assertEarnedRewardLifecycleText(formatId: string, lifecycleText: string): void {
  if (!lifecycleReportsEarnedReward(lifecycleText)) {
    throw new Error(
      `[earned-reward-proof] ${formatId}: missing ${EARNED_TRUE_MARKER} (lifecycle=${JSON.stringify(lifecycleText)})`,
    );
  }
}

/** Non-blocking paid-event canary payload for log evidence only. */
export function paidEventCanaryFromLifecycle(
  formatId: string,
  platform: 'android' | 'ios',
  lifecycleText: string,
): {
  format: string;
  platform: 'android' | 'ios';
  paid: number | 'absent';
  blocking: false;
} {
  const paid = paidEventCountFromLifecycle(lifecycleText);
  return {
    format: formatId,
    platform,
    paid: paid === undefined ? 'absent' : paid,
    blocking: false,
  };
}

/** Non-blocking manual-impression canary payload (no server-reporting claim). */
export function manualImpressionCanaryFromText(
  formatId: string,
  platform: 'android' | 'ios',
  lifecycleText: string,
): {
  format: string;
  platform: 'android' | 'ios';
  recorded: boolean;
  callback: boolean;
  blocking: false;
} {
  return {
    format: formatId,
    platform,
    recorded: lifecycleText.includes(MANUAL_IMPRESSION_RECORDED_MARKER),
    callback: lifecycleText.includes(MANUAL_IMPRESSION_CALLBACK_MARKER),
    blocking: false,
  };
}
