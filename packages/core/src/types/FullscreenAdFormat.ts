import type { AdFormat } from './AdFormat';

export type FullscreenAdFormat =
  | AdFormat.APP_OPEN
  | AdFormat.INTERSTITIAL
  | AdFormat.REWARDED
  | AdFormat.REWARDED_INTERSTITIAL;
