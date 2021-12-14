/**
 * A `AdShowOptions` interface used when showing an ad.
 */
export interface AdShowOptions {
  /**
   * - On Android, enables [immersive mode](https://developer.android.com/training/system-ui/immersive).
   * - On iOS, this has no effect on how the ad is shown.
   *
   * @android
   */
  immersiveModeEnabled?: boolean;
}
