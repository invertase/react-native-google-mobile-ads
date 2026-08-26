export enum NativeAdEventType {
  /**
   * Called when an impression is recorded for an ad.
   */
  IMPRESSION = 'impression',

  /**
   * Called when a click is recorded for an ad.
   */
  CLICKED = 'clicked',

  /**
   * Called when an ad opens an overlay that covers the screen.
   */
  OPENED = 'opened',

  /**
   * Called when the user is about to return to the application after clicking on an ad.
   */
  CLOSED = 'closed',

  /**
   * Called when an ad is estimated to have earned money.
   */
  PAID = 'paid',

  /**
   * Called when the video controller has begun or resumed playing a video
   */
  VIDEO_PLAYED = 'video_played',

  /**
   * Called when the video controller has paused video.
   */
  VIDEO_PAUSED = 'video_paused',

  /**
   * Called when the video controller’s video playback has ended.
   */
  VIDEO_ENDED = 'video_ended',

  /**
   * Called when the video controller has muted video.
   */
  VIDEO_MUTED = 'video_muted',

  /**
   * Called when the video controller has unmuted video.
   */
  VIDEO_UNMUTED = 'video_unmuted',
}
