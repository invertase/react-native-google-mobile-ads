import { AdEventType } from '../AdEventType';
import { RewardedAdReward } from './RewardedAdReward';
import { RewardedAdEventType } from '../RewardedAdEventType';

/**
 * A callback interface for all ad events.
 *
 * @param type The event type, e.g. `AdEventType.LOADED`.
 * @param error An optional JavaScript Error containing the error code and message.
 * @param data Optional data for the event, e.g. reward type and amount
 */
export type AdEventListener = (
  type: AdEventType | RewardedAdEventType,
  error?: Error,
  data?: RewardedAdReward,
) => void;
