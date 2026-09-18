import {
  backToGallery,
  findByTestId,
  selectGallerySection,
  tapByTestId,
} from '../test/helpers/gallery.ts';
import { FLUSH_TEARDOWN_SECTION } from './formats.ts';
import { AppiumTestIds } from './testIds.ts';

/**
 * Appium session teardown: ensure gallery home, tap Flush coverage so the
 * TurboModule dumps Emma/LLVM (and Istanbul when Metro is instrumented)
 * before the session kills the app process.
 *
 * Soft-fail: a missing control must not fail the smoke suite; agents still
 * need a live session to pull artifacts afterward.
 */
export async function flushCoverageFromApp(): Promise<void> {
  try {
    const back = await findByTestId(AppiumTestIds.galleryBack);
    if (await back.isDisplayed().catch(() => false)) {
      await backToGallery();
    }

    // Flush sits below the section list on home, so a long selection (e.g. `formats`)
    // can park it beyond the scrollable viewport. Narrow to the shortest section first.
    await selectGallerySection(FLUSH_TEARDOWN_SECTION);

    // Same hardened path as format openers (Android coordinate-tap + safe-band lift).
    await tapByTestId(AppiumTestIds.flushCoverage);
    // Allow native dump + optional JS coverage write to finish.
    await driver.pause(750);
    console.log('[native-coverage] Appium teardown tapped Flush coverage');
  } catch (error) {
    console.warn('[native-coverage] Appium teardown flush skipped:', error);
  }
}
