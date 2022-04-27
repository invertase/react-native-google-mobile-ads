/**
 * An app event received from Google Ad Manager ads.
 */
export interface AppEvent {
  /**
   * The event name.
   */
  name: string;

  /**
   * The data received with the app event.
   */
  data?: string;
}
