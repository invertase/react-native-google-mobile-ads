/**
 * Pure helpers for diagnosing gallery format-open flakes (tap miss vs
 * navigation stuck vs JS dead) without touching Appium drivers.
 */

export type FormatOpenObservation = {
  galleryHome: boolean;
  backVisible: boolean;
  containerVisible: boolean;
  /** Present when a Metro/JS redbox snippet was already on screen. */
  jsLoadFailure?: string;
};

/**
 * - `open`: format container is visible (success).
 * - `js-dead`: redbox / Metro failure visible — fail fast, do not burn retries.
 * - `tap-miss`: still on gallery home after the opener tap.
 * - `navigation-stuck`: Back chrome visible but the format container never mounted.
 * - `unknown`: none of the positive signals (host overlay, mid-transition, etc.).
 */
export type FormatOpenDiagnosis =
  | 'open'
  | 'js-dead'
  | 'tap-miss'
  | 'navigation-stuck'
  | 'unknown';

export function classifyFormatOpenObservation(
  observation: FormatOpenObservation,
): FormatOpenDiagnosis {
  if (observation.jsLoadFailure) {
    return 'js-dead';
  }
  if (observation.containerVisible) {
    return 'open';
  }
  if (observation.galleryHome && !observation.backVisible) {
    return 'tap-miss';
  }
  if (observation.backVisible && !observation.containerVisible) {
    return 'navigation-stuck';
  }
  return 'unknown';
}

export function formatOpenDiagnosisMessage(
  formatId: string,
  diagnosis: FormatOpenDiagnosis,
  observation: FormatOpenObservation,
): string {
  const bits = [
    `diagnosis=${diagnosis}`,
    `galleryHome=${observation.galleryHome}`,
    `backVisible=${observation.backVisible}`,
    `containerVisible=${observation.containerVisible}`,
  ];
  if (observation.jsLoadFailure) {
    bits.push(`jsLoadFailure=${JSON.stringify(observation.jsLoadFailure)}`);
  }
  return `Format ${formatId} did not open (${bits.join(' ')})`;
}
