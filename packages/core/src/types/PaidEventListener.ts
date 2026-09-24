import { RevenuePrecisions } from '../common/constants';
import type { PaidResponseInfo } from './ResponseInfo';

/**
 * Impression-level revenue snapshot.
 *
 * Prefer `valueMicros` when present rather than deriving micros from the
 * floating-point `value`. `responseInfo` intentionally omits the complete
 * waterfall to keep high-frequency paid-event payloads compact; use the
 * loaded adapter and response id for correlation.
 *
 * @example
 * ```ts
 * ad.addAdEventListener(AdEventType.PAID, paid => {
 *   analytics.logRevenue({
 *     currency: paid.currency,
 *     value: paid.value,
 *     valueMicros: paid.valueMicros,
 *     responseId: paid.responseInfo?.responseId,
 *     adapter: paid.responseInfo?.loadedAdapterResponse?.adSourceName,
 *   });
 * });
 * ```
 */
export type PaidEvent = {
  currency: string;
  precision: RevenuePrecisions;
  value: number;
  /** Compact waterfall snapshot for this paid event. */
  responseInfo?: PaidResponseInfo;
  /**
   * Exact micros as a decimal string. Null when the backend cannot supply exactness.
   * Prefer this over deriving micros from `value` in JS.
   */
  valueMicros?: string | null;
};

export type PaidEventListener = (event: PaidEvent) => void;
