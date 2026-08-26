import { BannerAdSize } from '../BannerAdSize';

/**
 * Fixed GAM sizes safe in an AdLoader request; adaptive/fluid are not.
 *
 * Custom sizes may be a `"WxH"` string or `{ width, height }`.
 * `WIDE_SKYSCRAPER` is mediation-only, not served by the Google Mobile Ads network.
 */
export type MultiFormatBannerSize =
  | BannerAdSize.BANNER
  | BannerAdSize.FULL_BANNER
  | BannerAdSize.LARGE_BANNER
  | BannerAdSize.LEADERBOARD
  | BannerAdSize.MEDIUM_RECTANGLE
  | BannerAdSize.WIDE_SKYSCRAPER
  | `${number}x${number}`
  | { width: number; height: number };
