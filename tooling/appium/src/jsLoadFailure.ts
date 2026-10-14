/**
 * Fail-fast markers for React Native JS / Metro load failures visible in the
 * app UI (redbox / connection screen). Used before long Appium waits so a
 * stuck redbox cannot burn a 90s gallery-home timeout.
 */

import { hardFailureForLine } from './startupSupervisor.ts';

/** Substrings that positively identify a JS/Metro load failure on device UI. */
export const JS_LOAD_FAILURE_UI_SNIPPETS = [
  'Could not connect to development server',
  'Cannot connect to the development server',
  'Unable to load script',
  'No bundle URL present',
] as const;

/**
 * Return a fail-fast message when page source / UI text shows a JS load
 * failure. Prefers exact UI snippets, then hard-failure markers that apply to
 * the on-device JS runtime.
 */
export function jsLoadFailureFromText(text: string): string | undefined {
  if (text.trim() === '') {
    return undefined;
  }
  for (const snippet of JS_LOAD_FAILURE_UI_SNIPPETS) {
    if (text.includes(snippet)) {
      return `Android/iOS JS load failure visible before gallery-ready: ${snippet}`;
    }
  }
  const marker = hardFailureForLine(text);
  if (
    marker != null &&
    (marker.name === 'unable-load-script' ||
      marker.name === 'missing-bundle-url' ||
      marker.name === 'development-server' ||
      marker.name === 'react-context-null')
  ) {
    return `JS load hard-failure marker "${marker.name}" visible before gallery-ready`;
  }
  return undefined;
}
