import { AdEventTypes } from './AdEventTypes';
import { RewardedAdReward } from './RewardedAdReward';

/**
 * A callback interface for all ad events.
 *
 * @param type The event type, e.g. `AdEventType.LOADED`.
 * @param error An optional JavaScript Error containing the error code and message.
 * @param data Optional data for the event, e.g. reward type and amount
 */
export type AdEventListener = (
  type: AdEventTypes,
  error?: Error,
  data?: any | RewardedAdReward,
) => void;
