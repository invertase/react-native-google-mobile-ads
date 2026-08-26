import { RevenuePrecisions } from '../common/constants';
import type { PaidResponseInfo } from './ResponseInfo';

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
