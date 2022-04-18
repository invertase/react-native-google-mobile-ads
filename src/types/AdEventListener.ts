import { AdEventType } from '../AdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { RewardedAdReward } from './RewardedAdReward';

export type AdEventPayload<T extends AdEventType | RewardedAdEventType = never> =
  T extends AdEventType.ERROR
    ? Error
    : T extends RewardedAdEventType
    ? RewardedAdReward
    : undefined;

export type AdEventListener<T extends AdEventType | RewardedAdEventType = never> = (
  payload: AdEventPayload<T>,
) => void;
