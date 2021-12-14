import { AdEventType } from './AdEventType';
import { RewardedAdEventType } from './RewardedAdEventType';

export type AdEventTypes =
  | AdEventType['LOADED']
  | AdEventType['ERROR']
  | AdEventType['OPENED']
  | AdEventType['CLICKED']
  | AdEventType['CLOSED']
  | RewardedAdEventType['LOADED']
  | RewardedAdEventType['EARNED_REWARD'];
