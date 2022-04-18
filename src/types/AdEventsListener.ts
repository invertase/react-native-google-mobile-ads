import { AdEventType } from '../AdEventType';
import { RewardedAdEventType } from '../RewardedAdEventType';
import { AdEventPayload } from './AdEventListener';

export type AdEventsListener<T extends AdEventType | RewardedAdEventType = never> = (eventInfo: {
  type: T;
  payload: AdEventPayload<T>;
}) => void;
