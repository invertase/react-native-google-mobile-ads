/**
 * Method to open the Native Ad SDK's debug menu
 */
export interface DebugInterface {
  /**
   * Opens the Ad debug menu
   * @param adUnit The Ad Unit ID
   */
  openDebugMenu: (adUnit: string) => void;
}
